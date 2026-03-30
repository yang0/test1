import { createHash } from "node:crypto";

import {
  TranslationStatus,
  type ReadmeDocument,
  type Repository,
} from "@/lib/server/prisma-client";
import { fetchExternal } from "@/lib/server/http";
import { getLatestReadmeDocument, upsertReadmeDocument } from "@/lib/server/readmes";
import { translateMarkdownToChinese } from "@/lib/server/translation";

const README_TRANSLATION_FAILURE_MARKDOWN = `# 中文 README 暂不可用

当前自动翻译失败，系统已经保留原始 README 并记录错误。你仍然可以在页面下方查看原文 README。`;

const README_ORIGINAL_FAILURE_MARKDOWN = `# 原始 README 暂不可用

当前从 GitHub 抓取原始 README 失败。系统已经记录错误，你可以稍后重试。`;

const README_FETCH_FAILURE_SOURCE_SHA = "readme-fetch-failed";
const README_FETCH_MAX_ATTEMPTS = 3;
const README_FETCH_RETRY_BASE_DELAY_MS = 1200;
const README_PREWARM_CONCURRENCY = 1;

let readmeGenerationQueue: Promise<void> = Promise.resolve();

const CHINESE_README_CANDIDATES = [
  "README.zh-CN.md",
  "README.zh_CN.md",
  "README.zh.md",
  "README_zh.md",
  "README-zh.md",
  "README.cn.md",
  "README_CN.md",
  "README_zh-CN.md",
  "README-zh-CN.md",
  "README_zh_CN.md",
];

const DEFAULT_README_CANDIDATES = [
  "README.md",
  "README",
  "README.rst",
  "README.txt",
];

export type ReadmeSource = {
  sourceSha: string;
  contentOriginal: string;
  contentZhPreferred?: string | null;
};

type GitHubContentItem = {
  name?: string;
  path?: string;
  type?: string;
};

export type ReadmeTranslationDependencies = {
  getLatestReadmeDocument: (repositoryId: string) => Promise<ReadmeDocument | null>;
  fetchReadmeSource: (repository: Repository) => Promise<ReadmeSource>;
  translateMarkdownToChinese: (markdown: string, repository: Repository) => Promise<string>;
  upsertReadmeDocument: typeof upsertReadmeDocument;
};

export type RepositoryReadmeModel = {
  sourceSha: string | null;
  originalMarkdown: string;
  zhMarkdown: string;
  translationStatus: TranslationStatus;
  translatedAt: Date | null;
  updatedAt: Date | null;
  errorMessage?: string | null;
};

export type RepositoryDetailModel = {
  layoutMode: "single-column";
  repository: Repository;
  readme: RepositoryReadmeModel;
};

async function fetchGitHubReadmeContent(repository: Repository, path: string) {
  const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/contents/${path}`;
  const response = await fetchWithRetry(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "chinese-trending-workbench/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch README content for ${repository.fullName}: ${response.status}`);
  }

  const payload = (await response.json()) as {
    sha?: string;
    content?: string;
    encoding?: string;
  };

  if (!payload.sha || !payload.content || payload.encoding !== "base64") {
    throw new Error(`Unexpected README payload for ${repository.fullName}.`);
  }

  return {
    sourceSha: payload.sha,
    content: Buffer.from(payload.content, "base64").toString("utf8"),
  };
}

function getReadmePrewarmConcurrency() {
  const parsed = Number.parseInt(process.env.README_PREWARM_CONCURRENCY ?? "", 10);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return README_PREWARM_CONCURRENCY;
}

function isRetriableReadmeFetchStatus(status: number) {
  return status === 403 || status === 429 || status >= 500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: NonNullable<Parameters<typeof fetchExternal>[1]>) {
  let response = await fetchExternal(url, init);

  for (let attempt = 1; attempt < README_FETCH_MAX_ATTEMPTS; attempt += 1) {
    if (!isRetriableReadmeFetchStatus(response.status)) {
      return response;
    }

    await sleep(README_FETCH_RETRY_BASE_DELAY_MS * attempt);
    response = await fetchExternal(url, init);
  }

  return response;
}

