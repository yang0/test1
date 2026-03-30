import { ContentShell } from "@/components/content-shell";
import { RepoCard } from "@/components/repo-card";
import { ViewSwitch } from "@/components/view-switch";
import {
  normalizeTrendingPeriod,
  type TrendingPeriod,
} from "@/lib/trending-period";
import { listRepositories } from "@/lib/server/repositories";
import { syncTrendingRepositories } from "@/lib/server/trending";

export const dynamic = "force-dynamic";

type HomePageSearchParams = {
  period?: string | string[] | undefined;
};

type HomePageProps = {
  searchParams: Promise<HomePageSearchParams>;
};

function buildReadmePrewarmScript() {
  return `
    (() => {
      let triggered = false;
      const run = () => {
        if (triggered) {
          return;
        }
        triggered = true;
        fetch('/api/readme/prewarm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
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

export default async function HomePage({ searchParams }: HomePageProps) {
  const { period: rawPeriod } = await searchParams;
  const period = normalizeTrendingPeriod(rawPeriod);
  const { repositories } = await getHomePageRepositories(period);
  const lastSyncedAt = repositories[0]?.lastSyncedAt;

  return (
    <ContentShell title="中文 Trending 仓库">
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-[var(--space-4)] border-b border-[var(--color-border-muted)] bg-[var(--color-canvas-subtle)] px-[var(--space-6)] py-[var(--space-5)] sm:px-[var(--space-8)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col items-start gap-[var(--space-3)] lg:ml-auto lg:items-end">
            <ViewSwitch
              items={[
                { href: "/?period=daily", label: "日", active: period === "daily" },
                { href: "/?period=weekly", label: "周", active: period === "weekly" },
                { href: "/?period=monthly", label: "月", active: period === "monthly" },
              ]}
            />
            <p className="text-[length:var(--text-caption)] text-[var(--color-fg-subtle)]">
              最近同步时间：{lastSyncedAt ? lastSyncedAt.toLocaleString("zh-CN") : "尚未同步"} · 共 {repositories.length} 个项目
            </p>
          </div>
        </div>

        <div>
          <script dangerouslySetInnerHTML={{ __html: buildReadmePrewarmScript() }} />
          {repositories.map((repository) => (
            <RepoCard
              key={repository.fullName}
              repository={{
                ...repository,
                descriptionZh: repository.descriptionZh ?? repository.descriptionOriginal ?? "暂未生成中文简介。",
              }}
              period={period}
            />
          ))}
        </div>
      </section>
    </ContentShell>
  );
}
