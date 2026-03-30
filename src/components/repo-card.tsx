import Link from "next/link";

import { formatCompactNumber, sanitizeRepositoryDescription } from "@/lib/format";
import {
  getTrendingMetricLabel,
  getTrendingMetricValue,
  type TrendingPeriod,
} from "@/lib/trending-period";

export type RepositoryCardModel = {
  owner: string;
  name: string;
  fullName: string;
  repoUrl: string;
  descriptionZh: string;
  language: string | null;
  stars: number;
  forks: number;
  starsToday: number;
  starsThisWeek: number;
  starsThisMonth: number;
};

type RepoCardProps = {
  repository: RepositoryCardModel;
  period?: TrendingPeriod;
};

export function RepoCard({ repository, period = "daily" }: RepoCardProps) {
  const trendMetricLabel = getTrendingMetricLabel(period);
  const trendMetricValue = getTrendingMetricValue(period, repository);
  const shouldShowTrendMetric = trendMetricValue > 0;
  const description = sanitizeRepositoryDescription(repository.descriptionZh, repository);

  return (
    <article className="border-b border-[var(--color-border-muted)] px-[var(--space-6)] py-[var(--space-6)] last:border-b-0 sm:px-[var(--space-8)]">
      <div className="flex flex-col gap-[var(--space-4)] lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-4)]">
          <div className="flex flex-col gap-[var(--space-2)]">
            <div className="flex flex-wrap items-center gap-[var(--space-3)]">
              <Link
                href={`/repo/${repository.owner}/${repository.name}`}
                className="repo-card-title text-[length:var(--text-title)] font-semibold text-[var(--color-accent-fg)] hover:underline"
              >
                {repository.owner}
                <span className="text-[var(--color-fg-muted)]"> / </span>
                {repository.name}
              </Link>
            </div>
            <p className="max-w-[44rem] text-[length:var(--text-body)] leading-7 text-[var(--color-fg-muted)]">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-[var(--space-5)] gap-y-[var(--space-3)] text-[length:var(--text-meta)] text-[var(--color-fg-muted)]">
            <span className="inline-flex items-center gap-[var(--space-2)]">
              <span className="language-dot" />
              {repository.language ?? "未知语言"}
            </span>
            <span>★ {formatCompactNumber(repository.stars)}</span>
            <span>⑂ {formatCompactNumber(repository.forks)}</span>
            <a
              href={repository.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-accent-fg)] hover:underline"
            >
              仓库地址
            </a>
            {shouldShowTrendMetric ? (
              <span>
                {trendMetricLabel}
                {formatCompactNumber(trendMetricValue)}
              </span>
            ) : null}
          </div>
        </div>

      </div>
    </article>
  );
}
