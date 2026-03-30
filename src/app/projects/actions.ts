"use server";

import { revalidatePath } from "next/cache";

import { scanLocalProjects } from "@/lib/server/local-project-scanner";
import { getAppSettings } from "@/lib/server/settings";

export async function scanProjectsAction() {
  const settings = await getAppSettings();

  if (!settings.projectRootPath) {
    revalidatePath("/projects");
    return;
  }

  await scanLocalProjects(settings.projectRootPath);
  revalidatePath("/projects");
}
