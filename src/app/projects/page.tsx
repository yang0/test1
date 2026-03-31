import { ContentShell } from "@/components/content-shell";
import { ProjectRow } from "@/components/project-row";
import { listLocalProjects } from "@/lib/server/local-projects";
import { getAppSettings } from "@/lib/server/settings";

import { scanProjectsAction } from "./actions";

export const dynamic = "force-dynamic";

function mapCloneStatus(status: "discovered" | "cloned" | "missing") {
  switch (status) {
    case "cloned":
      return "已克隆";
    case "missing":
      return "目录缺失";
    default:
      return "已发现";
  }
}

async function getProjectsPageData() {
  const [settings, projects] = await Promise.all([getAppSettings(), listLocalProjects()]);

  return {
    settings,
    projects: projects.map((project) => ({
      id: project.id,
      title: project.repository?.fullName ?? project.detectedName,
      repoUrl: project.gitRemoteUrl ?? project.repository?.repoUrl ?? "未匹配远端仓库",
      rootPath: project.rootPath,
      projectPath: project.projectPath,
      cloneStatusLabel: mapCloneStatus(project.cloneStatus),
      sourceLabel: project.repository ? "已匹配 Trending 仓库" : "本地扫描发现",
      note: project.repository
        ? "已根据远端地址匹配到 Trending 仓库记录。"
        : "来自本地扫描结果，暂未匹配到已同步的 Trending 仓库。",
    })),
  };
}

export default async function ProjectsPage() {
  const { settings, projects } = await getProjectsPageData();

  return (
    <ContentShell
      eyebrow="本地项目与扫描结果"
      title="我的项目"
      description="查看当前扫描到的本地项目，并基于已保存的仓库根目录重新扫描。通用配置已集中到独立设置页。"
    >
      <section className="grid gap-[var(--space-6)]">
        <div className="panel grid gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-6)] sm:px-[var(--space-8)]">
          <div className="flex flex-col gap-[var(--space-2)]">
            <h2 className="text-[length:var(--text-title)] font-semibold text-[var(--color-fg-default)]">
              扫描工作区
            </h2>
            <p className="text-[length:var(--text-body-compact)] leading-7 text-[var(--color-fg-muted)]">
              {settings.projectRootPath
                ? "使用当前设置中的默认仓库根目录执行扫描。"
                : "尚未配置默认仓库根目录，请先前往设置页完成配置。"}
            </p>
          </div>
          <div className="grid gap-[var(--space-4)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <dl className="panel grid gap-[var(--space-2)] bg-[var(--color-canvas-subtle)] px-[var(--space-4)] py-[var(--space-4)] shadow-none">
              <div className="grid gap-[var(--space-1)]">
                <dt className="text-[length:var(--text-kicker)] font-medium text-[var(--color-fg-subtle)]">当前根目录</dt>
                <dd className="font-mono text-[length:var(--text-code)] text-[var(--color-fg-default)]">
                  {settings.projectRootPath ?? "未设置"}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-[var(--space-3)]">
              <form action={scanProjectsAction}>
                <button type="submit" className="primary-button" disabled={!settings.projectRootPath}>
                  刷新扫描
                </button>
              </form>
            </div>
          </div>
        </div>

        <section className="panel overflow-hidden">
          <div className="border-b border-[var(--color-border-muted)] bg-[var(--color-canvas-subtle)] px-[var(--space-6)] py-[var(--space-4)] sm:px-[var(--space-8)]">
            <h2 className="text-[length:var(--text-subtitle)] font-semibold text-[var(--color-fg-default)]">
              本地项目列表
            </h2>
          </div>
          <div>
            {projects.length > 0 ? (
              projects.map((project) => <ProjectRow key={project.id} project={project} />)
            ) : (
              <div className="grid gap-[var(--space-3)] px-[var(--space-6)] py-[var(--space-6)] text-[length:var(--text-body)] text-[var(--color-fg-muted)] sm:px-[var(--space-8)]">
                <p>暂未发现本地项目，可先确认根目录配置后重新执行扫描。</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </ContentShell>
  );
}
