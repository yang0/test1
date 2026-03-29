import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReadmeViewer } from "@/components/readme-viewer";

describe("ReadmeViewer", () => {
  it("renders markdown links images and code as HTML", () => {
    const html = renderToStaticMarkup(
      <ReadmeViewer
        markdown={[
          "# Title",
          "",
          "See [docs](https://example.com/docs).",
          "",
          "![logo](https://example.com/logo.png)",
          "",
          "`inline code`",
        ].join("\n")}
      />,
    );

    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('src="https://example.com/logo.png"');
    expect(html).toContain("inline code");
    expect(html).not.toContain("[docs](https://example.com/docs)");
    expect(html).not.toContain("![logo](https://example.com/logo.png)");
  });

  it("converts relative markdown links and images into GitHub absolute URLs", () => {
    const html = renderToStaticMarkup(
      <ReadmeViewer
        markdown={[
          "[guide](docs/guide.md)",
          "",
          "![preview](media/demo.gif)",
        ].join("\n")}
        repository={{
          repoUrl: "https://github.com/hacksider/Deep-Live-Cam",
          defaultBranch: "main",
        }}
      />,
    );

    expect(html).toContain('href="https://github.com/hacksider/Deep-Live-Cam/blob/main/docs/guide.md"');
    expect(html).toContain('src="https://github.com/hacksider/Deep-Live-Cam/raw/main/media/demo.gif"');
  });

  it("renders fenced code blocks without nesting duplicate pre wrappers", () => {
    const html = renderToStaticMarkup(
      <ReadmeViewer
        markdown={[
          "```ts",
          "const value = 1;",
          "```",
        ].join("\n")}
      />,
    );

    expect(html).toContain('class="readme-code-block"');
    expect(html).toContain('class="readme-code-language">ts<');
    expect((html.match(/<pre/g) || []).length).toBe(1);
    expect(html).not.toContain("<pre><div");
  });

  it("renders raw html links and images inside markdown", () => {
    const html = renderToStaticMarkup(
      <ReadmeViewer
        markdown={[
          '<p align="center"><a href="docs/html-guide.md">Open</a></p>',
          '<img src="media/html-image.png" alt="html image" />',
        ].join("\n")}
        repository={{
          repoUrl: "https://github.com/hacksider/Deep-Live-Cam",
          defaultBranch: "main",
        }}
      />,
    );

    expect(html).toContain('href="https://github.com/hacksider/Deep-Live-Cam/blob/main/docs/html-guide.md"');
    expect(html).toContain('src="https://github.com/hacksider/Deep-Live-Cam/raw/main/media/html-image.png"');
    expect(html).not.toContain("&lt;img");
    expect(html).not.toContain("&lt;a");
  });
});
