import { describe, expect, it } from "vitest";

import {
  buildInstallBootstrapCommands,
  buildInstallPrompt,
  parseInstallSessionOutput,
  shouldAcknowledgeCodexTrustPrompt,
  INSTALL_JOB_STATUS_COMPLETED,
  INSTALL_JOB_SUMMARY_BEGIN,
  INSTALL_JOB_SUMMARY_END,
} from "@/lib/server/install-template";
import { resolveTmuxTarget, targetToString } from "@/lib/server/tmux";

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

    expect(prompt).toContain("请安装本项目：https://github.com/anthropic/claude-code");
    expect(prompt).toContain("工作目录：E:/workspace/oss-lab");
    expect(prompt).toContain("INSTALL_JOB_STATUS: completed");
  });

  it("builds install bootstrap commands in the expected order", () => {
    const commands = buildInstallBootstrapCommands({
      workspacePath: "/mnt/e/workspace/oss-lab/superset",
      agentLaunchCommand: "codex --profile frontend --no-alt-screen",
    });

    expect(commands).toEqual([
      "cd '/mnt/e/workspace/oss-lab/superset'",
      "codex --profile frontend --no-alt-screen",
    ]);
  });

  it("parses install session markers from tmux output", () => {
    const parsed = parseInstallSessionOutput([
      "some log",
      INSTALL_JOB_SUMMARY_BEGIN,
      "已读取 README",
      "依赖安装完成",
      INSTALL_JOB_SUMMARY_END,
      INSTALL_JOB_STATUS_COMPLETED,
    ].join("\n"));

    expect(parsed).toEqual({
      status: "completed",
      summary: "已读取 README\n依赖安装完成",
    });
  });

  it("detects the codex trust prompt from tmux output", () => {
    expect(
      shouldAcknowledgeCodexTrustPrompt([
        "Do you trust the contents of this directory?",
        "Press enter to continue",
      ].join("\n")),
    ).toBe(true);
  });
});
