"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getActiveInstallJob } from "@/lib/server/install-jobs";
import { requestRepositoryInstall } from "@/lib/server/install-workflow";

export async function requestRepositoryInstallAction(formData: FormData) {
  const owner = formData.get("owner");
  const name = formData.get("name");

  if (typeof owner !== "string" || typeof name !== "string") {
    throw new Error("Missing repository owner or name for install action.");
  }

  const requestHeaders = await headers();
  const referer = requestHeaders.get("referer");
  const fallbackPath = `/repo/${owner}/${name}`;
  const fallbackRefererTarget = referer
    ? (() => {
        try {
          const url = new URL(referer);
          return `${url.pathname}${url.search}`;
        } catch {
          return fallbackPath;
        }
      })()
    : fallbackPath;

  const activeJob = await getActiveInstallJob();
  if (activeJob) {
    revalidatePath(`/install/${activeJob.id}`);
    revalidatePath(fallbackRefererTarget);
    redirect(`/install/${activeJob.id}?requested=${encodeURIComponent(`${owner}/${name}`)}`);
  }

  const job = await requestRepositoryInstall(owner, name);
  revalidatePath("/");
  revalidatePath(`/repo/${owner}/${name}`);
  revalidatePath("/projects");
  revalidatePath(`/install/${job.id}`);
  revalidatePath(fallbackRefererTarget);
  redirect(`/install/${job.id}`);
}
