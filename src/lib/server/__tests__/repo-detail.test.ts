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

  it("continues with machine translation when preferred chinese readme lookup fails", async () => {
    const repository = createRepository();
    const dependencies: ReadmeTranslationDependencies = {
      getLatestReadmeDocument: vi.fn().mockResolvedValue(null),
      fetchReadmeSource: vi.fn().mockResolvedValue({
        sourceSha: "fallback123",
        contentOriginal: "# Original README\n\nHello world.",
        contentZhPreferred: null,
      }),
      translateMarkdownToChinese: vi.fn().mockResolvedValue("# 中文 README\n\n你好，世界。"),
      upsertReadmeDocument: vi.fn().mockResolvedValue(undefined),
    };

    const result = await getRepositoryDetailModel(repository, dependencies);

    expect(result.readme.zhMarkdown).toContain("中文 README");
    expect(result.readme.translationStatus).toBe(TranslationStatus.done);
    expect(dependencies.translateMarkdownToChinese).toHaveBeenCalledTimes(1);
    expect(dependencies.upsertReadmeDocument).toHaveBeenCalledWith({
      repositoryId: repository.id,
      sourceSha: "fallback123",
      contentOriginal: "# Original README\n\nHello world.",
      contentZh: "# 中文 README\n\n你好，世界。",
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

  it("returns a failed result instead of throwing when readme fetching fails", async () => {
    const repository = createRepository();
    const dependencies: ReadmeTranslationDependencies = {
      getLatestReadmeDocument: vi.fn().mockResolvedValue(null),
      fetchReadmeSource: vi.fn().mockRejectedValue(new Error("Failed to fetch README for anthropic/claude-code: 403")),
      translateMarkdownToChinese: vi.fn(),
      upsertReadmeDocument: vi.fn().mockResolvedValue(undefined),
    };

    const readme = await ensureRepositoryReadme(repository, dependencies);

    expect(readme.translationStatus).toBe(TranslationStatus.failed);
    expect(readme.errorMessage).toContain("403");
    expect(readme.zhMarkdown).toContain("中文 README 暂不可用");
    expect(readme.originalMarkdown).toContain("原始 README 暂不可用");
    expect(dependencies.upsertReadmeDocument).toHaveBeenCalledWith({
      repositoryId: repository.id,
      sourceSha: "readme-fetch-failed",
      contentOriginal: expect.stringContaining("原始 README 暂不可用"),
      contentZh: null,
      translationStatus: TranslationStatus.failed,
      translatedAt: null,
      errorMessage: "Failed to fetch README for anthropic/claude-code: 403",
    });
  });

  it("limits prewarm concurrency while still processing every repository", async () => {
    const repositories = [
      createRepository(),
      { ...createRepository(), id: "repo-2", owner: "repo", name: "two", fullName: "repo/two", repoUrl: "https://github.com/repo/two" },
      { ...createRepository(), id: "repo-3", owner: "repo", name: "three", fullName: "repo/three", repoUrl: "https://github.com/repo/three" },
    ];
    let inFlight = 0;
    let maxInFlight = 0;

    const dependencies: ReadmeTranslationDependencies = {
      getLatestReadmeDocument: vi.fn().mockResolvedValue(null),
      fetchReadmeSource: vi.fn().mockImplementation(async (repository: Repository) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 20));
        inFlight -= 1;

        return {
          sourceSha: `sha-${repository.id}`,
          contentOriginal: `# ${repository.fullName}`,
        };
      }),
      translateMarkdownToChinese: vi.fn().mockImplementation(async (markdown: string) => `中文 ${markdown}`),
      upsertReadmeDocument: vi.fn().mockResolvedValue(undefined),
    };

    const result = await prewarmRepositoryReadmes(repositories, dependencies, { maxConcurrent: 2 });

    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(result).toEqual([
      { repositoryId: "repo-1", status: "generated" },
      { repositoryId: "repo-2", status: "generated" },
      { repositoryId: "repo-3", status: "generated" },
    ]);
  });

  it("serializes readme generation by default across concurrent requests", async () => {
    const firstRepository = createRepository();
    const secondRepository = {
      ...createRepository(),
      id: "repo-2",
      owner: "repo",
      name: "two",
      fullName: "repo/two",
      repoUrl: "https://github.com/repo/two",
    };
    let inFlightTranslations = 0;
    let maxInFlightTranslations = 0;

    const dependencies: ReadmeTranslationDependencies = {
      getLatestReadmeDocument: vi.fn().mockResolvedValue(null),
      fetchReadmeSource: vi.fn().mockImplementation(async (repository: Repository) => ({
        sourceSha: `sha-${repository.id}`,
        contentOriginal: `# ${repository.fullName}`,
      })),
      translateMarkdownToChinese: vi.fn().mockImplementation(async (markdown: string) => {
        inFlightTranslations += 1;
        maxInFlightTranslations = Math.max(maxInFlightTranslations, inFlightTranslations);
        await new Promise((resolve) => setTimeout(resolve, 20));
        inFlightTranslations -= 1;
        return `中文 ${markdown}`;
      }),
      upsertReadmeDocument: vi.fn().mockResolvedValue(undefined),
    };

    await Promise.all([
      ensureRepositoryReadme(firstRepository, dependencies),
      ensureRepositoryReadme(secondRepository, dependencies),
    ]);

    expect(maxInFlightTranslations).toBe(1);
  });

  it("reports prewarm failures without crashing the whole batch", async () => {
    const repository = createRepository();
    const dependencies: ReadmeTranslationDependencies = {
      getLatestReadmeDocument: vi.fn().mockResolvedValue(null),
      fetchReadmeSource: vi.fn().mockRejectedValue(new Error("Failed to fetch README for anthropic/claude-code: 429")),
      translateMarkdownToChinese: vi.fn(),
      upsertReadmeDocument: vi.fn().mockResolvedValue(undefined),
    };

    const result = await prewarmRepositoryReadmes([repository], dependencies, { maxConcurrent: 1 });

    expect(result).toEqual([
      {
        repositoryId: repository.id,
        status: "failed",
        error: "Failed to fetch README for anthropic/claude-code: 429",
      },
    ]);
  });
});
