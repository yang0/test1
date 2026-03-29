import { ContentShell } from "@/components/content-shell";
import { ProjectRow } from "@/components/project-row";
import { ViewSwitch } from "@/components/view-switch";
import { listLocalProjects } from "@/lib/server/local-projects";
import { getAppSettings } from "@/lib/server/settings";

import { saveProjectRootAction, scanProjectsAction } from "./actions";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null) {
  return value ? value.toLocaleString("zh-CN") : "尚未安装";
}

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

function mapInstallStatus(status: "unknown" | "pending" | "installed" | "failed") {
  switch (status) {
    case "installed":
      return "已安装";
    case "pending":
      return "安装中";
    case "failed":
      return "安装失败";
    default:
      return "待安装";
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
      installStatusLabel: mapInstallStatus(project.installStatus),
      lastInstalledAtLabel: formatDateTime(project.lastInstalledAt),
      sourceLabel: project.repository ? "已匹配 Trending 仓库" : "本地扫描发现",
      note: project.repository
        ? "已根据远端地址匹配到仓库记录，后续可继续接入安装任务与状态回写。"
        : "当前项目来自本地扫描结果，尚未匹配到已同步的 Trending 仓库。",
    })),
  };
}

export default async function ProjectsPage() {
  const { settings, projects } = await getProjectsPageData();

  return (
    <ContentShell
      eyebrow="本地配置与扫描结果"
      title="我的项目"
      description="这一页已经切到真实数据库读取：根目录来自应用设置，本地项目列表来自扫描元数据。保存设置、刷新扫描和重新安装会在后续步骤接入真实动作。"
      actions={
        <ViewSwitch
          items={[
            { href: "/", label: "趋势仓库" },
            { href: "/projects", label: "我的项目", active: true },
          ]}
        />
      }
    >
      <section className="grid gap-[var(--space-6)]">
        <div className="panel grid gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-6)] sm:px-[var(--space-8)]">
          <div className="flex flex-col gap-[var(--space-2)]">
            <h2 className="text-[length:var(--text-title)] font-semibold text-[var(--color-fg-default)]">
              项目根目录
            </h2>
            <p className="text-[length:var(--text-body-compact)] leading-7 text-[var(--color-fg-muted)]">
              当前显示真实设置值。后续会把这里继续接成可保存配置与可执行扫描入口。
            </p>
          </div>
          <div className="grid gap-[var(--space-3)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <form action={saveProjectRootAction} className="panel grid gap-[var(--space-3)] bg-[var(--color-canvas-subtle)] px-[var(--space-4)] py-[var(--space-4)] shadow-none">
              <label className="grid gap-[var(--space-2)]">
                <span className="text-[length:var(--text-kicker)] font-medium text-[var(--color-fg-subtle)]">默认根目录</span>
                <input
                  type="text"
                  name="projectRootPath"
                  defaultValue={settings.projectRootPath ?? ""}
                  placeholder="例如：E:/workspace/oss-lab"
                  className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-[var(--space-3)] py-[var(--space-3)] font-mono text-[length:var(--text-code)] text-[var(--color-fg-default)] outline-none focus:border-[var(--color-accent-emphasis)]"
                />
              </label>
              <div>
                <button type="submit" className="primary-button">
                  保存设置
                </button>
              </div>
            </form>
            <div className="flex flex-wrap gap-[var(--space-3)]">
              <form action={scanProjectsAction}>
                <button type="submit" className="secondary-button" disabled={!settings.projectRootPath}>
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
            {projects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </div>
        </section>
      </section>
    </ContentShell>
  );
}
