import { describe, expect, it } from "vitest";

import {
  buildRepositoryIdentity,
  buildRepositoryUpsertInput,
  filterAndPaginateRepositories,
} from "@/lib/server/repositories";
import type { Repository } from "@/lib/server/prisma-client";

describe("repository helpers", () => {
  it("normalizes owner and name into fullName", () => {
    expect(buildRepositoryIdentity(" anthropic ", " claude-code ")).toEqual({
      owner: "anthropic",
      name: "claude-code",
      fullName: "anthropic/claude-code",
    });
  });

  it("builds stable repository upsert payloads", () => {
    const upsert = buildRepositoryUpsertInput({
      owner: "vercel",
      name: "ai-chatbot",
      repoUrl: "https://github.com/vercel/ai-chatbot",
      descriptionZh: "一个可直接部署的 AI 聊天应用示例。",
      stars: 18000,
    });

    expect(upsert.where).toEqual({
      fullName: "vercel/ai-chatbot",
    });
    expect(upsert.create.descriptionZh).toBe("一个可直接部署的 AI 聊天应用示例。");
    expect(upsert.create.stars).toBe(18000);
    expect(upsert.create.descriptionTranslationStatus).toBe("pending");
  });

  it("paginates and searches all repositories", () => {
    const repositories = Array.from({ length: 25 }, (_, index) => ({
      id: `repo-${index + 1}`,
      owner: `owner-${index + 1}`,
      name: `repo-${index + 1}`,
      fullName: `owner-${index + 1}/repo-${index + 1}`,
      repoUrl: `https://github.com/owner-${index + 1}/repo-${index + 1}`,
      descriptionOriginal: index === 4 ? "React dashboard starter" : "General repository",
      descriptionZh: index === 4 ? "React 仪表盘模板" : "通用仓库",
      descriptionTranslationStatus: "done",
      language: index === 4 ? "TypeScript" : "Python",
      stars: 1_000 - index,
      forks: 10 + index,
      starsToday: 0,
      starsThisWeek: 0,
      starsThisMonth: 0,
      homepageUrl: null,
      defaultBranch: null,
      trendingRank: null,
      trendingRankWeekly: null,
      trendingRankMonthly: null,
      lastSyncedAt: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })) satisfies Repository[];

    const firstPage = filterAndPaginateRepositories(repositories, { page: 1, pageSize: 20 });
    expect(firstPage.total).toBe(25);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.repositories).toHaveLength(20);

    const secondPage = filterAndPaginateRepositories(repositories, { page: 2, pageSize: 20 });
    expect(secondPage.page).toBe(2);
    expect(secondPage.repositories).toHaveLength(5);

    const searchResult = filterAndPaginateRepositories(repositories, {
      query: "react",
      page: 1,
      pageSize: 20,
    });
    expect(searchResult.total).toBe(1);
    expect(searchResult.repositories[0]?.fullName).toBe("owner-5/repo-5");
  });
});
