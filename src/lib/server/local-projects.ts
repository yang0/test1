import {
  LocalCloneStatus,
  LocalInstallStatus,
  type LocalProject,
  type Prisma,
} from "@/lib/server/prisma-client";
import { prisma } from "@/lib/server/db";

export type UpsertLocalProjectInput = {
  projectPath: string;
  rootPath: string;
  detectedName: string;
  repositoryId?: string | null;
  gitRemoteUrl?: string | null;
  cloneStatus?: LocalCloneStatus;
  installStatus?: LocalInstallStatus;
  lastScannedAt?: Date | null;
  lastInstalledAt?: Date | null;
};

export function buildLocalProjectUpsertInput(
  input: UpsertLocalProjectInput,
): Prisma.LocalProjectUpsertArgs {
  const data: Prisma.LocalProjectUncheckedCreateInput = {
    projectPath: input.projectPath,
    rootPath: input.rootPath,
    detectedName: input.detectedName,
    repositoryId: input.repositoryId ?? null,
    gitRemoteUrl: input.gitRemoteUrl ?? null,
    cloneStatus: input.cloneStatus ?? LocalCloneStatus.discovered,
    installStatus: input.installStatus ?? LocalInstallStatus.unknown,
    lastScannedAt: input.lastScannedAt ?? null,
    lastInstalledAt: input.lastInstalledAt ?? null,
  };

  return {
    where: { projectPath: input.projectPath },
    create: data,
    update: data,
  };
}

export async function upsertLocalProject(input: UpsertLocalProjectInput): Promise<LocalProject> {
  return prisma.localProject.upsert(buildLocalProjectUpsertInput(input));
}

export async function listLocalProjects() {
  return prisma.localProject.findMany({
    include: {
      repository: true,
    },
    orderBy: [{ detectedName: "asc" }],
  });
}

export async function findLatestLocalProjectForRepository(repositoryId: string) {
  return prisma.localProject.findFirst({
    where: {
      repositoryId,
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function updateLocalProjectInstallState(
  id: string,
  installStatus: LocalInstallStatus,
  lastInstalledAt: Date | null,
) {
  return prisma.localProject.update({
    where: { id },
    data: {
      installStatus,
      lastInstalledAt,
    },
  });
}

export { LocalCloneStatus, LocalInstallStatus };
