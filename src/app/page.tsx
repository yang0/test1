import { ContentShell } from "@/components/content-shell";
import { RepoCard } from "@/components/repo-card";
import { ViewSwitch } from "@/components/view-switch";
import {
  normalizeHomePeriod,
  type HomePeriod,
  type TrendingPeriod,
} from "@/lib/trending-period";
import { listAllRepositories, listRepositories } from "@/lib/server/repositories";
import { syncTrendingRepositories } from "@/lib/server/trending";

export const dynamic = "force-dynamic";
const ALL_REPOSITORIES_PAGE_SIZE = 20;

type HomePageSearchParams = {
  period?: string | string[] | undefined;
  q?: string | string[] | undefined;
  page?: string | string[] | undefined;
};

type HomePageProps = {
  searchParams: Promise<HomePageSearchParams>;
};

function buildReadmePrewarmScript(repositoryIds: string[]) {
  const ids = JSON.stringify(repositoryIds.slice(0, 8));

  return `
    (() => {
      const repositoryIds = ${ids};
      if (!Array.isArray(repositoryIds) || repositoryIds.length === 0) {
        return;
      }

      let triggered = false;
      const run = () => {
        if (triggered) {
          return;
        }
        triggered = true;
        fetch('/api/readme/prewarm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repositoryIds }),
          keepalive: true,
        }).catch(() => undefined);
      };

      const timeoutId = window.setTimeout(run, 1500);
      if (typeof window.requestIdleCallback === 'function') {
        const idleId = window.requestIdleCallback(run);
        window.addEventListener('beforeunload', () => {
          window.clearTimeout(timeoutId);
          if (typeof window.cancelIdleCallback === 'function') {
            window.cancelIdleCallback(idleId);
          }
        }, { once: true });
        return;
      }

      window.addEventListener('beforeunload', () => {
        window.clearTimeout(timeoutId);
      }, { once: true });
    })();
  `;
}

async function getHomePageRepositories(period: TrendingPeriod) {
  let repositories = await listRepositories(period);

  if (repositories.length === 0) {
    try {
      await syncTrendingRepositories();
      repositories = await listRepositories(period);
    } catch (error) {
      console.error("Failed to sync GitHub Trending repositories.", error);
    }
  }

  return { repositories };
}

function normalizeSearchQuery(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.trim() ?? "";
}

function normalizePageNumber(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function buildHomeHref(period: HomePeriod, query = "", page = 1) {
  if (period !== "all") {
    return period === "daily" ? "/?period=daily" : `/?period=${period}`;
  }

  const params = new URLSearchParams({ period: "all" });
  const normalizedQuery = query.trim();
  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }
  if (page > 1) {
    params.set("page", String(page));
  }

  return `/?${params.toString()}`;
}

