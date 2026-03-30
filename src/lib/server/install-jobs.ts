import { JobStatus, type InstallJob } from "@/generated/prisma/client";
import { LocalInstallStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/server/db";
import { parseInstallSessionOutput } from "@/lib/server/install-template";
import {
  findLatestLocalProjectForRepository,
  updateLocalProjectInstallState,
} from "@/lib/server/local-projects";

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

export async function resetInstallJob(id: string) {
  return prisma.installJob.update({
    where: { id },
    data: {
      status: JobStatus.processing,
      resultSummary: null,
      errorMessage: null,
      finishedAt: null,
    },
  });
}

export async function getInstallJob(id: string) {
  return prisma.installJob.findUnique({
    where: { id },
    include: {
      repository: true,
    },
  });
}

export async function getActiveInstallJob() {
  return prisma.installJob.findFirst({
    where: {
      status: {
        in: [JobStatus.queued, JobStatus.processing],
      },
    },
    include: {
      repository: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function syncLocalProjectStateForJob(job: InstallJob, status: "completed" | "failed") {
  if (!job.repositoryId) {
    return;
  }

  const localProject = await findLatestLocalProjectForRepository(job.repositoryId);

  if (!localProject) {
    return;
  }

  await updateLocalProjectInstallState(
    localProject.id,
    status === "completed" ? LocalInstallStatus.installed : LocalInstallStatus.failed,
    new Date(),
  );
}

export async function finalizeInstallJob(
  id: string,
  status: "completed" | "failed",
  resultSummary?: string | null,
  errorMessage?: string | null,
) {
  const currentJob = await prisma.installJob.findUnique({
    where: { id },
  });

  if (!currentJob) {
    return null;
  }

  if (currentJob.status === JobStatus.completed || currentJob.status === JobStatus.failed) {
    return getInstallJob(id);
  }

  await finishInstallJob(id, status, resultSummary, errorMessage);
  await syncLocalProjectStateForJob(currentJob, status);

  return getInstallJob(id);
}

export async function maybeFinalizeInstallJobFromOutput(id: string, output: string) {
  const currentJob = await getInstallJob(id);

  if (!currentJob) {
    return null;
  }

  if (currentJob.status === JobStatus.completed || currentJob.status === JobStatus.failed) {
    return currentJob;
  }

  const parsed = parseInstallSessionOutput(output);

  if (!parsed.status) {
    return currentJob;
  }

  return finalizeInstallJob(
    id,
    parsed.status,
    parsed.status === "completed"
      ? parsed.summary ?? "Codex install session reported completion."
      : null,
    parsed.status === "failed"
      ? parsed.summary ?? "Codex install session reported failure."
      : null,
  );
}
