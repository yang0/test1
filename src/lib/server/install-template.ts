export const INSTALL_JOB_SUMMARY_BEGIN = "INSTALL_JOB_SUMMARY_BEGIN";
export const INSTALL_JOB_SUMMARY_END = "INSTALL_JOB_SUMMARY_END";
export const INSTALL_JOB_STATUS_COMPLETED = "INSTALL_JOB_STATUS: completed";
export const INSTALL_JOB_STATUS_FAILED = "INSTALL_JOB_STATUS: failed";
const INSTALL_JOB_SUMMARY_PLACEHOLDER = "用 3 到 8 行中文总结实际执行了什么、结果如何、还有什么注意事项。";

type InstallPromptRepository = {
  fullName: string;
  repoUrl: string;
};

type InstallBootstrapInput = {
  workspacePath: string;
  agentLaunchCommand: string;
};

function quoteShellArgument(value: string) {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

export function buildInstallPrompt(
  _template: string,
  repository: InstallPromptRepository,
  workspacePath: string | null,
) {
  return [
    `请安装本项目：${repository.repoUrl}`,
    `工作目录：${workspacePath ?? "未配置"}`,
    "完成后请严格按下面格式输出，不要改动标记文本：",
    INSTALL_JOB_SUMMARY_BEGIN,
    "用 3 到 8 行中文总结实际执行了什么、结果如何、还有什么注意事项。",
    INSTALL_JOB_SUMMARY_END,
    `成功时最后单独输出一行：${INSTALL_JOB_STATUS_COMPLETED}`,
    `失败时最后单独输出一行：${INSTALL_JOB_STATUS_FAILED}`,
  ].join("\n");
}

export function buildInstallBootstrapCommands(input: InstallBootstrapInput) {
  return [
    `cd ${quoteShellArgument(input.workspacePath)}`,
    input.agentLaunchCommand.trim(),
  ];
}

export function parseInstallSessionOutput(output: string) {
  const summaryStart = output.lastIndexOf(INSTALL_JOB_SUMMARY_BEGIN);
  const summaryEnd = output.lastIndexOf(INSTALL_JOB_SUMMARY_END);
  const completedIndex = output.lastIndexOf(INSTALL_JOB_STATUS_COMPLETED);
  const failedIndex = output.lastIndexOf(INSTALL_JOB_STATUS_FAILED);
  const rawSummary =
    summaryStart >= 0 && summaryEnd > summaryStart
      ? output
          .slice(summaryStart + INSTALL_JOB_SUMMARY_BEGIN.length, summaryEnd)
          .trim() || null
      : null;
  const summary =
    rawSummary && rawSummary !== INSTALL_JOB_SUMMARY_PLACEHOLDER
      ? rawSummary
      : null;

  return {
    status:
      !summary || (completedIndex < 0 && failedIndex < 0)
        ? null
        : completedIndex > failedIndex
          ? ("completed" as const)
          : ("failed" as const),
    summary,
  };
}

export function shouldAcknowledgeCodexTrustPrompt(output: string) {
  return (
    output.includes("Do you trust the contents of this directory?") &&
    output.includes("Press enter to continue")
  );
}

export function getLatestRetryableUpstreamSignature(output: string) {
  const matches = [...output.matchAll(/unexpected status 502 Bad Gateway[\s\S]*?request id:\s*([^\s]+)/gi)];
  const lastMatch = matches.at(-1);
  return lastMatch?.[1] ?? null;
}
