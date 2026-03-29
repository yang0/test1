export type TranslationStatus = "done" | "processing" | "failed";

export type TrendingRepository = {
  owner: string;
  name: string;
  fullName: string;
  repoUrl: string;
  descriptionZh: string;
  descriptionOriginal: string;
  language: string;
  stars: number;
  forks: number;
  starsToday: number;
  builtBy: string[];
  topicsZh: string[];
  translationStatus: TranslationStatus;
  homepageUrl?: string;
  defaultBranch: string;
  lastSyncedAt: string;
  readmeZh: string;
  readmeOriginal: string;
  readmeSourceSha: string;
  readmeUpdatedAt: string;
};

export type LocalProject = {
  id: string;
  repositoryFullName: string;
  repoUrl: string;
  rootPath: string;
  projectPath: string;
  cloneStatus: "已克隆" | "待同步";
  installStatus: "已安装" | "待安装" | "最近更新";
  lastInstalledAt: string;
  source: string;
  note: string;
};

export const trendingRepositories: TrendingRepository[] = [
  {
    owner: "anthropic",
    name: "claude-code",
    fullName: "anthropic/claude-code",
    repoUrl: "https://github.com/anthropic/claude-code",
    descriptionZh:
      "面向终端工作流的智能编码助手，强调快速理解仓库结构、执行修改并给出清晰验证结果。",
    descriptionOriginal:
      "A coding assistant for terminal-first workflows that helps developers read, change, and validate code quickly.",
    language: "TypeScript",
    stars: 32481,
    forks: 2814,
    starsToday: 1468,
    builtBy: ["Ada Lovelace", "Linus Torvalds", "Grace Hopper"],
    topicsZh: ["终端代理", "代码理解", "自动化工作流"],
    translationStatus: "done",
    homepageUrl: "https://www.anthropic.com/claude-code",
    defaultBranch: "main",
    lastSyncedAt: "2026-03-28 09:15",
    readmeSourceSha: "a1c94b0",
    readmeUpdatedAt: "2026-03-27 18:40",
    readmeZh: `# Claude Code 中文速览

Claude Code 是一个偏向命令行和本地项目工作流的智能编码助手。它适合在阅读大型仓库、执行多文件改动、整理验证步骤时提供帮助。

## 适合解决的问题

- 快速梳理现有项目结构与关键模块
- 批量完成重命名、修复和样式调整
- 在交付前补齐 lint、类型检查与构建验证

## 本地试用流程

1. 克隆仓库并安装依赖。
2. 在示例项目中运行开发命令，确认工具链可用。
3. 选择一个小范围任务，例如更新页面文案或补充组件状态。

## 示例命令

\`\`\`bash
npm install
npm run dev
\`\`\`

## 为什么放进这个工作台样例

这个项目和“中文 Trending 工作台”的目标很接近：都强调先理解上下文，再做修改，再验证结果。作为静态样例，它很适合展示中文 README、指标信息和安装入口的布局方式。`,
    readmeOriginal: `# Claude Code at a glance

Claude Code is a coding assistant designed for terminal-first and local-project workflows. It is useful when you need to understand a repository, make coordinated changes, and verify the final result.

## Good fit

- Understand large repositories quickly
- Complete multi-file fixes or refactors
- Run lint, typecheck, and build before handoff

## Try it locally

1. Clone the repository and install dependencies.
2. Run the development command in a sample project.
3. Start with a small task such as updating copy or refining a component state.

## Commands

\`\`\`bash
npm install
npm run dev
\`\`\`

## Why it appears in this mock app

Its workflow lines up well with this workbench concept: read first, change carefully, then verify.`,
  },
  {
    owner: "vercel",
    name: "ai-chatbot",
    fullName: "vercel/ai-chatbot",
    repoUrl: "https://github.com/vercel/ai-chatbot",
    descriptionZh:
      "一个可直接部署的 AI 聊天应用示例，展示现代前端、流式响应和可复用消息界面。",
    descriptionOriginal:
      "A deployable AI chatbot example showcasing modern frontend patterns, streaming responses, and reusable chat UI.",
    language: "TypeScript",
    stars: 18234,
    forks: 4216,
    starsToday: 952,
    builtBy: ["Guillermo Rauch", "Evan You", "Sarah Drasner"],
    topicsZh: ["聊天界面", "流式响应", "示例项目"],
    translationStatus: "done",
    homepageUrl: "https://vercel.com/templates/next.js/ai-chatbot",
    defaultBranch: "main",
    lastSyncedAt: "2026-03-28 09:15",
    readmeSourceSha: "b47dd2f",
    readmeUpdatedAt: "2026-03-26 21:10",
    readmeZh: `# AI Chatbot 中文摘要

这个示例仓库展示了一个结构清晰的 AI 聊天产品壳：消息列表、输入区、会话状态和部署配置都已经准备好，适合拿来学习或改造成自己的工具。

## 仓库亮点

- 用较少代码搭起完整聊天界面骨架
- 将数据层、UI 层与部署方式拆得比较清楚
- 适合作为 AI 产品原型的起点

## 建议的学习顺序

1. 先看页面结构和组件拆分方式。
2. 再看消息流与状态更新如何组织。
3. 最后再决定哪些能力适合抽出来复用。

## 快速运行

\`\`\`bash
npm install
npm run dev
\`\`\`

## 在本工作台中的展示价值

它能很好地说明：Trending 列表中的项目不只是“热门”，还可以进一步被整理成适合中文用户理解和试用的静态详情页。`,
    readmeOriginal: `# AI Chatbot summary

This example repository demonstrates a clean AI chat application shell. Message history, composer, session state, and deployment setup are already in place, which makes it a good learning resource or starting point.

## Highlights

- Complete chat UI scaffold with limited code
- Clear separation between data, interface, and deployment concerns
- Strong starting point for AI product prototypes

## Suggested reading order

1. Review the page structure and component breakdown.
2. Understand how message flow and state updates are organized.
3. Decide which parts should be extracted for reuse.

## Quick start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Why it fits this mock workbench

It shows how a trending repository can be repackaged into a more readable, localized static detail view.`,
  },
  {
    owner: "supabase",
    name: "supabase",
    fullName: "supabase/supabase",
    repoUrl: "https://github.com/supabase/supabase",
    descriptionZh:
      "开源后端平台集合，覆盖数据库、认证、存储与实时能力，文档体系和示例都比较完整。",
    descriptionOriginal:
      "An open source backend platform combining database, auth, storage, and realtime features with strong docs and examples.",
    language: "TypeScript",
    stars: 77120,
    forks: 7023,
    starsToday: 731,
    builtBy: ["Paul Copplestone", "Misty West", "Taylor Otwell"],
    topicsZh: ["后端平台", "文档友好", "全栈开发"],
    translationStatus: "done",
    homepageUrl: "https://supabase.com/",
    defaultBranch: "master",
    lastSyncedAt: "2026-03-28 09:15",
    readmeSourceSha: "c9e8371",
    readmeUpdatedAt: "2026-03-25 15:30",
    readmeZh: `# Supabase 中文摘要

Supabase 提供了一套偏“产品级”的后端基础设施组合：Postgres、认证、对象存储、边缘函数以及实时订阅能力都围绕统一文档展开。

## 为什么很多开发者关注它

- 能快速拼出全栈产品所需的基础能力
- 文档与模板较多，学习路径比较顺手
- 对个人项目和小团队原型都很友好

## 适合在这个静态界面里展示的内容

- 仓库基础指标和技术语言
- README 中文摘要与原文对照入口
- 本地项目视角下的安装与同步状态

## 示例命令

\`\`\`bash
npm install
npm run dev
\`\`\`

## 备注

当前页面只是本地假数据样例，不会实际拉取远端 README 或创建数据库。`,
    readmeOriginal: `# Supabase overview

Supabase offers a product-oriented backend stack that combines Postgres, authentication, object storage, edge functions, and realtime capabilities under one documentation system.

## Why developers watch it

- Quickly assembles the core pieces needed for a full-stack product
- Documentation and templates make onboarding straightforward
- Friendly for solo builders and small-team prototypes

## What this mock UI highlights

- Core repository metrics and language
- Localized README summary with an original-view switch
- Install and project-sync status from a local workbench perspective

## Commands

\`\`\`bash
npm install
npm run dev
\`\`\`

## Note

This page is static sample data only. It does not fetch remote README content or create a database.`,
  },
];

