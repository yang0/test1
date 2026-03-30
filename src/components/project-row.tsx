import { StatusBadge } from "./status-badge";

export type ProjectRowModel = {
  id: string;
  title: string;
  repoUrl: string;
  rootPath: string;
  projectPath: string;
  cloneStatusLabel: string;
  installStatusLabel: string;
  lastInstalledAtLabel: string;
  sourceLabel: string;
  note: string;
};

type ProjectRowProps = {
  project: ProjectRowModel;
};

function getInstallTone(status: string) {
  if (status === "已安装") {
    return "success" as const;
  }

  if (status === "安装中" || status === "最近更新") {
    return "accent" as const;
  }

  return "warning" as const;
}

export function ProjectRow({ project }: ProjectRowProps) {
  return (
    <article className="grid gap-[var(--space-4)] border-b border-[var(--color-border-muted)] px-[var(--space-6)] py-[var(--space-5)] last:border-b-0 sm:px-[var(--space-8)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-start">
      <div className="flex min-w-0 flex-col gap-[var(--space-3)]">
        <div className="flex flex-wrap items-center gap-[var(--space-3)]">
          <h2 className="text-[length:var(--text-subtitle)] font-semibold text-[var(--color-fg-default)]">
            {project.title}
          </h2>
          <StatusBadge tone="neutral">{project.cloneStatusLabel}</StatusBadge>
          <StatusBadge tone={getInstallTone(project.installStatusLabel)}>
            {project.installStatusLabel}
          </StatusBadge>
        </div>
        <p className="text-[length:var(--text-body-compact)] leading-7 text-[var(--color-fg-muted)]">{project.note}</p>
        <dl className="grid gap-[var(--space-2)] text-[length:var(--text-meta)] text-[var(--color-fg-muted)]">
          <div className="grid gap-[var(--space-1)]">
            <dt className="font-medium text-[var(--color-fg-subtle)]">来源仓库</dt>
            <dd>{project.repoUrl}</dd>
          </div>
          <div className="grid gap-[var(--space-1)]">
            <dt className="font-medium text-[var(--color-fg-subtle)]">本地路径</dt>
            <dd className="truncate font-mono text-[length:var(--text-code)] text-[var(--color-fg-default)]">
              {project.projectPath}
            </dd>
          </div>
        </dl>
      </div>

      <dl className="grid gap-[var(--space-3)] text-[length:var(--text-meta)] text-[var(--color-fg-muted)]">
        <div className="grid gap-[var(--space-1)]">
          <dt className="font-medium text-[var(--color-fg-subtle)]">项目根目录</dt>
          <dd className="truncate font-mono text-[length:var(--text-code)] text-[var(--color-fg-default)]">
            {project.rootPath}
          </dd>
        </div>
        <div className="grid gap-[var(--space-1)]">
          <dt className="font-medium text-[var(--color-fg-subtle)]">来源</dt>
          <dd>{project.sourceLabel}</dd>
        </div>
        <div className="grid gap-[var(--space-1)]">
          <dt className="font-medium text-[var(--color-fg-subtle)]">最近安装时间</dt>
          <dd>{project.lastInstalledAtLabel}</dd>
        </div>
      </dl>
    </article>
  );
}
