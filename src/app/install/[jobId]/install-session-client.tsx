"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type InstallSessionClientProps = {
  jobId: string;
  activeRepository: string | null;
  initialOutput: string;
  initialStatus: string;
  initialErrorMessage: string | null;
  promptText: string;
};

type InstallJobResponse = {
  ok: boolean;
  output: string;
  job: {
    status: string;
    resultSummary: string | null;
    errorMessage: string | null;
  };
};

const TERMINAL_STATUSES = new Set(["completed", "failed"]);
const CONSOLE_AUTO_SCROLL_THRESHOLD = 48;

function inferPromptSentFromOutput(output: string, promptText: string) {
  const firstPromptLine = promptText.split("\n").find((line) => line.trim().length > 0);
  return firstPromptLine ? output.includes(firstPromptLine) : false;
}

export function InstallSessionClient({
  jobId,
  activeRepository,
  initialOutput,
  initialStatus,
  initialErrorMessage,
  promptText,
}: InstallSessionClientProps) {
  const searchParams = useSearchParams();
  const [output, setOutput] = useState(initialOutput);
  const [status, setStatus] = useState(initialStatus);
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage);
  const [promptSent, setPromptSent] = useState(() => inferPromptSentFromOutput(initialOutput, promptText));
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const scrollStorageKey = `install-session-scroll:${jobId}`;
  const submitTarget = useMemo(() => `install-job-input-${jobId}`, [jobId]);
  const requestedRepository = searchParams.get("requested");
  const isShowingDifferentActiveJob =
    Boolean(requestedRepository) && Boolean(activeRepository) && requestedRepository !== activeRepository;

  const isConsoleNearBottom = useCallback(() => {
    const consoleElement = consoleRef.current;
    if (!consoleElement) {
      return true;
    }

    const distanceFromBottom = consoleElement.scrollHeight - consoleElement.clientHeight - consoleElement.scrollTop;
    return distanceFromBottom <= CONSOLE_AUTO_SCROLL_THRESHOLD;
  }, []);

  const scrollConsoleToBottom = useCallback(() => {
    if (!consoleRef.current) {
      return;
    }

    consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, []);

  const storeScrollPosition = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(
      scrollStorageKey,
      JSON.stringify({
        windowY: window.scrollY,
        consoleTop: consoleRef.current?.scrollTop ?? 0,
      }),
    );
  };

  const restoreScrollPosition = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.sessionStorage.getItem(scrollStorageKey);
    if (!raw) {
      window.requestAnimationFrame(() => {
        scrollConsoleToBottom();
      });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { windowY?: number; consoleTop?: number };
      window.requestAnimationFrame(() => {
        if (typeof parsed.windowY === "number") {
          window.scrollTo({ top: parsed.windowY, behavior: "auto" });
        }
        if (typeof parsed.consoleTop === "number" && consoleRef.current) {
          consoleRef.current.scrollTop = parsed.consoleTop;
          return;
        }

        scrollConsoleToBottom();
      });
    } catch {
    }
  }, [scrollConsoleToBottom, scrollStorageKey]);

  useEffect(() => {
    restoreScrollPosition();
  }, [restoreScrollPosition]);

  const refreshOutput = useCallback(async () => {
    const response = await fetch(`/api/install-jobs/${jobId}`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as InstallJobResponse;
    const shouldStickConsoleToBottom = isConsoleNearBottom();
    const previousWindowScroll = window.scrollY;
    const previousConsoleScroll = consoleRef.current?.scrollTop ?? 0;
    setOutput(payload.output);
    setStatus(payload.job.status);
    setErrorMessage(payload.job.errorMessage);
    setPromptSent((current) => current || inferPromptSentFromOutput(payload.output, promptText));
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: previousWindowScroll, behavior: "auto" });
      if (consoleRef.current) {
        if (shouldStickConsoleToBottom) {
          scrollConsoleToBottom();
          return;
        }

        consoleRef.current.scrollTop = previousConsoleScroll;
      }
    });
    return payload;
  }, [isConsoleNearBottom, jobId, promptText, scrollConsoleToBottom]);

  useEffect(() => {
    if (TERMINAL_STATUSES.has(status)) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const payload = await refreshOutput();

      if (payload && TERMINAL_STATUSES.has(payload.job.status)) {
        window.clearInterval(intervalId);
      }
    }, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshOutput, status]);

  const handlePromptSubmit = () => {
    storeScrollPosition();
    setPromptSent(true);
  };

  const handleInputSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const formData = new FormData(form);
    const text = String(formData.get("text") ?? "").trim();
    if (!text) {
      event.preventDefault();
      return;
    }

    storeScrollPosition();
    window.setTimeout(() => {
      form.reset();
    }, 0);
  };

  const finalizeInstall = async (nextStatus: "completed" | "failed") => {
    storeScrollPosition();
    const response = await fetch(`/api/install-jobs/${jobId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as InstallJobResponse;
    setStatus(payload.job.status);
    setErrorMessage(payload.job.errorMessage);
  };

  return (
    <section className="install-session-client">
      {isShowingDifferentActiveJob ? (
        <div className="panel px-[var(--space-4)] py-[var(--space-4)] text-[length:var(--text-body-compact)] leading-7 text-[var(--color-warning-fg)]">
          当前已有安装会话在执行：<strong className="text-[var(--color-fg-default)]">{activeRepository}</strong>。
          你刚请求安装的是 <strong className="text-[var(--color-fg-default)]">{requestedRepository}</strong>，系统为避免冲突，暂时复用了现有会话。
        </div>
      ) : null}
      <iframe title="install-input-target" name={submitTarget} hidden />
      <div className="install-session-toolbar">
        <div className="flex flex-wrap gap-[var(--space-3)]">
          <form action={`/api/install-jobs/${jobId}/input`} method="post" target={submitTarget} onSubmit={handlePromptSubmit}>
            <input type="hidden" name="text" value={promptText} />
            <button type="submit" className="secondary-button">
              {promptSent ? "重新发送安装提示词" : "发送安装提示词"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => finalizeInstall("completed")}
            className="secondary-button"
            disabled={TERMINAL_STATUSES.has(status)}
          >
            标记完成
          </button>
          <button
            type="button"
            onClick={() => finalizeInstall("failed")}
            className="secondary-button"
            disabled={TERMINAL_STATUSES.has(status)}
          >
            标记失败
          </button>
        </div>
        <span className="install-session-status">
          {status === "completed" ? "已完成" : status === "failed" ? "已失败" : "执行中"}
        </span>
      </div>
      <details className="panel px-[var(--space-4)] py-[var(--space-4)] shadow-none">
        <summary className="cursor-pointer text-[length:var(--text-meta)] font-medium text-[var(--color-fg-default)]">
          查看当前安装提示词
        </summary>
        <pre className="mt-[var(--space-3)] whitespace-pre-wrap font-mono text-[length:var(--text-code)] text-[var(--color-fg-muted)]">
          {promptText}
        </pre>
      </details>
      <div ref={consoleRef} className="install-console">
        {output || "等待 tmux 输出..."}
      </div>
      {errorMessage ? (
        <div className="panel px-[var(--space-4)] py-[var(--space-4)] text-[length:var(--text-body-compact)] leading-7 text-[var(--color-warning-fg)]">
          <strong className="text-[var(--color-fg-default)]">失败原因</strong>
          <pre className="mt-[var(--space-3)] whitespace-pre-wrap font-sans">{errorMessage}</pre>
        </div>
      ) : null}
      <form
        className="install-session-inputbar"
        action={`/api/install-jobs/${jobId}/input`}
        method="post"
        target={submitTarget}
        onSubmit={handleInputSubmit}
      >
        <input
          type="text"
          name="text"
          placeholder="继续给 tmux / Codex 发送输入"
          className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-[var(--space-3)] py-[var(--space-3)] font-mono text-[length:var(--text-code)] text-[var(--color-fg-default)] outline-none focus:border-[var(--color-accent-emphasis)]"
        />
        <button type="submit" className="primary-button">
          发送给 Codex
        </button>
      </form>
    </section>
  );
}
