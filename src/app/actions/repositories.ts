"use server";

import { redirect } from "next/navigation";

import { addRepositoryByUrl } from "@/lib/server/manual-repositories";

export async function addRepositoryByUrlAction(formData: FormData) {
  const repositoryUrl = formData.get("repositoryUrl");

  if (typeof repositoryUrl !== "string") {
    throw new Error("Missing repository URL.");
  }

  const repository = await addRepositoryByUrl(repositoryUrl);
  redirect(`/?period=all&pin=${encodeURIComponent(repository.fullName)}`);
}
