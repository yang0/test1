import { describe, expect, it } from "vitest";

import {
  extractGitHubRepositoryIdentity,
  parseGitRemoteUrl,
} from "@/lib/server/local-project-scanner";

describe("local project scanning helpers", () => {
  it("parses common git remote url formats", () => {
    expect(parseGitRemoteUrl("git@github.com:anthropic/claude-code.git")).toEqual({
      host: "github.com",
      owner: "anthropic",
      name: "claude-code",
      normalizedUrl: "https://github.com/anthropic/claude-code",
    });

    expect(parseGitRemoteUrl("https://github.com/vercel/ai-chatbot.git")).toEqual({
      host: "github.com",
      owner: "vercel",
      name: "ai-chatbot",
      normalizedUrl: "https://github.com/vercel/ai-chatbot",
    });
  });

  it("extracts GitHub repository identity when remote points at GitHub", () => {
    expect(extractGitHubRepositoryIdentity("https://github.com/supabase/supabase.git")).toEqual({
      owner: "supabase",
      name: "supabase",
      fullName: "supabase/supabase",
    });

    expect(extractGitHubRepositoryIdentity("https://gitlab.com/example/project.git")).toBeNull();
  });
});