export const localProjects: LocalProject[] = [
  {
    id: "claude-local",
    repositoryFullName: "anthropic/claude-code",
    repoUrl: "https://github.com/anthropic/claude-code",
    rootPath: "E:\\workspace\\oss-lab",
    projectPath: "E:\\workspace\\oss-lab\\claude-code",
    cloneStatus: "已克隆",
    installStatus: "最近更新",
    lastInstalledAt: "2026-03-27 22:10",
    source: "Trending 样例仓库",
    note: "最近一次依赖安装已完成，等待后续接入真实扫描逻辑。",
  },
  {
    id: "chatbot-local",
    repositoryFullName: "vercel/ai-chatbot",
    repoUrl: "https://github.com/vercel/ai-chatbot",
    rootPath: "E:\\workspace\\oss-lab",
    projectPath: "E:\\workspace\\oss-lab\\ai-chatbot",
    cloneStatus: "已克隆",
    installStatus: "已安装",
    lastInstalledAt: "2026-03-26 19:45",
    source: "手动加入本地工作区",
    note: "静态页面阶段仅展示路径、来源和安装时间，不执行刷新或打开目录。",
  },
  {
    id: "supabase-local",
    repositoryFullName: "supabase/supabase",
    repoUrl: "https://github.com/supabase/supabase",
    rootPath: "E:\\workspace\\oss-lab",
    projectPath: "E:\\workspace\\oss-lab\\supabase",
    cloneStatus: "待同步",
    installStatus: "待安装",
    lastInstalledAt: "2026-03-24 14:05",
    source: "等待目录扫描匹配",
    note: "第二阶段再接入真实目录扫描与元数据联动。",
  },
];

export function getRepository(owner: string, name: string): TrendingRepository | undefined {
  return trendingRepositories.find(
    (repository) => repository.owner === owner && repository.name === name,
  );
}
