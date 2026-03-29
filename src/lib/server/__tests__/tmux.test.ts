import { describe, expect, it } from "vitest";

import {
  buildCodexInstallShellCommand,
  resolveTmuxTarget,
  targetToString,
} from "@/lib/server/tmux";
import { buildInstallPrompt } from "@/lib/server/workbench-config";

describe("tmux helpers", () => {
  it("prefers explicit tmux target values over defaults", () => {
    const target = resolveTmuxTarget(
      {
        defaultTmuxSession: "default-session",
        defaultTmuxWindow: "0",
        defaultTmuxPane: "1",
      },
      {
        session: "custom-session",
        pane: "3",
      },
    );

    expect(target).toEqual({
      session: "custom-session",
      window: "0",
      pane: "3",
    });
    expect(targetToString(target)).toBe("custom-session:0.3");
  });

  it("builds install prompts from template and repository metadata", () => {
    const prompt = buildInstallPrompt(
      "请克隆并安装这个仓库，输出结果摘要。",
      {
        fullName: "anthropic/claude-code",
        repoUrl: "https://github.com/anthropic/claude-code",
      },
      "E:/workspace/oss-lab",
    );

    expect(prompt).toContain("请克隆并安装这个仓库，输出结果摘要。");
    expect(prompt).toContain("anthropic/claude-code");
    expect(prompt).toContain("https://github.com/anthropic/claude-code");
    expect(prompt).toContain("E:/workspace/oss-lab");
  });

  it("builds a codex shell command that runs inside the selected workspace", () => {
    const command = buildCodexInstallShellCommand({
      workspacePath: "/mnt/e/workspace/oss-lab/superset",
      prompt: "请克隆并安装这个仓库，输出结果摘要。",
      summaryFilePath: "/mnt/e/testProject/test1/.sisyphus/install-jobs/job-1/summary.md",
      transcriptFilePath: "/mnt/e/testProject/test1/.sisyphus/install-jobs/job-1/transcript.log",
      finalizeCommand: "cd '/mnt/e/testProject/test1' && npx tsx scripts/finalize-install-job.ts --job-id job-1 --summary-file '/mnt/e/testProject/test1/.sisyphus/install-jobs/job-1/summary.md' --transcript-file '/mnt/e/testProject/test1/.sisyphus/install-jobs/job-1/transcript.log' --exit-code",
    });

    expect(command).toContain("bash -lc");
    expect(command).toContain("codex exec");
    expect(command).toContain("--dangerously-bypass-approvals-and-sandbox");
    expect(command).toContain("/mnt/e/workspace/oss-lab/superset");
    expect(command).toContain("/mnt/e/testProject/test1/.sisyphus/install-jobs/job-1/summary.md");
    expect(command).toContain("请克隆并安装这个仓库，输出结果摘要。");
    expect(command).toContain("scripts/finalize-install-job.ts --job-id job-1");
  });
});
