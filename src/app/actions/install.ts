"use server";

import { revalidatePath } from "next/cache";

import { requestRepositoryInstall } from "@/lib/server/install-workflow";

export async function requestRepositoryInstallAction(formData: FormData) {
  const owner = formData.get("owner");
  const name = formData.get("name");

  if (typeof owner !== "string" || typeof name !== "string") {
    throw new Error("Missing repository owner or name for install action.");
  }

  await requestRepositoryInstall(owner, name);
  revalidatePath("/");
  revalidatePath(`/repo/${owner}/${name}`);
  revalidatePath("/projects");
}
