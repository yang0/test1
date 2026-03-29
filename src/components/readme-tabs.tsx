"use client";

import { useState } from "react";

import { ReadmeViewer } from "./readme-viewer";

type ReadmeTabsProps = {
  zhMarkdown: string;
  originalMarkdown: string;
};

export function ReadmeTabs({ zhMarkdown, originalMarkdown }: ReadmeTabsProps) {
  const [activeTab, setActiveTab] = useState<"zh" | "original">("zh");

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)] border-b border-[var(--color-border-muted)] bg-[var(--color-canvas-subtle)] px-[var(--space-6)] py-[var(--space-4)] sm:px-[var(--space-8)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <button
            type="button"
            className="tab-button"
            data-active={activeTab === "zh" ? "true" : "false"}
            onClick={() => setActiveTab("zh")}
          >
            中文 README
          </button>
          <button
            type="button"
            className="tab-button"
            data-active={activeTab === "original" ? "true" : "false"}
            onClick={() => setActiveTab("original")}
          >
            原文 README
          </button>
        </div>
        <span className="text-[length:var(--text-caption)] text-[var(--color-fg-muted)]">
          当前阶段仅展示本地假数据缓存
        </span>
      </div>
      <div className="px-[var(--space-6)] py-[var(--space-6)] sm:px-[var(--space-8)] sm:py-[var(--space-8)]">
        <ReadmeViewer markdown={activeTab === "zh" ? zhMarkdown : originalMarkdown} />
      </div>
    </section>
  );
}
