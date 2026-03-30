import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { rerenderReadmeAction } from "./actions";
import { ContentShell } from "@/components/content-shell";
import { ReadmeViewer } from "@/components/readme-viewer";
import { ViewSwitch } from "@/components/view-switch";
import { requestRepositoryInstallAction } from "@/app/actions/install";
import { formatCompactNumber } from "@/lib/format";
import { getRepositoryDetailModel } from "@/lib/server/repo-detail";
import { findRepositoryByOwnerAndName } from "@/lib/server/repositories";
import { syncTrendingRepositories } from "@/lib/server/trending";

export const dynamic = "force-dynamic";

type RepoRouteParams = {
  owner: string;
  name: string;
};

type RepoPageProps = {
  params: Promise<RepoRouteParams>;
};

async function resolveRepository(owner: string, name: string) {
  const existingRepository = await findRepositoryByOwnerAndName(owner, name);

  if (existingRepository) {
    return existingRepository;
  }

  try {
    await syncTrendingRepositories();
  } catch (error) {
    console.error(`Failed to sync trending repositories while resolving ${owner}/${name}.`, error);
  }

  return findRepositoryByOwnerAndName(owner, name);
}

export async function generateMetadata({ params }: RepoPageProps): Promise<Metadata> {
  const { owner, name } = await params;
  const repository = await resolveRepository(owner, name);

  if (!repository) {
    return {
      title: "项目未找到",
    };
  }

  return {
    title: `${repository.fullName} · 中文 Trending 工作台`,
    description: repository.descriptionZh ?? repository.descriptionOriginal ?? repository.fullName,
  };
}

export default async function RepoDetailPage({ params }: RepoPageProps) {
  const { owner, name } = await params;
  const repository = await resolveRepository(owner, name);

  if (!repository) {
    notFound();
  }

  const detailModel = await getRepositoryDetailModel(repository);

  return (
    <ContentShell
      title={repository.fullName}
      actions={
        <ViewSwitch
          items={[
            { href: "/", label: "返回趋势列表", active: true },
            { href: "/projects", label: "我的项目" },
            { href: "/settings", label: "设置" },
          ]}
        />
      }
    >
      <section className="grid gap-[var(--space-6)]">
        <section className="panel px-[var(--space-6)] py-[var(--space-5)] sm:px-[var(--space-8)]">
          <div className="flex flex-col gap-[var(--space-4)] lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-[var(--space-3)]">
              <div className="flex flex-wrap items-center gap-x-[var(--space-5)] gap-y-[var(--space-2)] text-[length:var(--text-meta)] text-[var(--color-fg-muted)]">
                <span className="inline-flex items-center gap-[var(--space-2)]">
                  <span className="language-dot" />
                  {repository.language ?? "未知语言"}
                </span>
                <span>★ {formatCompactNumber(repository.stars)}</span>
                <span>⑂ {formatCompactNumber(repository.forks)}</span>
                <span>默认分支 {repository.defaultBranch ?? "未知"}</span>
                <a
                  href={repository.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-accent-fg)] hover:underline"
                >
                  GitHub 仓库
                </a>
              </div>
            </div>

            <div className="flex flex-wrap gap-[var(--space-3)] lg:justify-end">
              <form action={requestRepositoryInstallAction}>
                <input type="hidden" name="owner" value={repository.owner} />
                <input type="hidden" name="name" value={repository.name} />
                <button type="submit" className="primary-button">
                  安装
                </button>
              </form>
              <Link href="/projects" className="secondary-button">
                查看我的项目
              </Link>
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)] border-b border-[var(--color-border-muted)] bg-[var(--color-canvas-subtle)] px-[var(--space-6)] py-[var(--space-4)] sm:px-[var(--space-8)]">
            <h2 className="text-[length:var(--text-subtitle)] font-semibold text-[var(--color-fg-default)]">
              中文 README
            </h2>
            <form action={rerenderReadmeAction}>
              <input type="hidden" name="repositoryId" value={repository.id} />
              <input type="hidden" name="owner" value={repository.owner} />
              <input type="hidden" name="name" value={repository.name} />
              <button type="submit" className="secondary-button">
                重新渲染
              </button>
            </form>
          </div>
          <div className="px-[var(--space-6)] py-[var(--space-6)] sm:px-[var(--space-8)] sm:py-[var(--space-8)]">
            <ReadmeViewer
              markdown={detailModel.readme.zhMarkdown}
              repository={{
                repoUrl: repository.repoUrl,
                defaultBranch: repository.defaultBranch,
              }}
            />
          </div>
        </section>

        <details className="panel px-[var(--space-6)] py-[var(--space-6)] sm:px-[var(--space-8)]">
          <summary className="cursor-pointer text-[length:var(--text-subtitle)] font-semibold text-[var(--color-fg-default)]">
            查看原文 README
          </summary>
          <div className="mt-[var(--space-6)]">
            <ReadmeViewer
              markdown={detailModel.readme.originalMarkdown}
              repository={{
                repoUrl: repository.repoUrl,
                defaultBranch: repository.defaultBranch,
              }}
            />
          </div>
        </details>
      </section>
    </ContentShell>
  );
}
