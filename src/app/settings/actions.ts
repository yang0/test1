"use server";

import { revalidatePath } from "next/cache";

import { updateAppSettings } from "@/lib/server/settings";

export async function saveWorkbenchSettingsAction(formData: FormData) {
  const projectRootPath = formData.get("projectRootPath");
  const agentLaunchCommand = formData.get("agentLaunchCommand");
  const defaultTmuxSession = formData.get("defaultTmuxSession");
  const defaultTmuxWindow = formData.get("defaultTmuxWindow");
  const defaultTmuxPane = formData.get("defaultTmuxPane");
  const translationPromptTemplate = formData.get("translationPromptTemplate");
  const installPromptTemplate = formData.get("installPromptTemplate");

  await updateAppSettings({
    projectRootPath: typeof projectRootPath === "string" ? projectRootPath : null,
    agentLaunchCommand: typeof agentLaunchCommand === "string" ? agentLaunchCommand : undefined,
    defaultTmuxSession: typeof defaultTmuxSession === "string" ? defaultTmuxSession : null,
    defaultTmuxWindow: typeof defaultTmuxWindow === "string" ? defaultTmuxWindow : null,
    defaultTmuxPane: typeof defaultTmuxPane === "string" ? defaultTmuxPane : null,
    translationPromptTemplate:
      typeof translationPromptTemplate === "string" ? translationPromptTemplate : undefined,
    installPromptTemplate: typeof installPromptTemplate === "string" ? installPromptTemplate : undefined,
  });

  revalidatePath("/settings");
  revalidatePath("/projects");
}
