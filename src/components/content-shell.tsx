import type { ReactNode } from "react";

type ContentShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function ContentShell({
  eyebrow,
  title,
  description,
  actions,
  children,
}: ContentShellProps) {
  return (
    <main className="page-shell">
      <section className="flex flex-col gap-[var(--space-5)]">
        <div className="flex flex-col gap-[var(--space-3)] lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-[var(--space-2)]">
            {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
            <div className="flex flex-col gap-[var(--space-2)]">
              <h1 className="text-[length:var(--text-display)] font-semibold tracking-[var(--tracking-tight)] text-[var(--color-fg-default)]">
                {title}
              </h1>
              {description ? (
                <p className="max-w-[46rem] text-[length:var(--text-body)] leading-7 text-[var(--color-fg-muted)]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap gap-[var(--space-3)]">{actions}</div> : null}
        </div>
        {children}
      </section>
    </main>
  );
}
