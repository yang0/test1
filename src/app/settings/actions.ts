"use server";

import { revalidatePath } from "next/cache";

import { updateAppSettings } from "@/lib/server/settings";

export async function saveWorkbenchSettingsAction(formData: FormData) {
  const projectRootPath = formData.get("projectRootPath");
  const translationPromptTemplate = formData.get("translationPromptTemplate");

  await updateAppSettings({
    projectRootPath: typeof projectRootPath === "string" ? projectRootPath : null,
    translationPromptTemplate:
      typeof translationPromptTemplate === "string" ? translationPromptTemplate : undefined,
  });

  revalidatePath("/settings");
  revalidatePath("/projects");
}
