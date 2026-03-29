import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchExternalMock } = vi.hoisted(() => ({
  fetchExternalMock: vi.fn(),
}));

vi.mock("@/lib/server/http", () => ({
  fetchExternal: fetchExternalMock,
}));

import { translateMarkdownToChinese } from "@/lib/server/translation";

function buildTranslatePayload(text: string) {
  return [[[`ZH:${text}`, text, null, null]]];
}

describe("translateMarkdownToChinese", () => {
  beforeEach(() => {
    fetchExternalMock.mockReset();
    fetchExternalMock.mockImplementation(async (input: string | URL) => {
      const url = new URL(String(input));
      const text = url.searchParams.get("q") ?? "";

      return {
        ok: true,
        json: async () => buildTranslatePayload(text),
      };
    });
  });

  it("preserves fenced code block boundaries while translating surrounding text", async () => {
    const markdown = [
      "## Install",
      "",
      "Run the command below:",
      "",
      "```bash",
      "bun --version",
      "```",
      "",
      "## Next",
      "",
      "Continue after installation.",
    ].join("\n");

    const translated = await translateMarkdownToChinese(markdown);

    expect(translated).toContain("```bash\nbun --version\n```");
    expect(translated).toContain("\n\n```bash");
    expect(translated).toContain("```\n\nZH:## Next");
    expect(translated).not.toContain("```ZH:");
  });
});
