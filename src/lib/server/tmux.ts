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

function normalizeTmuxPart(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function hasTmuxTarget(target: string) {
  try {
    await execFileAsync("tmux", ["has-session", "-t", target]);
    return true;
  } catch {
    return false;
  }
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

export async function ensureTmuxTargetExists(target: ResolvedTmuxTarget) {
  const sessionExists = await hasTmuxTarget(target.session);

  if (!sessionExists) {
    if (target.window) {
      await execFileAsync("tmux", ["new-session", "-d", "-s", target.session, "-n", target.window]);
    } else {
      await execFileAsync("tmux", ["new-session", "-d", "-s", target.session]);
    }
  }

  if (!target.window) {
    return;
  }

  const windowTarget = `${target.session}:${target.window}`;
  const windowExists = await hasTmuxTarget(windowTarget);

  if (!windowExists) {
    await execFileAsync("tmux", ["new-window", "-d", "-t", target.session, "-n", target.window]);
  }

  if (!target.pane) {
    return;
  }

  const paneTarget = `${windowTarget}.${target.pane}`;
  const paneExists = await hasTmuxTarget(paneTarget);

  if (!paneExists) {
    throw new Error(`tmux pane ${paneTarget} does not exist.`);
  }
}

export async function dispatchToTmux(target: ResolvedTmuxTarget, message: string) {
  const targetString = targetToString(target);
  await execFileAsync("tmux", ["send-keys", "-t", targetString, "-l", message]);
  await execFileAsync("tmux", ["send-keys", "-t", targetString, "Enter"]);
}

export async function restartTmuxTarget(target: ResolvedTmuxTarget) {
  if (!target.window) {
    await execFileAsync("tmux", ["kill-session", "-t", target.session]).catch(() => undefined);
    await ensureTmuxTargetExists(target);
    return;
  }

  const windowTarget = `${target.session}:${target.window}`;
  await execFileAsync("tmux", ["kill-window", "-t", windowTarget]).catch(() => undefined);
  await ensureTmuxTargetExists(target);
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
