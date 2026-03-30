import {
  TranslationStatus,
  type Prisma,
  type Repository,
} from "@/lib/server/prisma-client";
import { prisma } from "@/lib/server/db";

export type RepositoryRecordInput = {
  owner: string;
  name: string;
  repoUrl: string;
  descriptionOriginal?: string | null;
  descriptionZh?: string | null;
  descriptionTranslationStatus?: TranslationStatus;
  language?: string | null;
  stars?: number;
  forks?: number;
  starsToday?: number;
  starsThisWeek?: number;
  starsThisMonth?: number;
  homepageUrl?: string | null;
  defaultBranch?: string | null;
  trendingRank?: number | null;
  trendingRankWeekly?: number | null;
  trendingRankMonthly?: number | null;
  lastSyncedAt?: Date;
};

function normalizeRequiredString(value: string) {
  return value.trim();
}

export function buildRepositoryIdentity(owner: string, name: string) {
  const normalizedOwner = normalizeRequiredString(owner);
  const normalizedName = normalizeRequiredString(name);

  return {
    owner: normalizedOwner,
    name: normalizedName,
    fullName: `${normalizedOwner}/${normalizedName}`,
  };
}

export function buildRepositoryUpsertInput(input: RepositoryRecordInput): Prisma.RepositoryUpsertArgs {
  const identity = buildRepositoryIdentity(input.owner, input.name);
  const descriptionTranslationStatus =
    input.descriptionTranslationStatus ?? TranslationStatus.pending;

  const sharedData: Prisma.RepositoryUncheckedCreateInput = {
    ...identity,
    repoUrl: input.repoUrl,
    descriptionOriginal: input.descriptionOriginal ?? null,
    descriptionZh: input.descriptionZh ?? null,
    descriptionTranslationStatus,
    language: input.language ?? null,
    stars: input.stars ?? 0,
    forks: input.forks ?? 0,
    starsToday: input.starsToday ?? 0,
    starsThisWeek: input.starsThisWeek ?? 0,
    starsThisMonth: input.starsThisMonth ?? 0,
    homepageUrl: input.homepageUrl ?? null,
    defaultBranch: input.defaultBranch ?? null,
    trendingRank: input.trendingRank ?? null,
    trendingRankWeekly: input.trendingRankWeekly ?? null,
    trendingRankMonthly: input.trendingRankMonthly ?? null,
    lastSyncedAt: input.lastSyncedAt,
  };

  return {
    where: { fullName: identity.fullName },
    create: sharedData,
    update: sharedData,
  };
}

export async function upsertRepositories(inputs: RepositoryRecordInput[]) {
  const operations = inputs.map((input) => prisma.repository.upsert(buildRepositoryUpsertInput(input)));
  return prisma.$transaction(operations);
}

export async function listRepositories(period: "daily" | "weekly" | "monthly" = "daily") {
  const repositories = await prisma.repository.findMany();

  const getRank = (repository: Repository) => {
    if (period === "weekly") {
      return repository.trendingRankWeekly;
    }

    if (period === "monthly") {
      return repository.trendingRankMonthly;
    }

    return repository.trendingRank;
  };

  return repositories
    .filter((repository) => getRank(repository) !== null)
    .sort((left, right) => {
      const leftRank = getRank(left) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = getRank(right) ?? Number.MAX_SAFE_INTEGER;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      if (left.stars !== right.stars) {
        return right.stars - left.stars;
      }

      return left.fullName.localeCompare(right.fullName);
    });
}

export async function findRepositoryByOwnerAndName(owner: string, name: string): Promise<Repository | null> {
  const identity = buildRepositoryIdentity(owner, name);

  return prisma.repository.findUnique({
    where: {
      owner_name: {
        owner: identity.owner,
        name: identity.name,
      },
    },
  });
}
