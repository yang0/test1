import { describe, expect, it, vi } from "vitest";

import { TranslationStatus } from "@/lib/server/prisma-client";

import { fetchGitHubRepositoryMetadata } from "@/lib/server/manual-repositories";

describe("manual repository helpers", () => {
  it("fetches and normalizes a GitHub repository by URL", async () => {
    const fetchReadmeSource = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          description: "A deployable AI chatbot example.",
          language: "TypeScript",
          stargazers_count: 18234,
          forks_count: 4216,
          homepage: "https://example.com",
          default_branch: "main",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const translateShortText = vi.fn().mockResolvedValue("可部署的 AI 聊天示例。");

    const result = await fetchGitHubRepositoryMetadata("https://github.com/vercel/ai-chatbot.git", {
      fetchExternal: fetchReadmeSource,
      translateShortTextToChinese: translateShortText,
    });

    expect(result.identity).toEqual({
      owner: "vercel",
      name: "ai-chatbot",
      fullName: "vercel/ai-chatbot",
    });
    expect(result.repositoryRecord).toMatchObject({
      repoUrl: "https://github.com/vercel/ai-chatbot",
      descriptionOriginal: "A deployable AI chatbot example.",
      descriptionZh: "可部署的 AI 聊天示例。",
      descriptionTranslationStatus: TranslationStatus.done,
      language: "TypeScript",
      stars: 18234,
      forks: 4216,
      homepageUrl: "https://example.com",
      defaultBranch: "main",
      trendingRank: null,
      trendingRankWeekly: null,
      trendingRankMonthly: null,
    });
  });

  it("rejects non-GitHub repository URLs", async () => {
    await expect(fetchGitHubRepositoryMetadata("https://gitlab.com/example/project")).rejects.toThrow(
      "Only GitHub repository URLs are supported.",
    );
  });
});
