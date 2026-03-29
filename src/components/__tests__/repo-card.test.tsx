import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RepoCard } from "@/components/repo-card";

const repository = {
  owner: "vercel",
  name: "ai-chatbot",
  fullName: "vercel/ai-chatbot",
  repoUrl: "https://github.com/vercel/ai-chatbot",
  descriptionZh: "一个可直接部署的 AI 聊天应用示例。",
  language: "TypeScript",
  stars: 18000,
  forks: 3200,
  starsToday: 12,
  starsThisWeek: 34,
  starsThisMonth: 56,
};

describe("RepoCard", () => {
  it("shows the daily trend metric by default", () => {
    const html = renderToStaticMarkup(<RepoCard repository={repository} />);

    expect(html).toContain("今日 +12");
  });

  it("shows the weekly trend metric when period is weekly", () => {
    const html = renderToStaticMarkup(<RepoCard repository={repository} period="weekly" />);

    expect(html).toContain("本周 +34");
  });

  it("shows the monthly trend metric when period is monthly", () => {
    const html = renderToStaticMarkup(<RepoCard repository={repository} period="monthly" />);

    expect(html).toContain("本月 +56");
  });

  it("hides the trend metric when the selected period value is zero", () => {
    const html = renderToStaticMarkup(
      <RepoCard
        repository={{
          ...repository,
          starsToday: 0,
          starsThisWeek: 0,
          starsThisMonth: 0,
        }}
      />,
    );

    expect(html).not.toContain("今日 +0");
    expect(html).not.toContain("本周 +0");
    expect(html).not.toContain("本月 +0");
  });

  it("removes noisy sponsor and repo-name prefixes from descriptions", () => {
    const html = renderToStaticMarkup(
      <RepoCard
        repository={{
          ...repository,
          owner: "hacksider",
          name: "Deep-Live-Cam",
          fullName: "hacksider/Deep-Live-Cam",
          descriptionZh: "赞助 Star hacksider / Deep-Live-Cam 实时换脸和仅使用单个图像的一键视频 Deepfake",
        }}
      />,
    );

    expect(html).toContain("实时换脸和仅使用单个图像的一键视频 Deepfake");
    expect(html).not.toContain("赞助 Star hacksider / Deep-Live-Cam");
  });

  it("removes repeated repo-name heading prefixes from descriptions", () => {
    const html = renderToStaticMarkup(
      <RepoCard
        repository={{
          ...repository,
          owner: "SakanaAI",
          name: "AI-Scientist-v2",
          fullName: "SakanaAI/AI-Scientist-v2",
          descriptionZh: "AI Scientist-v2：通过代理树搜索进行车间级自动化科学发现",
        }}
      />,
    );

    expect(html).toContain("通过代理树搜索进行车间级自动化科学发现");
    expect(html).not.toContain("AI Scientist-v2：通过代理树搜索");
  });

  it("uses the title as the only detail entry point and shows the repo url link", () => {
    const html = renderToStaticMarkup(<RepoCard repository={repository} />);

    expect(html).toContain('href="/repo/vercel/ai-chatbot"');
    expect(html).toContain('href="https://github.com/vercel/ai-chatbot"');
    expect(html).toContain("仓库地址");
    expect(html).not.toContain("查看详情");
  });
});
