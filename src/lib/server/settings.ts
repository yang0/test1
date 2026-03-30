import { prisma } from "@/lib/server/db";
import {
  DEFAULT_AGENT_LAUNCH_COMMAND,
  DEFAULT_INSTALL_PROMPT_TEMPLATE,
  DEFAULT_TRANSLATION_PROMPT_TEMPLATE,
  resolveWorkbenchRuntimeConfig,
} from "@/lib/server/workbench-config";

export {
  DEFAULT_AGENT_LAUNCH_COMMAND,
  DEFAULT_INSTALL_PROMPT_TEMPLATE,
  DEFAULT_TRANSLATION_PROMPT_TEMPLATE,
};

export type AppSettingsPatch = {
  projectRootPath?: string | null;
  agentLaunchCommand?: string;
  defaultTmuxSession?: string | null;
  defaultTmuxWindow?: string | null;
  defaultTmuxPane?: string | null;
  translationPromptTemplate?: string;
  installPromptTemplate?: string;
};

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function buildAppSettingsPatch(input: AppSettingsPatch) {
  return {
    projectRootPath: normalizeNullableString(input.projectRootPath),
    agentLaunchCommand: input.agentLaunchCommand?.trim() || DEFAULT_AGENT_LAUNCH_COMMAND,
    defaultTmuxSession: normalizeNullableString(input.defaultTmuxSession),
    defaultTmuxWindow: normalizeNullableString(input.defaultTmuxWindow),
    defaultTmuxPane: normalizeNullableString(input.defaultTmuxPane),
    translationPromptTemplate:
      input.translationPromptTemplate?.trim() || DEFAULT_TRANSLATION_PROMPT_TEMPLATE,
    installPromptTemplate:
      input.installPromptTemplate?.trim() || DEFAULT_INSTALL_PROMPT_TEMPLATE,
  };
}

export async function ensureAppSettings() {
  const existing = await prisma.appSettings.findUnique({
    where: { id: 1 },
  });

  if (existing) {
    return existing;
  }

  return prisma.appSettings.create({
    data: {
      id: 1,
      agentLaunchCommand: DEFAULT_AGENT_LAUNCH_COMMAND,
      translationPromptTemplate: DEFAULT_TRANSLATION_PROMPT_TEMPLATE,
      installPromptTemplate: DEFAULT_INSTALL_PROMPT_TEMPLATE,
    },
  });
}

export async function getAppSettings() {
  return ensureAppSettings();
}

export async function getWorkbenchRuntimeConfig() {
  return resolveWorkbenchRuntimeConfig(await ensureAppSettings());
}

export async function updateAppSettings(input: AppSettingsPatch) {
  const existing = await ensureAppSettings();
  const patch = {
    projectRootPath:
      "projectRootPath" in input ? normalizeNullableString(input.projectRootPath) : existing.projectRootPath,
    agentLaunchCommand:
      "agentLaunchCommand" in input
        ? input.agentLaunchCommand?.trim() || DEFAULT_AGENT_LAUNCH_COMMAND
        : existing.agentLaunchCommand,
    defaultTmuxSession:
      "defaultTmuxSession" in input
        ? normalizeNullableString(input.defaultTmuxSession)
        : existing.defaultTmuxSession,
    defaultTmuxWindow:
      "defaultTmuxWindow" in input
        ? normalizeNullableString(input.defaultTmuxWindow)
        : existing.defaultTmuxWindow,
    defaultTmuxPane:
      "defaultTmuxPane" in input ? normalizeNullableString(input.defaultTmuxPane) : existing.defaultTmuxPane,
    translationPromptTemplate:
      "translationPromptTemplate" in input
        ? input.translationPromptTemplate?.trim() || DEFAULT_TRANSLATION_PROMPT_TEMPLATE
        : existing.translationPromptTemplate,
    installPromptTemplate:
      "installPromptTemplate" in input
        ? input.installPromptTemplate?.trim() || DEFAULT_INSTALL_PROMPT_TEMPLATE
        : existing.installPromptTemplate,
  };

  return prisma.appSettings.upsert({
    where: { id: 1 },
    update: patch,
    create: {
      id: 1,
      ...patch,
    },
  });
}