function buildSyntheticReadmeSourceSha(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function buildRawGitHubReadmeUrl(repository: Repository, ref: string, path: string) {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${ref}/${encodedPath}`;
}

function getReadmeRawRefs(repository: Repository) {
  return Array.from(new Set([repository.defaultBranch, "HEAD"].filter((value): value is string => Boolean(value))));
}

async function fetchRawGitHubReadmeContent(repository: Repository, path: string) {
  let lastError: Error | null = null;

  for (const ref of getReadmeRawRefs(repository)) {
    const response = await fetchWithRetry(buildRawGitHubReadmeUrl(repository, ref, path), {
      headers: {
        Accept: "text/plain",
        "User-Agent": "chinese-trending-workbench/0.1",
      },
    });

    if (response.status === 404) {
      continue;
    }

    if (!response.ok) {
      lastError = new Error(`Failed to fetch README for ${repository.fullName}: ${response.status}`);
      continue;
    }

    const content = await response.text();

    if (!content.trim()) {
      continue;
    }

    return {
      sourceSha: buildSyntheticReadmeSourceSha(content),
      content,
    };
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

async function fetchPreferredChineseReadme(repository: Repository) {
  for (const candidate of CHINESE_README_CANDIDATES) {
    const rawReadme = await fetchRawGitHubReadmeContent(repository, candidate);

    if (rawReadme) {
      return rawReadme;
    }
  }

  const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/contents`;
  const response = await fetchWithRetry(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "chinese-trending-workbench/0.1",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as GitHubContentItem[];
  if (!Array.isArray(payload)) {
    return null;
  }

  const lookup = new Map(
    payload
      .filter((item) => item.type === "file" && item.name && item.path)
      .map((item) => [item.name?.toLowerCase(), item.path] as const),
  );

  for (const candidate of CHINESE_README_CANDIDATES) {
    const path = lookup.get(candidate.toLowerCase());
    if (!path) {
      continue;
    }

    const result = await fetchGitHubReadmeContent(repository, path);
    return {
      sourceSha: result.sourceSha,
      content: result.content,
    };
  }

  return null;
}

async function fetchDefaultReadme(repository: Repository) {
  for (const candidate of DEFAULT_README_CANDIDATES) {
    const rawReadme = await fetchRawGitHubReadmeContent(repository, candidate);

    if (rawReadme) {
      return rawReadme;
    }
  }

  return fetchGitHubReadmeContent(repository, "README.md").catch(async () => {
    const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/readme`;
    const response = await fetchWithRetry(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "chinese-trending-workbench/0.1",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch README for ${repository.fullName}: ${response.status}`);
    }

    const payload = (await response.json()) as {
      sha?: string;
      content?: string;
      encoding?: string;
    };

    if (!payload.sha || !payload.content || payload.encoding !== "base64") {
      throw new Error(`Unexpected README payload for ${repository.fullName}.`);
    }

    return {
      sourceSha: payload.sha,
      content: Buffer.from(payload.content, "base64").toString("utf8"),
    };
  });
}

function buildReadmeFetchFailureModel(errorMessage: string): RepositoryReadmeModel {
  const originalMarkdown = `${README_ORIGINAL_FAILURE_MARKDOWN}\n\n错误信息：${errorMessage}`;
  const zhMarkdown = `${README_TRANSLATION_FAILURE_MARKDOWN}\n\n错误信息：${errorMessage}`;

  return {
    sourceSha: null,
    originalMarkdown,
    zhMarkdown,
    translationStatus: TranslationStatus.failed,
    translatedAt: null,
    updatedAt: null,
    errorMessage,
  };
}

