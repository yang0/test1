import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { AppSettings } from "@/generated/prisma/client";

const execFileAsync = promisify(execFile);

export type TmuxTargetInput = {
  session?: string | null;
  window?: string | null;
  pane?: string | null;
};

export type ResolvedTmuxTarget = {
  session: string;
  window: string | null;
  pane: string | null;
};

type InstallPromptRepository = {
  fullName: string;
  repoUrl: string;
};

function quoteShellArgument(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function normalizeTmuxPart(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function resolveTmuxTarget(settings: Partial<AppSettings>, input: TmuxTargetInput = {}): ResolvedTmuxTarget {
  const session =
    normalizeTmuxPart(input.session) ?? normalizeTmuxPart(settings.defaultTmuxSession) ?? "default";
  const window = normalizeTmuxPart(input.window) ?? normalizeTmuxPart(settings.defaultTmuxWindow);
  const pane = normalizeTmuxPart(input.pane) ?? normalizeTmuxPart(settings.defaultTmuxPane);

  return {
    session,
    window,
    pane,
  };
}

export function targetToString(target: ResolvedTmuxTarget) {
  let value = target.session;

  if (target.window) {
    value += `:${target.window}`;
  }

  if (target.pane) {
    value += `${target.window ? "." : ":"}${target.pane}`;
  }

  return value;
}

export function buildInstallPrompt(
  template: string,
  repository: InstallPromptRepository,
  projectRootPath: string | null,
) {
  return [
    template.trim(),
    "",
    `仓库：${repository.fullName}`,
    `地址：${repository.repoUrl}`,
    `建议根目录：${projectRootPath ?? "未配置"}`,
    "请克隆仓库、阅读 README、安装依赖，并输出摘要。",
  ].join("\n");
}

export function buildCodexInstallShellCommand(input: {
  workspacePath: string;
  prompt: string;
  summaryFilePath: string;
  transcriptFilePath: string;
  finalizeCommand: string;
}) {
  const codexCommand = [
    "codex exec",
    "--dangerously-bypass-approvals-and-sandbox",
    "-C",
    quoteShellArgument(input.workspacePath),
    "-o",
    quoteShellArgument(input.summaryFilePath),
    quoteShellArgument(input.prompt),
    ">",
    quoteShellArgument(input.transcriptFilePath),
    "2>&1",
  ].join(" ");

  return [
    "bash -lc",
    quoteShellArgument(`${codexCommand}; status=$?; ${input.finalizeCommand} $status`),
  ].join(" ");
}

export async function ensureTmuxTargetExists(target: ResolvedTmuxTarget) {
  await execFileAsync("tmux", ["has-session", "-t", target.session]);
}

export async function dispatchToTmux(target: ResolvedTmuxTarget, message: string) {
  const targetString = targetToString(target);
  await execFileAsync("tmux", ["send-keys", "-t", targetString, "-l", message]);
  await execFileAsync("tmux", ["send-keys", "-t", targetString, "Enter"]);
}

export async function captureTmuxTail(target: ResolvedTmuxTarget, lines = 120) {
  const targetString = targetToString(target);
  const { stdout } = await execFileAsync("tmux", [
    "capture-pane",
    "-p",
    "-t",
    targetString,
    "-S",
    `-${lines}`,
  ]);

  return stdout;
}
