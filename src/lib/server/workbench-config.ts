import path from "node:path";

import type { AppSettings } from "@/generated/prisma/client";

export const DEFAULT_TRANSLATION_PROMPT_TEMPLATE =
  "请把以下仓库 README 翻译成自然、准确的中文，保留代码块与标题结构。";

export const DEFAULT_INSTALL_PROMPT_TEMPLATE =
  "请克隆并安装这个仓库，阅读 README 后执行最合适的安装步骤，并输出结果摘要。";

export const WORKBENCH_APP_ROOT = process.cwd();
export const INSTALL_JOB_ARTIFACTS_ROOT = path.join(WORKBENCH_APP_ROOT, ".sisyphus", "install-jobs");

type PromptRepository = {
  fullName: string;
  repoUrl: string;
};

type PartialSettingsConfig = Pick<
  Partial<AppSettings>,
  | "projectRootPath"
  | "defaultTmuxSession"
  | "defaultTmuxWindow"
  | "defaultTmuxPane"
  | "translationPromptTemplate"
  | "installPromptTemplate"
>;

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizePromptTemplate(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export function resolveWorkbenchRuntimeConfig(settings: PartialSettingsConfig) {
  return {
    projectRootPath: normalizeNullableString(settings.projectRootPath),
    tmux: {
      session: normalizeNullableString(settings.defaultTmuxSession),
      window: normalizeNullableString(settings.defaultTmuxWindow),
      pane: normalizeNullableString(settings.defaultTmuxPane),
    },
    prompts: {
      translation: normalizePromptTemplate(
        settings.translationPromptTemplate,
        DEFAULT_TRANSLATION_PROMPT_TEMPLATE,
      ),
      install: normalizePromptTemplate(settings.installPromptTemplate, DEFAULT_INSTALL_PROMPT_TEMPLATE),
    },
  };
}

export function buildInstallPrompt(
  template: string,
  repository: PromptRepository,
  workspacePath: string | null,
) {
  return [
    template.trim(),
    "",
    `仓库：${repository.fullName}`,
    `地址：${repository.repoUrl}`,
    `工作目录：${workspacePath ?? "未配置"}`,
    "请先确认当前 workspace 是仓库根目录或预期克隆根目录，然后使用 Codex 自动完成克隆、README 阅读、依赖安装与结果总结。",
  ].join("\n");
}

export function buildTranslationPrompt(template: string, repository: PromptRepository, markdown: string) {
  return [
    template.trim(),
    "",
    `仓库：${repository.fullName}`,
    `地址：${repository.repoUrl}`,
    "以下是待翻译的 README 原文：",
    markdown,
  ].join("\n");
}

export function getInstallJobArtifactPaths(jobId: string) {
  const jobRoot = path.join(INSTALL_JOB_ARTIFACTS_ROOT, jobId);

  return {
    jobRoot,
    summaryFilePath: path.join(jobRoot, "summary.md"),
    transcriptFilePath: path.join(jobRoot, "transcript.log"),
  };
}
