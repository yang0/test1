import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workspaceRoot = path.resolve(__dirname, "../../..");

async function readAppFile(relativePath: string) {
  return readFile(path.join(workspaceRoot, relativePath), "utf8");
}

describe("app pages migrate off mock data", () => {
  it("home page no longer imports mock data", async () => {
    const source = await readAppFile("src/app/page.tsx");

    expect(source).not.toContain('@/data/mock-data');
  });

  it("projects page no longer imports mock data", async () => {
    const source = await readAppFile("src/app/projects/page.tsx");

    expect(source).not.toContain('@/data/mock-data');
  });

  it("repo detail page no longer imports mock data or static mock params", async () => {
    const source = await readAppFile("src/app/repo/[owner]/[name]/page.tsx");

    expect(source).not.toContain('@/data/mock-data');
    expect(source).not.toContain("dynamicParams = false");
  });
});
