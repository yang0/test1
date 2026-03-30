import { TranslationStatus, type Repository } from "@/lib/server/prisma-client";
import { buildRepositoryIdentity } from "@/lib/server/repositories";
import {
  ensureRepositoryReadme,
  getRepositoryDetailModel,
  prewarmRepositoryReadmes,
  type ReadmeTranslationDependencies,
} from "@/lib/server/repo-detail";
import { describe, expect, it, vi } from "vitest";

function createRepository(): Repository {
  const now = new Date("2026-03-28T10:00:00.000Z");
  const identity = buildRepositoryIdentity("anthropic", "claude-code");

  return {
    id: "repo-1",
    ...identity,
    repoUrl: "https://github.com/anthropic/claude-code",
    descriptionOriginal: "Terminal-first coding assistant.",
    descriptionZh: "终端优先的编码助手。",
    descriptionTranslationStatus: TranslationStatus.done,
    language: "TypeScript",
    stars: 32481,
    forks: 2814,
    starsToday: 1468,
    starsThisWeek: 5421,
    starsThisMonth: 12903,
    homepageUrl: "https://www.anthropic.com/claude-code",
    defaultBranch: "main",
    trendingRank: 1,
    trendingRankWeekly: 2,
    trendingRankMonthly: 3,
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

describe("getRepositoryDetailModel", () => {
  it("returns cached zh README without refetching", async () => {
    const repository = createRepository();
    const dependencies: ReadmeTranslationDependencies = {
      getLatestReadmeDocument: vi.fn().mockResolvedValue({
        id: "readme-1",
        repositoryId: repository.id,
        sourceSha: "abc123",
        contentOriginal: "# Original README",
        contentZh: "# 中文 README",
        translationStatus: TranslationStatus.done,
        translatedAt: new Date("2026-03-28T09:00:00.000Z"),
        errorMessage: null,
        createdAt: new Date("2026-03-28T09:00:00.000Z"),
        updatedAt: new Date("2026-03-28T09:00:00.000Z"),
      }),
      fetchReadmeSource: vi.fn(),
      translateMarkdownToChinese: vi.fn(),
      upsertReadmeDocument: vi.fn(),
    };

    const result = await getRepositoryDetailModel(repository, dependencies);

    expect(result.readme.zhMarkdown).toBe("# 中文 README");
    expect(result.readme.originalMarkdown).toBe("# Original README");
    expect(result.readme.translationStatus).toBe(TranslationStatus.done);
    expect(result.layoutMode).toBe("single-column");
    expect(dependencies.fetchReadmeSource).not.toHaveBeenCalled();
    expect(dependencies.translateMarkdownToChinese).not.toHaveBeenCalled();
  });

  it("fetches translates and persists README on cold cache so first render is Chinese", async () => {
    const repository = createRepository();
    const dependencies: ReadmeTranslationDependencies = {
      getLatestReadmeDocument: vi.fn().mockResolvedValue(null),
      fetchReadmeSource: vi.fn().mockResolvedValue({
        sourceSha: "def456",
        contentOriginal: "# Original README\n\nHello world.",
      }),
      translateMarkdownToChinese: vi.fn().mockResolvedValue("# 中文 README\n\n你好，世界。"),
      upsertReadmeDocument: vi.fn().mockResolvedValue(undefined),
    };

    const result = await getRepositoryDetailModel(repository, dependencies);

    expect(result.readme.zhMarkdown).toContain("中文 README");
    expect(result.readme.originalMarkdown).toContain("Original README");
    expect(result.readme.translationStatus).toBe(TranslationStatus.done);
    expect(dependencies.fetchReadmeSource).toHaveBeenCalledWith(repository);
    expect(dependencies.translateMarkdownToChinese).toHaveBeenCalledWith(
      "# Original README\n\nHello world.",
      repository,
    );
    expect(dependencies.upsertReadmeDocument).toHaveBeenCalledWith({
      repositoryId: repository.id,
      sourceSha: "def456",
      contentOriginal: "# Original README\n\nHello world.",
      contentZh: "# 中文 README\n\n你好，世界。",
      translationStatus: TranslationStatus.done,
      translatedAt: expect.any(Date),
      errorMessage: null,
    });
  });

  it("prefers repository-owned Chinese README before machine translation", async () => {
    const repository = createRepository();
    const dependencies: ReadmeTranslationDependencies = {
      getLatestReadmeDocument: vi.fn().mockResolvedValue(null),
      fetchReadmeSource: vi.fn().mockResolvedValue({
        sourceSha: "zh789",
        contentOriginal: "# Original README\n\nHello world.",
        contentZhPreferred: "# 仓库自带中文 README\n\n你好。",
      }),
      translateMarkdownToChinese: vi.fn(),
      upsertReadmeDocument: vi.fn().mockResolvedValue(undefined),
    };

    const result = await getRepositoryDetailModel(repository, dependencies);

    expect(result.readme.zhMarkdown).toContain("仓库自带中文 README");
    expect(result.readme.translationStatus).toBe(TranslationStatus.done);
    expect(dependencies.translateMarkdownToChinese).not.toHaveBeenCalled();
    expect(dependencies.upsertReadmeDocument).toHaveBeenCalledWith({
      repositoryId: repository.id,
      sourceSha: "zh789",
      contentOriginal: "# Original README\n\nHello world.",
      contentZh: "# 仓库自带中文 README\n\n你好。",
      translationStatus: TranslationStatus.done,
      translatedAt: expect.any(Date),
      errorMessage: null,
    });
  });

  it("can ensure a repository readme without building the full page model", async () => {
    const repository = createRepository();
    const dependencies: ReadmeTranslationDependencies = {
      getLatestReadmeDocument: vi.fn().mockResolvedValue(null),
      fetchReadmeSource: vi.fn().mockResolvedValue({
        sourceSha: "ensure123",
        contentOriginal: "# Original README\n\nHello world.",
      }),
      translateMarkdownToChinese: vi.fn().mockResolvedValue("# 中文 README\n\n你好，世界。"),
      upsertReadmeDocument: vi.fn().mockResolvedValue(undefined),
    };

    const readme = await ensureRepositoryReadme(repository, dependencies);

    expect(readme.zhMarkdown).toContain("中文 README");
    expect(readme.originalMarkdown).toContain("Original README");
  });

  it("prewarms only repositories missing cached chinese readmes", async () => {
    const cachedRepository = createRepository();
    const coldRepository = {
      ...createRepository(),
      id: "repo-2",
      owner: "vercel",
      name: "ai-chatbot",
      fullName: "vercel/ai-chatbot",
      repoUrl: "https://github.com/vercel/ai-chatbot",
    };

    const dependencies: ReadmeTranslationDependencies = {
      getLatestReadmeDocument: vi
        .fn()
        .mockImplementation(async (repositoryId: string) =>
          repositoryId === cachedRepository.id
            ? {
                id: "readme-cached",
                repositoryId,
                sourceSha: "cached123",
                contentOriginal: "# Original README",
                contentZh: "# Cached Chinese README",
                translationStatus: TranslationStatus.done,
                translatedAt: new Date("2026-03-28T09:00:00.000Z"),
                errorMessage: null,
                createdAt: new Date("2026-03-28T09:00:00.000Z"),
                updatedAt: new Date("2026-03-28T09:00:00.000Z"),
              }
            : null,
        ),
      fetchReadmeSource: vi.fn().mockResolvedValue({
        sourceSha: "cold123",
        contentOriginal: "# Cold README",
      }),
      translateMarkdownToChinese: vi.fn().mockResolvedValue("# Cold Chinese README"),
      upsertReadmeDocument: vi.fn().mockResolvedValue(undefined),
    };

    const result = await prewarmRepositoryReadmes([cachedRepository, coldRepository], dependencies);

    expect(result).toEqual([
      { repositoryId: cachedRepository.id, status: "cached" },
      { repositoryId: coldRepository.id, status: "generated" },
    ]);
    expect(dependencies.fetchReadmeSource).toHaveBeenCalledTimes(1);
    expect(dependencies.fetchReadmeSource).toHaveBeenCalledWith(coldRepository);
    expect(dependencies.translateMarkdownToChinese).toHaveBeenCalledTimes(1);
    expect(dependencies.upsertReadmeDocument).toHaveBeenCalledWith({
      repositoryId: coldRepository.id,
      sourceSha: "cold123",
      contentOriginal: "# Cold README",
      contentZh: "# Cold Chinese README",
      translationStatus: TranslationStatus.done,
      translatedAt: expect.any(Date),
      errorMessage: null,
    });
  });
});
