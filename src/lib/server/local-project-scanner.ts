import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  LocalCloneStatus,
  LocalInstallStatus,
  type Repository,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/server/db";
import { upsertLocalProject } from "@/lib/server/local-projects";

export type ParsedGitRemote = {
  host: string;
  owner: string;
  name: string;
  normalizedUrl: string;
};

export function parseGitRemoteUrl(remoteUrl: string): ParsedGitRemote | null {
  const scpMatch = remoteUrl.match(/^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/i);

  if (scpMatch) {
    return {
      host: scpMatch[1].toLowerCase(),
      owner: scpMatch[2],
      name: scpMatch[3],
      normalizedUrl: `https://${scpMatch[1].toLowerCase()}/${scpMatch[2]}/${scpMatch[3]}`,
    };
  }

  try {
    const url = new URL(remoteUrl);
    const pathParts = url.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");

    if (pathParts.length < 2) {
      return null;
    }

    return {
      host: url.hostname.toLowerCase(),
      owner: pathParts[0],
      name: pathParts[1],
      normalizedUrl: `https://${url.hostname.toLowerCase()}/${pathParts[0]}/${pathParts[1]}`,
    };
  } catch {
    return null;
  }
}

export function extractGitHubRepositoryIdentity(remoteUrl: string) {
  const parsed = parseGitRemoteUrl(remoteUrl);

  if (!parsed || parsed.host !== "github.com") {
    return null;
  }

  return {
    owner: parsed.owner,
    name: parsed.name,
    fullName: `${parsed.owner}/${parsed.name}`,
  };
}

async function findGitRemoteUrl(projectPath: string) {
  const configPath = path.join(projectPath, ".git", "config");
  const config = await readFile(configPath, "utf8");
  const originMatch = config.match(/\[remote\s+"origin"\][\s\S]*?url\s*=\s*(.+)/i);

  return originMatch?.[1]?.trim() ?? null;
}

async function listCandidateProjectPaths(rootPath: string) {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());

  const projectPaths: string[] = [];

  for (const directory of directories) {
    const projectPath = path.join(rootPath, directory.name);
    const gitPath = path.join(projectPath, ".git");

    const gitStats = await stat(gitPath).catch(() => null);

    if (gitStats?.isDirectory()) {
      projectPaths.push(projectPath);
    }
  }

  return projectPaths;
}

async function matchRepository(remoteUrl: string | null): Promise<Repository | null> {
  const identity = remoteUrl ? extractGitHubRepositoryIdentity(remoteUrl) : null;

  if (!identity) {
    return null;
  }

  return prisma.repository.findUnique({
    where: { fullName: identity.fullName },
  });
}

export async function scanLocalProjects(rootPath: string) {
  const projectPaths = await listCandidateProjectPaths(rootPath);
  const projectPathSet = new Set(projectPaths);
  const existingProjects = await prisma.localProject.findMany({
    where: { rootPath },
  });

  const projects = [];

  for (const projectPath of projectPaths) {
    const detectedName = path.basename(projectPath);
    const gitRemoteUrl = await findGitRemoteUrl(projectPath);
    const repository = await matchRepository(gitRemoteUrl);

    projects.push(
      await upsertLocalProject({
        projectPath,
        rootPath,
        detectedName,
        repositoryId: repository?.id ?? null,
        gitRemoteUrl,
        cloneStatus: LocalCloneStatus.cloned,
        installStatus: LocalInstallStatus.unknown,
        lastScannedAt: new Date(),
      }),
    );
  }

  for (const existingProject of existingProjects) {
    if (projectPathSet.has(existingProject.projectPath)) {
      continue;
    }

    projects.push(
      await upsertLocalProject({
        projectPath: existingProject.projectPath,
        rootPath: existingProject.rootPath,
        detectedName: existingProject.detectedName,
        repositoryId: existingProject.repositoryId,
        gitRemoteUrl: existingProject.gitRemoteUrl,
        cloneStatus: LocalCloneStatus.missing,
        installStatus: existingProject.installStatus,
        lastScannedAt: new Date(),
        lastInstalledAt: existingProject.lastInstalledAt,
      }),
    );
  }

  return projects;
}