function runReadmeGenerationSerially<T>(work: () => Promise<T>) {
  const run = readmeGenerationQueue.then(work, work);
  readmeGenerationQueue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

export async function fetchRepositoryReadmeSource(repository: Repository): Promise<ReadmeSource> {
  const defaultReadme = await fetchDefaultReadme(repository);
  const preferredChineseReadme = await fetchPreferredChineseReadme(repository).catch(() => null);

  return {
    sourceSha: defaultReadme.sourceSha,
    contentOriginal: defaultReadme.content,
    contentZhPreferred: preferredChineseReadme?.content ?? null,
  };
}

export async function ensureRepositoryReadme(
  repository: Repository,
  dependencies: ReadmeTranslationDependencies = {
    getLatestReadmeDocument,
    fetchReadmeSource: fetchRepositoryReadmeSource,
    translateMarkdownToChinese,
    upsertReadmeDocument,
  },
): Promise<RepositoryReadmeModel> {
  const cachedReadme = await dependencies.getLatestReadmeDocument(repository.id);

  if (cachedReadme?.contentZh) {
    return {
      sourceSha: cachedReadme.sourceSha,
      originalMarkdown: cachedReadme.contentOriginal,
      zhMarkdown: cachedReadme.contentZh,
      translationStatus: cachedReadme.translationStatus,
      translatedAt: cachedReadme.translatedAt,
      updatedAt: cachedReadme.updatedAt,
      errorMessage: cachedReadme.errorMessage,
    };
  }

  return runReadmeGenerationSerially(async () => {
    const queuedCachedReadme = await dependencies.getLatestReadmeDocument(repository.id);

    if (queuedCachedReadme?.contentZh) {
      return {
        sourceSha: queuedCachedReadme.sourceSha,
        originalMarkdown: queuedCachedReadme.contentOriginal,
        zhMarkdown: queuedCachedReadme.contentZh,
        translationStatus: queuedCachedReadme.translationStatus,
        translatedAt: queuedCachedReadme.translatedAt,
        updatedAt: queuedCachedReadme.updatedAt,
        errorMessage: queuedCachedReadme.errorMessage,
      };
    }

    let readmeSource: ReadmeSource;

    try {
      readmeSource = await dependencies.fetchReadmeSource(repository);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown README fetch error.";
      const failureReadme = buildReadmeFetchFailureModel(errorMessage);

      await dependencies.upsertReadmeDocument({
        repositoryId: repository.id,
        sourceSha: README_FETCH_FAILURE_SOURCE_SHA,
        contentOriginal: failureReadme.originalMarkdown,
        contentZh: null,
        translationStatus: TranslationStatus.failed,
        translatedAt: null,
        errorMessage,
      });

      return failureReadme;
    }

    let zhMarkdown = README_TRANSLATION_FAILURE_MARKDOWN;
    let translationStatus: TranslationStatus = TranslationStatus.failed;
    let errorMessage: string | null = null;
    let translatedAt: Date | null = null;

    if (readmeSource.contentZhPreferred) {
      zhMarkdown = readmeSource.contentZhPreferred;
      translationStatus = TranslationStatus.done;
      translatedAt = new Date();
    } else {
      try {
        zhMarkdown = await dependencies.translateMarkdownToChinese(readmeSource.contentOriginal, repository);
        translationStatus = TranslationStatus.done;
        translatedAt = new Date();
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Unknown README translation error.";
      }
    }

    await dependencies.upsertReadmeDocument({
      repositoryId: repository.id,
      sourceSha: readmeSource.sourceSha,
      contentOriginal: readmeSource.contentOriginal,
      contentZh: translationStatus === TranslationStatus.done ? zhMarkdown : null,
      translationStatus,
      translatedAt,
      errorMessage,
    });

    return {
      sourceSha: readmeSource.sourceSha,
      originalMarkdown: readmeSource.contentOriginal,
      zhMarkdown: translationStatus === TranslationStatus.done ? zhMarkdown : "",
      translationStatus,
      translatedAt,
      updatedAt: translatedAt,
      errorMessage,
    };
  });
}

export async function prewarmRepositoryReadmes(
  repositories: Repository[],
  dependencies: ReadmeTranslationDependencies = {
    getLatestReadmeDocument,
    fetchReadmeSource: fetchRepositoryReadmeSource,
    translateMarkdownToChinese,
    upsertReadmeDocument,
  },
  options: { maxConcurrent?: number } = {},
) {
  const results = new Array<
    | { repositoryId: string; status: "cached" | "generated" }
    | { repositoryId: string; status: "failed"; error: string }
  >(repositories.length);
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? getReadmePrewarmConcurrency());
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < repositories.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const repository = repositories[currentIndex];

      if (!repository) {
        continue;
      }

      try {
        const cachedReadme = await dependencies.getLatestReadmeDocument(repository.id);

        if (cachedReadme?.contentZh) {
          results[currentIndex] = { repositoryId: repository.id, status: "cached" };
          continue;
        }

        const readme = await ensureRepositoryReadme(repository, dependencies);

        if (readme.translationStatus === TranslationStatus.done) {
          results[currentIndex] = { repositoryId: repository.id, status: "generated" };
          continue;
        }

        results[currentIndex] = {
          repositoryId: repository.id,
          status: "failed",
          error: readme.errorMessage ?? "README prewarm did not complete successfully.",
        };
      } catch (error) {
        results[currentIndex] = {
          repositoryId: repository.id,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(maxConcurrent, repositories.length) }, () => worker()));

  return results.map((result, index) => result ?? {
    repositoryId: repositories[index]?.id ?? `unknown-${index}`,
    status: "failed" as const,
    error: "README prewarm exited before producing a result.",
  });
}

export async function getRepositoryDetailModel(
  repository: Repository,
  dependencies: ReadmeTranslationDependencies = {
    getLatestReadmeDocument,
    fetchReadmeSource: fetchRepositoryReadmeSource,
    translateMarkdownToChinese,
    upsertReadmeDocument,
  },
): Promise<RepositoryDetailModel> {
  const readme = await ensureRepositoryReadme(repository, dependencies);

  return {
    layoutMode: "single-column",
    repository,
    readme,
  };
}
