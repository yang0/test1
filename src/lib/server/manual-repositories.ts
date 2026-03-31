import { TranslationStatus, type Repository } from "@/lib/server/prisma-client";

import { fetchExternal } from "@/lib/server/http";
import { extractGitHubRepositoryIdentity } from "@/lib/server/local-project-scanner";
import { findRepositoryByOwnerAndName, upsertRepositories } from "@/lib/server/repositories";
import { translateShortTextToChinese } from "@/lib/server/translation";

type GitHubRepositoryPayload = {
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  homepage?: string | null;
  default_branch?: string | null;
};

type ManualRepositoryDependencies = {
  fetchExternal: typeof fetchExternal;
  translateShortTextToChinese: typeof translateShortTextToChinese;
};

export async function fetchGitHubRepositoryMetadata(
  repositoryUrl: string,
  dependencies: ManualRepositoryDependencies = {
    fetchExternal,
    translateShortTextToChinese,
  },
) {
  const identity = extractGitHubRepositoryIdentity(repositoryUrl);

  if (!identity) {
    throw new Error("Only GitHub repository URLs are supported.");
  }

  const response = await dependencies.fetchExternal(
    `https://api.github.com/repos/${identity.owner}/${identity.name}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "chinese-trending-workbench/0.1",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch repository metadata: ${response.status}`);
  }

  const payload = (await response.json()) as GitHubRepositoryPayload;
  const descriptionOriginal = payload.description?.trim() || null;

  return {
    identity,
    repositoryRecord: {
      owner: identity.owner,
      name: identity.name,
      repoUrl: `https://github.com/${identity.owner}/${identity.name}`,
      descriptionOriginal,
      descriptionZh: descriptionOriginal
        ? await dependencies.translateShortTextToChinese(descriptionOriginal)
        : null,
      descriptionTranslationStatus: descriptionOriginal ? TranslationStatus.done : TranslationStatus.pending,
      language: payload.language ?? null,
      stars: payload.stargazers_count ?? 0,
      forks: payload.forks_count ?? 0,
      homepageUrl: payload.homepage?.trim() || null,
      defaultBranch: payload.default_branch ?? null,
      trendingRank: null,
      trendingRankWeekly: null,
      trendingRankMonthly: null,
      starsToday: 0,
      starsThisWeek: 0,
      starsThisMonth: 0,
      lastSyncedAt: new Date(),
    },
  };
}

export async function addRepositoryByUrl(repositoryUrl: string): Promise<Repository> {
  const { identity, repositoryRecord } = await fetchGitHubRepositoryMetadata(repositoryUrl);

  await upsertRepositories([repositoryRecord]);

  const repository = await findRepositoryByOwnerAndName(identity.owner, identity.name);

  if (!repository) {
    throw new Error(`Repository ${identity.fullName} was not found after upsert.`);
  }

  return repository;
}
