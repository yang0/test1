import { LocalCloneStatus } from "@/generated/prisma/client";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/server/db";
import {
  createInstallJob,
  finalizeInstallJob,
  getInstallJob,
  markInstallJobProcessing,
  resetInstallJob,
} from "@/lib/server/install-jobs";
import {
  buildInstallBootstrapCommands,
  buildInstallPrompt,
} from "@/lib/server/install-template";
import {
  LocalInstallStatus,
  findLatestLocalProjectForRepository,
  upsertLocalProject,
} from "@/lib/server/local-projects";
import { findRepositoryByOwnerAndName } from "@/lib/server/repositories";
import { getWorkbenchRuntimeConfig } from "@/lib/server/settings";
import { dispatchToTmux, ensureTmuxTargetExists, resolveTmuxTarget, restartTmuxTarget } from "@/lib/server/tmux";

async function resolveInstallWorkspacePath(
  repositoryId: string,
  repositoryName: string,
  projectRootPath: string | null,
) {
  const localProject = await prisma.localProject.findFirst({
    where: {
      repositoryId,
      cloneStatus: LocalCloneStatus.cloned,
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  if (localProject?.projectPath) {
    return localProject.projectPath;
  }

  return projectRootPath ? path.join(projectRootPath, repositoryName) : null;
}

async function resolveBootstrapForRepository(repositoryId: string, repositoryName: string) {
  const runtimeConfig = await getWorkbenchRuntimeConfig();
  const workspacePath = await resolveInstallWorkspacePath(
    repositoryId,
    repositoryName,
    runtimeConfig.projectRootPath,
  );

  if (!workspacePath) {
    throw new Error("Project root path is not configured for install workflow.");
  }

  await mkdir(workspacePath, { recursive: true });

  const bootstrapCommands = buildInstallBootstrapCommands({
    workspacePath,
    agentLaunchCommand: runtimeConfig.agent.launchCommand,
  });

  return {
    runtimeConfig,
    workspacePath,
    bootstrapCommands,
  };
}

export async function requestRepositoryInstall(owner: string, name: string) {
  const repository = await findRepositoryByOwnerAndName(owner, name);

  if (!repository) {
    throw new Error(`Repository ${owner}/${name} was not found in local storage.`);
  }

  const runtimeConfig = await getWorkbenchRuntimeConfig();
  const baseTmuxTarget = resolveTmuxTarget({
    defaultTmuxSession: runtimeConfig.tmux.session,
    defaultTmuxWindow: runtimeConfig.tmux.window,
    defaultTmuxPane: runtimeConfig.tmux.pane,
  });
  const { workspacePath, bootstrapCommands } = await resolveBootstrapForRepository(
    repository.id,
    repository.name,
  );

  if (!workspacePath) {
    throw new Error("Project root path is not configured for install workflow.");
  }
  const promptText = buildInstallPrompt(
    runtimeConfig.prompts.install,
    {
      fullName: repository.fullName,
      repoUrl: repository.repoUrl,
    },
    workspacePath,
  );

  const job = await createInstallJob({
    repositoryId: repository.id,
    promptText,
    targetTmuxSession: baseTmuxTarget.session,
    targetTmuxWindow: `install-${repository.name}-${Date.now().toString(36)}`,
    targetTmuxPane: null,
  });
  const tmuxTarget = {
    session: job.targetTmuxSession ?? baseTmuxTarget.session,
    window: job.targetTmuxWindow,
    pane: null,
  };
  const latestLocalProject = await findLatestLocalProjectForRepository(repository.id);

  await upsertLocalProject({
    projectPath: workspacePath,
    rootPath:
      latestLocalProject?.rootPath ??
      runtimeConfig.projectRootPath ??
      path.dirname(workspacePath),
    detectedName: repository.name,
    repositoryId: repository.id,
    gitRemoteUrl: repository.repoUrl,
    cloneStatus: latestLocalProject?.cloneStatus ?? LocalCloneStatus.discovered,
    installStatus: LocalInstallStatus.pending,
    lastScannedAt: latestLocalProject?.lastScannedAt ?? new Date(),
    lastInstalledAt: latestLocalProject?.lastInstalledAt ?? null,
  });
  try {
    await ensureTmuxTargetExists(tmuxTarget);
    await dispatchToTmux(tmuxTarget, "clear");
    for (const command of bootstrapCommands) {
      await dispatchToTmux(tmuxTarget, command);
    }
    return markInstallJobProcessing(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown install dispatch error.";
    await finalizeInstallJob(job.id, "failed", null, message);
    throw error;
  }
}

export async function reopenInstallJob(jobId: string) {
  const job = await getInstallJob(jobId);
  if (!job || !job.repository || !job.targetTmuxSession) {
    throw new Error("Install job or tmux target is unavailable for reopen.");
  }

  const tmuxTarget = {
    session: job.targetTmuxSession,
    window: job.targetTmuxWindow,
    pane: job.targetTmuxPane,
  };

  const { bootstrapCommands } = await resolveBootstrapForRepository(job.repository.id, job.repository.name);

  await restartTmuxTarget(tmuxTarget);
  await dispatchToTmux(tmuxTarget, "clear");
  for (const command of bootstrapCommands) {
    await dispatchToTmux(tmuxTarget, command);
  }

  return resetInstallJob(job.id);
}
