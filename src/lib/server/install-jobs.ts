import { JobStatus, type InstallJob } from "@/generated/prisma/client";
import { prisma } from "@/lib/server/db";

export type CreateInstallJobInput = {
  repositoryId?: string;
  promptText: string;
  targetTmuxSession?: string | null;
  targetTmuxWindow?: string | null;
  targetTmuxPane?: string | null;
};

export async function createInstallJob(input: CreateInstallJobInput): Promise<InstallJob> {
  return prisma.installJob.create({
    data: {
      repositoryId: input.repositoryId,
      promptText: input.promptText,
      targetTmuxSession: input.targetTmuxSession ?? null,
      targetTmuxWindow: input.targetTmuxWindow ?? null,
      targetTmuxPane: input.targetTmuxPane ?? null,
      status: JobStatus.queued,
    },
  });
}

export async function finishInstallJob(
  id: string,
  status: "completed" | "failed",
  resultSummary?: string | null,
  errorMessage?: string | null,
) {
  return prisma.installJob.update({
    where: { id },
    data: {
      status,
      resultSummary: resultSummary ?? null,
      errorMessage: errorMessage ?? null,
      finishedAt: new Date(),
    },
  });
}

export async function markInstallJobProcessing(id: string) {
  return prisma.installJob.update({
    where: { id },
    data: {
      status: JobStatus.processing,
    },
  });
}
