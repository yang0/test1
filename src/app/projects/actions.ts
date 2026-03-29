"use server";

import { revalidatePath } from "next/cache";

import { scanLocalProjects } from "@/lib/server/local-project-scanner";
import { getAppSettings, updateAppSettings } from "@/lib/server/settings";

export async function saveProjectRootAction(formData: FormData) {
  const projectRootPath = formData.get("projectRootPath");

  await updateAppSettings({
    projectRootPath: typeof projectRootPath === "string" ? projectRootPath : null,
  });

  revalidatePath("/projects");
}

export async function scanProjectsAction() {
  const settings = await getAppSettings();

  if (!settings.projectRootPath) {
    revalidatePath("/projects");
    return;
  }

  await scanLocalProjects(settings.projectRootPath);
  revalidatePath("/projects");
}
