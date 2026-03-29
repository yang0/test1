import { describe, expect, it, vi } from "vitest";

import {
  mergeTrendingRepositoriesByPeriod,
  normalizeTrendingRepositories,
  parseTrendingRepositoriesFromHtml,
} from "@/lib/server/trending";

const trendingHtml = `
<article class="Box-row">
  <h2><a href="/anthropic/claude-code"> anthropic / claude-code </a></h2>
  <p>A coding assistant for terminal-first workflows.</p>
  <span itemprop="programmingLanguage">TypeScript</span>
  <a href="/anthropic/claude-code/stargazers">32,481</a>
  <a href="/anthropic/claude-code/forks">2,814</a>
  <span>1,468 stars today</span>
</article>
<article class="Box-row">
  <h2><a href="/vercel/ai-chatbot"> vercel / ai-chatbot </a></h2>
  <p>A deployable AI chatbot example.</p>
  <span itemprop="programmingLanguage">TypeScript</span>
  <a href="/vercel/ai-chatbot/stargazers">18,234</a>
  <a href="/vercel/ai-chatbot/forks">4,216</a>
  <span>952 stars today</span>
</article>
`;

describe("trending sync helpers", () => {
  it("parses repository records from GitHub Trending html", () => {
    const repositories = parseTrendingRepositoriesFromHtml(trendingHtml);

    expect(repositories).toHaveLength(2);
    expect(repositories[0]).toMatchObject({
      owner: "anthropic",
      name: "claude-code",
      repoUrl: "https://github.com/anthropic/claude-code",
      descriptionOriginal: "A coding assistant for terminal-first workflows.",
      language: "TypeScript",
      stars: 32481,
      forks: 2814,
      starsToday: 1468,
      trendingRank: 1,
    });
  });

  it("normalizes parsed repositories and translates descriptions to Chinese", async () => {
    const translateShortText = vi
      .fn()
      .mockResolvedValueOnce("终端优先的编码助手。")
      .mockResolvedValueOnce("可部署的 AI 聊天示例。");

    const normalized = await normalizeTrendingRepositories(
      parseTrendingRepositoriesFromHtml(trendingHtml),
      translateShortText,
    );

    expect(normalized).toHaveLength(2);
    expect(normalized[0]?.descriptionZh).toBe("终端优先的编码助手。");
    expect(normalized[0]?.trendingRank).toBe(1);
    expect(normalized[1]?.descriptionZh).toBe("可部署的 AI 聊天示例。");
    expect(translateShortText).toHaveBeenCalledTimes(2);
  });

  it("merges daily weekly and monthly trending batches into one repository record set", () => {
    const merged = mergeTrendingRepositoriesByPeriod([
      {
        period: "daily",
        repositories: [
          {
            owner: "anthropic",
            name: "claude-code",
            repoUrl: "https://github.com/anthropic/claude-code",
            descriptionOriginal: "A coding assistant for terminal-first workflows.",
            descriptionZh: "终端优先的编码助手。",
            language: "TypeScript",
            stars: 32481,
            forks: 2814,
            starsToday: 1468,
            trendingRank: 1,
            lastSyncedAt: new Date("2026-03-28T10:00:00.000Z"),
          },
        ],
      },
      {
        period: "weekly",
        repositories: [
          {
            owner: "anthropic",
            name: "claude-code",
            repoUrl: "https://github.com/anthropic/claude-code",
            starsToday: 5421,
            trendingRank: 2,
            lastSyncedAt: new Date("2026-03-28T10:00:00.000Z"),
          },
        ],
      },
      {
        period: "monthly",
        repositories: [
          {
            owner: "anthropic",
            name: "claude-code",
            repoUrl: "https://github.com/anthropic/claude-code",
            starsToday: 12903,
            trendingRank: 3,
            lastSyncedAt: new Date("2026-03-28T10:00:00.000Z"),
          },
        ],
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      owner: "anthropic",
      name: "claude-code",
      trendingRank: 1,
      trendingRankWeekly: 2,
      trendingRankMonthly: 3,
      starsToday: 1468,
      starsThisWeek: 5421,
      starsThisMonth: 12903,
    });
  });
});
