import { ContentShell } from "@/components/content-shell";
import { ViewSwitch } from "@/components/view-switch";
import {
  DEFAULT_AGENT_LAUNCH_COMMAND,
  DEFAULT_INSTALL_PROMPT_TEMPLATE,
  DEFAULT_TRANSLATION_PROMPT_TEMPLATE,
  getAppSettings,
} from "@/lib/server/settings";

import { saveWorkbenchSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

const fieldClassName =
  "rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] px-[var(--space-3)] py-[var(--space-3)] text-[length:var(--text-body)] text-[var(--color-fg-default)] outline-none focus:border-[var(--color-accent-fg)]";

const codeFieldClassName = `${fieldClassName} font-mono text-[length:var(--text-code)]`;

const textareaClassName = `${fieldClassName} min-h-[9rem] resize-y leading-7`;

export default async function SettingsPage() {
  const settings = await getAppSettings();

  return (
    <ContentShell
      eyebrow="应用配置"
      title="设置"
      description="集中管理本地仓库根目录、编码代理启动命令和提示词模板。项目扫描页只保留扫描与结果查看。"
      actions={
        <ViewSwitch
          items={[
            { href: "/", label: "趋势仓库" },
            { href: "/projects", label: "我的项目" },
            { href: "/settings", label: "设置", active: true },
          ]}
        />
      }
    >
      <form action={saveWorkbenchSettingsAction} className="grid gap-[var(--space-6)]">
        <section className="panel grid gap-[var(--space-5)] px-[var(--space-6)] py-[var(--space-6)] sm:px-[var(--space-8)]">
          <div className="flex flex-col gap-[var(--space-2)]">
            <h2 className="text-[length:var(--text-title)] font-semibold text-[var(--color-fg-default)]">
              仓库根目录
            </h2>
            <p className="max-w-[42rem] text-[length:var(--text-body-compact)] leading-7 text-[var(--color-fg-muted)]">
              本地项目扫描与安装目录推导都会基于这里的默认根路径。
            </p>
          </div>
          <label className="grid gap-[var(--space-2)]">
            <span className="text-[length:var(--text-kicker)] font-medium text-[var(--color-fg-subtle)]">
              默认仓库根目录
            </span>
            <input
              type="text"
              name="projectRootPath"
              defaultValue={settings.projectRootPath ?? ""}
              placeholder="例如：E:/workspace/oss-lab"
              className={codeFieldClassName}
            />
          </label>
        </section>

        <section className="panel grid gap-[var(--space-5)] px-[var(--space-6)] py-[var(--space-6)] sm:px-[var(--space-8)]">
          <div className="flex flex-col gap-[var(--space-2)]">
            <h2 className="text-[length:var(--text-title)] font-semibold text-[var(--color-fg-default)]">
              编码代理启动
            </h2>
            <p className="max-w-[42rem] text-[length:var(--text-body-compact)] leading-7 text-[var(--color-fg-muted)]">
              设置 tmux 窗口内执行的默认命令，并保留默认 session / window / pane 目标，便于后续安装任务直接复用。
            </p>
          </div>

          <label className="grid gap-[var(--space-2)]">
            <span className="text-[length:var(--text-kicker)] font-medium text-[var(--color-fg-subtle)]">启动命令</span>
            <textarea
              name="agentLaunchCommand"
              defaultValue={settings.agentLaunchCommand ?? DEFAULT_AGENT_LAUNCH_COMMAND}
              placeholder={DEFAULT_AGENT_LAUNCH_COMMAND}
              className={`${textareaClassName} font-mono text-[length:var(--text-code)]`}
            />
          </label>

          <div className="grid gap-[var(--space-4)] md:grid-cols-3">
            <label className="grid gap-[var(--space-2)]">
              <span className="text-[length:var(--text-kicker)] font-medium text-[var(--color-fg-subtle)]">
                默认 session
              </span>
              <input
                type="text"
                name="defaultTmuxSession"
                defaultValue={settings.defaultTmuxSession ?? ""}
                placeholder="default"
                className={codeFieldClassName}
              />
            </label>
            <label className="grid gap-[var(--space-2)]">
              <span className="text-[length:var(--text-kicker)] font-medium text-[var(--color-fg-subtle)]">
                默认 window
              </span>
              <input
                type="text"
                name="defaultTmuxWindow"
                defaultValue={settings.defaultTmuxWindow ?? ""}
                placeholder="install"
                className={codeFieldClassName}
              />
            </label>
            <label className="grid gap-[var(--space-2)]">
              <span className="text-[length:var(--text-kicker)] font-medium text-[var(--color-fg-subtle)]">
                默认 pane
              </span>
              <input
                type="text"
                name="defaultTmuxPane"
                defaultValue={settings.defaultTmuxPane ?? ""}
                placeholder="1"
                className={codeFieldClassName}
              />
            </label>
          </div>
        </section>

        <section className="panel grid gap-[var(--space-5)] px-[var(--space-6)] py-[var(--space-6)] sm:px-[var(--space-8)]">
          <div className="flex flex-col gap-[var(--space-2)]">
            <h2 className="text-[length:var(--text-title)] font-semibold text-[var(--color-fg-default)]">
              提示词模板
            </h2>
            <p className="max-w-[42rem] text-[length:var(--text-body-compact)] leading-7 text-[var(--color-fg-muted)]">
              分别维护 README 翻译与安装任务的默认提示词，空值会回退到内置模板。
            </p>
          </div>

          <div className="grid gap-[var(--space-5)]">
            <label className="grid gap-[var(--space-2)]">
              <span className="text-[length:var(--text-kicker)] font-medium text-[var(--color-fg-subtle)]">
                翻译提示词
              </span>
              <textarea
                name="translationPromptTemplate"
                defaultValue={settings.translationPromptTemplate ?? DEFAULT_TRANSLATION_PROMPT_TEMPLATE}
                placeholder={DEFAULT_TRANSLATION_PROMPT_TEMPLATE}
                className={textareaClassName}
              />
            </label>

            <label className="grid gap-[var(--space-2)]">
              <span className="text-[length:var(--text-kicker)] font-medium text-[var(--color-fg-subtle)]">
                安装提示词
              </span>
              <textarea
                name="installPromptTemplate"
                defaultValue={settings.installPromptTemplate ?? DEFAULT_INSTALL_PROMPT_TEMPLATE}
                placeholder={DEFAULT_INSTALL_PROMPT_TEMPLATE}
                className={textareaClassName}
              />
            </label>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" className="primary-button">
            保存设置
          </button>
        </div>
      </form>
    </ContentShell>
  );
}
