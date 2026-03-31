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

export type ListAllRepositoriesInput = {
  query?: string;
  page?: number;
  pageSize?: number;
  pinnedFullName?: string;
};

export function filterAndPaginateRepositories(
  repositories: Repository[],
  input: ListAllRepositoriesInput = {},
) {
  const pinnedFullName = input.pinnedFullName?.trim();
  const normalizedQuery = input.query?.trim().toLocaleLowerCase() ?? "";
  const pageSize = Number.isInteger(input.pageSize) && (input.pageSize ?? 0) > 0 ? input.pageSize ?? 20 : 20;
  const requestedPage = Number.isInteger(input.page) && (input.page ?? 0) > 0 ? input.page ?? 1 : 1;

  const filteredRepositories = repositories
    .filter((repository) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        repository.fullName,
        repository.owner,
        repository.name,
        repository.language,
        repository.descriptionZh,
        repository.descriptionOriginal,
      ]
        .filter(Boolean)
        .join("\n")
        .toLocaleLowerCase();

      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => {
      if (left.stars !== right.stars) {
        return right.stars - left.stars;
      }

      return left.fullName.localeCompare(right.fullName);
    });

  if (pinnedFullName) {
    const pinnedIndex = filteredRepositories.findIndex((repository) => repository.fullName === pinnedFullName);

    if (pinnedIndex >= 0) {
      const [pinnedRepository] = filteredRepositories.splice(pinnedIndex, 1);

      if (pinnedRepository) {
        filteredRepositories.unshift(pinnedRepository);
      }
    }
  }

  const total = filteredRepositories.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const startIndex = (page - 1) * pageSize;

  return {
    repositories: filteredRepositories.slice(startIndex, startIndex + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function listAllRepositories(input: ListAllRepositoriesInput = {}) {
  const repositories = await prisma.repository.findMany();
  return filterAndPaginateRepositories(repositories, input);
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
