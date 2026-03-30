import { describe, expect, it } from "vitest";

import {
  buildRepositoryIdentity,
  buildRepositoryUpsertInput,
  getRepositoryBestTrendingRank,
} from "@/lib/server/repositories";

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

  it("picks the best available trending rank across daily weekly and monthly periods", () => {
    expect(
      getRepositoryBestTrendingRank({
        trendingRank: null,
        trendingRankWeekly: 6,
        trendingRankMonthly: 14,
      }),
    ).toBe(6);

    expect(
      getRepositoryBestTrendingRank({
        trendingRank: 3,
        trendingRankWeekly: 7,
        trendingRankMonthly: null,
      }),
    ).toBe(3);
  });
});
