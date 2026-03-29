import {
  TranslationStatus,
  type ReadmeDocument,
  type Repository,
} from "@/generated/prisma/client";
import { fetchExternal } from "@/lib/server/http";
import { getLatestReadmeDocument, upsertReadmeDocument } from "@/lib/server/readmes";
import { translateMarkdownToChinese } from "@/lib/server/translation";

const README_TRANSLATION_FAILURE_MARKDOWN = `# 中文 README 暂不可用

当前自动翻译失败，系统已经保留原始 README 并记录错误。你仍然可以在页面下方查看原文 README。`;

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
};

export type RepositoryDetailModel = {
  layoutMode: "single-column";
  repository: Repository;
  readme: RepositoryReadmeModel;
};

async function fetchGitHubReadmeContent(repository: Repository, path: string) {
  const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/contents/${path}`;
  const response = await fetchExternal(url, {
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

async function fetchPreferredChineseReadme(repository: Repository) {
  const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/contents`;
  const response = await fetchExternal(url, {
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
  return fetchGitHubReadmeContent(repository, "README.md").catch(async () => {
    const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/readme`;
    const response = await fetchExternal(url, {
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

export async function fetchRepositoryReadmeSource(repository: Repository): Promise<ReadmeSource> {
  const [defaultReadme, preferredChineseReadme] = await Promise.all([
    fetchDefaultReadme(repository),
    fetchPreferredChineseReadme(repository),
  ]);

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
    };
  }

  const readmeSource = await dependencies.fetchReadmeSource(repository);
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
    contentZh: zhMarkdown,
    translationStatus,
    translatedAt,
    errorMessage,
  });

  return {
    sourceSha: readmeSource.sourceSha,
    originalMarkdown: readmeSource.contentOriginal,
    zhMarkdown,
    translationStatus,
    translatedAt,
    updatedAt: translatedAt,
  };
}

export async function prewarmRepositoryReadmes(
  repositories: Repository[],
  dependencies: ReadmeTranslationDependencies = {
    getLatestReadmeDocument,
    fetchReadmeSource: fetchRepositoryReadmeSource,
    translateMarkdownToChinese,
    upsertReadmeDocument,
  },
) {
  const results = await Promise.allSettled(
    repositories.map(async (repository) => {
      const cachedReadme = await dependencies.getLatestReadmeDocument(repository.id);

      if (cachedReadme?.contentZh) {
        return { repositoryId: repository.id, status: "cached" as const };
      }

      await ensureRepositoryReadme(repository, dependencies);
      return { repositoryId: repository.id, status: "generated" as const };
    }),
  );

  return results.map((result, index) => {
    const repositoryId = repositories[index]?.id ?? `unknown-${index}`;

    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      repositoryId,
      status: "failed" as const,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
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
