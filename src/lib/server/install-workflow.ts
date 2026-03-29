import { LocalCloneStatus } from "@/generated/prisma/client";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/server/db";
import { finishInstallJob, createInstallJob, markInstallJobProcessing } from "@/lib/server/install-jobs";
import { findRepositoryByOwnerAndName } from "@/lib/server/repositories";
import { getWorkbenchRuntimeConfig } from "@/lib/server/settings";
import {
  buildCodexInstallShellCommand,
  dispatchToTmux,
  ensureTmuxTargetExists,
  resolveTmuxTarget,
} from "@/lib/server/tmux";
import {
  buildInstallPrompt,
  getInstallJobArtifactPaths,
  WORKBENCH_APP_ROOT,
} from "@/lib/server/workbench-config";

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

export async function requestRepositoryInstall(owner: string, name: string) {
  const repository = await findRepositoryByOwnerAndName(owner, name);

  if (!repository) {
    throw new Error(`Repository ${owner}/${name} was not found in local storage.`);
  }

  const runtimeConfig = await getWorkbenchRuntimeConfig();
  const tmuxTarget = resolveTmuxTarget({
    defaultTmuxSession: runtimeConfig.tmux.session,
    defaultTmuxWindow: runtimeConfig.tmux.window,
    defaultTmuxPane: runtimeConfig.tmux.pane,
  });
  const workspacePath = await resolveInstallWorkspacePath(
    repository.id,
    repository.name,
    runtimeConfig.projectRootPath,
  );

  if (!workspacePath) {
    throw new Error("Project root path is not configured for install workflow.");
  }

  await mkdir(workspacePath, { recursive: true });

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
    targetTmuxSession: tmuxTarget.session,
    targetTmuxWindow: tmuxTarget.window,
    targetTmuxPane: tmuxTarget.pane,
  });
  const artifactPaths = getInstallJobArtifactPaths(job.id);

  await mkdir(artifactPaths.jobRoot, { recursive: true });

  const finalizeCommand = [
    "cd",
    `'${WORKBENCH_APP_ROOT.replace(/'/g, `'"'"'`)}'`,
    "&&",
    "npx tsx scripts/finalize-install-job.ts",
    "--job-id",
    job.id,
    "--summary-file",
    `'${artifactPaths.summaryFilePath.replace(/'/g, `'"'"'`)}'`,
    "--transcript-file",
    `'${artifactPaths.transcriptFilePath.replace(/'/g, `'"'"'`)}'`,
    "--exit-code",
  ].join(" ");

  const codexCommand = buildCodexInstallShellCommand({
    workspacePath,
    prompt: promptText,
    summaryFilePath: artifactPaths.summaryFilePath,
    transcriptFilePath: artifactPaths.transcriptFilePath,
    finalizeCommand,
  });

  try {
    await ensureTmuxTargetExists(tmuxTarget);
    await dispatchToTmux(tmuxTarget, codexCommand);
    return markInstallJobProcessing(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown install dispatch error.";
    await finishInstallJob(job.id, "failed", null, message);
    throw error;
  }
}