function buildPaginationWindow(page: number, totalPages: number) {
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { period: rawPeriod, q: rawQuery, page: rawPage } = await searchParams;
  const period = normalizeHomePeriod(rawPeriod);
  const query = normalizeSearchQuery(rawQuery);
  const requestedPage = normalizePageNumber(rawPage);

  const allRepositoriesResult =
    period === "all"
      ? await listAllRepositories({ query, page: requestedPage, pageSize: ALL_REPOSITORIES_PAGE_SIZE })
      : null;
  const defaultRepositoriesResult = period === "all" ? null : await getHomePageRepositories(period);
  const repositories = allRepositoriesResult?.repositories ?? defaultRepositoriesResult?.repositories ?? [];
  const lastSyncedAt = repositories[0]?.lastSyncedAt;
  const paginationWindow = allRepositoriesResult
    ? buildPaginationWindow(allRepositoriesResult.page, allRepositoriesResult.totalPages)
    : [];

  return (
    <ContentShell title="中文 Trending 仓库">
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-[var(--space-4)] border-b border-[var(--color-border-muted)] bg-[var(--color-canvas-subtle)] px-[var(--space-6)] py-[var(--space-5)] sm:px-[var(--space-8)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col items-start gap-[var(--space-3)] lg:ml-auto lg:items-end">
            <ViewSwitch
              items={[
                { href: buildHomeHref("daily"), label: "日", active: period === "daily" },
                { href: buildHomeHref("weekly"), label: "周", active: period === "weekly" },
                { href: buildHomeHref("monthly"), label: "月", active: period === "monthly" },
                { href: buildHomeHref("all"), label: "全部", active: period === "all" },
              ]}
            />
            {period === "all" ? (
              <form action="/" method="get" className="flex w-full flex-col gap-[var(--space-3)] sm:w-auto sm:flex-row sm:items-center">
                <input type="hidden" name="period" value="all" />
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="搜索仓库名、描述或语言"
                  className="min-w-[16rem] rounded-[var(--radius-pill)] border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--text-body-compact)] text-[var(--color-fg-default)] outline-none transition focus:border-[var(--color-accent-emphasis)]"
                />
                <button type="submit" className="secondary-button">
                  搜索
                </button>
              </form>
            ) : null}
            <p className="text-[length:var(--text-caption)] text-[var(--color-fg-subtle)]">
              {allRepositoriesResult
                ? `最近同步时间：${lastSyncedAt ? lastSyncedAt.toLocaleString("zh-CN") : "尚未同步"} · 共 ${allRepositoriesResult.total} 个项目 · 第 ${allRepositoriesResult.page}/${allRepositoriesResult.totalPages} 页`
                : `最近同步时间：${lastSyncedAt ? lastSyncedAt.toLocaleString("zh-CN") : "尚未同步"} · 共 ${repositories.length} 个项目`}
            </p>
          </div>
        </div>

        <div>
          <script dangerouslySetInnerHTML={{ __html: buildReadmePrewarmScript(repositories.map((repository) => repository.id)) }} />
          {allRepositoriesResult && allRepositoriesResult.total === 0 ? (
            <div className="px-[var(--space-6)] py-[var(--space-8)] text-[length:var(--text-body)] text-[var(--color-fg-muted)] sm:px-[var(--space-8)]">
              没有找到符合当前搜索条件的仓库。
            </div>
          ) : null}
          {repositories.map((repository) => (
            <RepoCard
              key={repository.fullName}
              repository={{
                ...repository,
                descriptionZh: repository.descriptionZh ?? repository.descriptionOriginal ?? "暂未生成中文简介。",
              }}
              period={period === "all" ? "daily" : period}
              showTrendMetric={period !== "all"}
            />
          ))}
          {allRepositoriesResult && allRepositoriesResult.totalPages > 1 ? (
            <div className="flex flex-col gap-[var(--space-4)] border-t border-[var(--color-border-muted)] px-[var(--space-6)] py-[var(--space-6)] sm:px-[var(--space-8)] sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[length:var(--text-caption)] text-[var(--color-fg-subtle)]">
                每页 {allRepositoriesResult.pageSize} 条，共 {allRepositoriesResult.total} 条结果。
              </p>
              <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                {allRepositoriesResult.page > 1 ? (
                  <a href={buildHomeHref("all", query, allRepositoriesResult.page - 1)} className="secondary-button">
                    上一页
                  </a>
                ) : null}
                {paginationWindow.map((pageNumber) => (
                  <a
                    key={pageNumber}
                    href={buildHomeHref("all", query, pageNumber)}
                    aria-current={pageNumber === allRepositoriesResult.page ? "page" : undefined}
                    className="segment-item"
                    data-active={pageNumber === allRepositoriesResult.page ? "true" : "false"}
                  >
                    {pageNumber}
                  </a>
                ))}
                {allRepositoriesResult.page < allRepositoriesResult.totalPages ? (
                  <a href={buildHomeHref("all", query, allRepositoriesResult.page + 1)} className="secondary-button">
                    下一页
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </ContentShell>
  );
}
