import { TranslationStatus } from "@/lib/server/prisma-client";
import { fetchExternal } from "@/lib/server/http";
import {
  type RepositoryRecordInput,
  upsertRepositories,
} from "@/lib/server/repositories";
import { translateShortTextToChinese } from "@/lib/server/translation";

export const TRENDING_PERIODS = ["daily", "weekly", "monthly"] as const;

export type TrendingPeriod = (typeof TRENDING_PERIODS)[number];

export type ParsedTrendingRepository = Omit<RepositoryRecordInput, "descriptionZh"> & {
  descriptionOriginal: string;
};

export type TrendingPeriodBatch = {
  period: TrendingPeriod;
  repositories: RepositoryRecordInput[];
};

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripHtml(text: string) {
  return decodeHtml(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parseCompactNumber(text: string) {
  const normalized = text.replace(/,/g, "").trim();
  const value = Number(normalized);

  return Number.isFinite(value) ? value : 0;
}

export function parseTrendingRepositoriesFromHtml(html: string): ParsedTrendingRepository[] {
  const matches = [...html.matchAll(/<article[\s\S]*?<\/article>/g)];

  return matches.flatMap((match, index) => {
    const article = match[0];
    const hrefMatch = article.match(/<h2[\s\S]*?<a[^>]+href="\/([^/]+)\/([^"/]+)"/i);

    if (!hrefMatch) {
      return [];
    }

    const owner = hrefMatch[1]?.trim();
    const name = hrefMatch[2]?.trim();

    if (!owner || !name) {
      return [];
    }

    const descriptionMatch = article.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const languageMatch = article.match(/itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/i);
    const numericLinks = [...article.matchAll(/<a[^>]+href="[^"]+\/(?:stargazers|forks)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const starsTodayMatch = article.match(/>([\d,]+)\s+stars(?: today| this week| this month)?</i);

    return [
      {
        owner,
        name,
        repoUrl: `https://github.com/${owner}/${name}`,
        descriptionOriginal: descriptionMatch ? stripHtml(descriptionMatch[1]) : "",
        language: languageMatch ? stripHtml(languageMatch[1]) : null,
        stars: parseCompactNumber(stripHtml(numericLinks[0]?.[1] ?? "0")),
        forks: parseCompactNumber(stripHtml(numericLinks[1]?.[1] ?? "0")),
        starsToday: parseCompactNumber(starsTodayMatch?.[1] ?? "0"),
        homepageUrl: null,
        defaultBranch: null,
        trendingRank: index + 1,
        lastSyncedAt: new Date(),
      },
    ];
  });
}

export async function normalizeTrendingRepositories(
  repositories: ParsedTrendingRepository[],
  translateShortText: (text: string) => Promise<string> = translateShortTextToChinese,
) {
  const normalized: RepositoryRecordInput[] = [];

  for (const repository of repositories) {
    normalized.push({
      ...repository,
      descriptionZh: repository.descriptionOriginal
        ? await translateShortText(repository.descriptionOriginal)
        : null,
      descriptionTranslationStatus: repository.descriptionOriginal
        ? TranslationStatus.done
        : TranslationStatus.pending,
    });
  }

  return normalized;
}

export function mergeTrendingRepositoriesByPeriod(batches: TrendingPeriodBatch[]) {
  const merged = new Map<string, RepositoryRecordInput>();

  for (const batch of batches) {
    for (const repository of batch.repositories) {
      const repositoryKey = `${repository.owner}/${repository.name}`;
      const existing = merged.get(repositoryKey);
      const base: RepositoryRecordInput = existing ?? {
        owner: repository.owner,
        name: repository.name,
        repoUrl: repository.repoUrl,
        descriptionOriginal: repository.descriptionOriginal,
        descriptionZh: repository.descriptionZh,
        descriptionTranslationStatus: repository.descriptionTranslationStatus,
        language: repository.language,
        stars: repository.stars,
        forks: repository.forks,
        homepageUrl: repository.homepageUrl,
        defaultBranch: repository.defaultBranch,
        lastSyncedAt: repository.lastSyncedAt,
        starsToday: 0,
        starsThisWeek: 0,
        starsThisMonth: 0,
        trendingRank: null,
        trendingRankWeekly: null,
        trendingRankMonthly: null,
      };

      base.descriptionOriginal = repository.descriptionOriginal ?? base.descriptionOriginal;
      base.descriptionZh = repository.descriptionZh ?? base.descriptionZh;
      base.descriptionTranslationStatus = repository.descriptionTranslationStatus ?? base.descriptionTranslationStatus;
      base.language = repository.language ?? base.language;
      base.stars = repository.stars ?? base.stars;
      base.forks = repository.forks ?? base.forks;
      base.homepageUrl = repository.homepageUrl ?? base.homepageUrl;
      base.defaultBranch = repository.defaultBranch ?? base.defaultBranch;
      base.lastSyncedAt = repository.lastSyncedAt ?? base.lastSyncedAt;

      if (batch.period === "daily") {
        base.trendingRank = repository.trendingRank ?? null;
        base.starsToday = repository.starsToday ?? 0;
      }

      if (batch.period === "weekly") {
        base.trendingRankWeekly = repository.trendingRank ?? null;
        base.starsThisWeek = repository.starsToday ?? 0;
      }

      if (batch.period === "monthly") {
        base.trendingRankMonthly = repository.trendingRank ?? null;
        base.starsThisMonth = repository.starsToday ?? 0;
      }

      merged.set(`${base.owner}/${base.name}`, base);
    }
  }

  return [...merged.values()];
}

export async function fetchTrendingRepositoriesHtml(period: TrendingPeriod = "daily") {
  const response = await fetchExternal(`https://github.com/trending?since=${period}`, {
    headers: {
      "User-Agent": "chinese-trending-workbench/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub Trending: ${response.status}`);
  }

  return response.text();
}

export async function syncTrendingRepositories() {
  const translationCache = new Map<string, string>();
  const translateWithCache = async (text: string) => {
    const cached = translationCache.get(text);
    if (cached) {
      return cached;
    }

    const translated = await translateShortTextToChinese(text);
    translationCache.set(text, translated);
    return translated;
  };

  const periodBatches = await Promise.all(
    TRENDING_PERIODS.map(async (period) => {
      const html = await fetchTrendingRepositoriesHtml(period);
      const parsedRepositories = parseTrendingRepositoriesFromHtml(html);
      const normalizedRepositories = await normalizeTrendingRepositories(
        parsedRepositories,
        translateWithCache,
      );

      return {
        period,
        repositories: normalizedRepositories,
      } satisfies TrendingPeriodBatch;
    }),
  );

  const normalizedRepositories = mergeTrendingRepositoriesByPeriod(periodBatches);

  await upsertRepositories(normalizedRepositories);

  return {
    repositories: normalizedRepositories,
    periods: Object.fromEntries(periodBatches.map((batch) => [batch.period, batch.repositories.length])),
  };
}
