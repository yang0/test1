"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { deleteReadmeDocuments } from "@/lib/server/readmes";

export async function rerenderReadmeAction(formData: FormData) {
  const repositoryId = formData.get("repositoryId");
  const owner = formData.get("owner");
  const name = formData.get("name");

  if (typeof repositoryId !== "string" || typeof owner !== "string" || typeof name !== "string") {
    throw new Error("Missing repository info for README rerender.");
  }

  await deleteReadmeDocuments(repositoryId);
  const targetPath = `/repo/${owner}/${name}`;
  revalidatePath(targetPath);
  redirect(targetPath);
}
