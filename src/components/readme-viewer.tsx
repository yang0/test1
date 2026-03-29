import React from "react";
import rehypeRaw from "rehype-raw";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ReadmeRepositoryContext = {
  repoUrl: string;
  defaultBranch: string | null;
};

type ReadmeViewerProps = {
  markdown: string;
  repository?: ReadmeRepositoryContext;
};

function isRelativeUrl(value: string) {
  return !/^(?:[a-z]+:)?\/\//i.test(value) && !value.startsWith("#") && !value.startsWith("mailto:");
}

function normalizeRepoPath(value: string) {
  return value.replace(/^\.\//, "").replace(/^\//, "");
}

function buildGitHubUrl(repository: ReadmeRepositoryContext, value: string, mode: "blob" | "raw") {
  if (!isRelativeUrl(value)) {
    return value;
  }

  const branch = repository.defaultBranch ?? "HEAD";
  const normalizedPath = normalizeRepoPath(value);
  const encodedPath = normalizedPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  if (mode === "raw") {
    return `${repository.repoUrl}/raw/${branch}/${encodedPath}`;
  }

  return `${repository.repoUrl}/blob/${branch}/${encodedPath}`;
}

function resolveReadmeUrl(
  repository: ReadmeRepositoryContext | undefined,
  value: string,
  key: string,
) {
  if (!repository) {
    return value;
  }

  return buildGitHubUrl(repository, value, key === "src" ? "raw" : "blob");
}

type HastNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function rewriteRawHtmlUrls(node: HastNode, repository: ReadmeRepositoryContext | undefined) {
  if (node.type === "element" && node.properties) {
    if (node.tagName === "a" && typeof node.properties.href === "string") {
      node.properties.href = resolveReadmeUrl(repository, node.properties.href, "href");
    }

    if (node.tagName === "img" && typeof node.properties.src === "string") {
      node.properties.src = resolveReadmeUrl(repository, node.properties.src, "src");
    }
  }

  for (const child of node.children ?? []) {
    rewriteRawHtmlUrls(child, repository);
  }
}

function rehypeResolveRelativeUrls(repository: ReadmeRepositoryContext | undefined) {
  return () => {
    return (tree: HastNode) => {
      rewriteRawHtmlUrls(tree, repository);
    };
  };
}

export function ReadmeViewer({ markdown, repository }: ReadmeViewerProps) {
  return (
    <article className="readme-prose">
      <ReactMarkdown
        rehypePlugins={[rehypeRaw, rehypeResolveRelativeUrls(repository)]}
        remarkPlugins={[remarkGfm]}
        urlTransform={(value, key) => resolveReadmeUrl(repository, value, key)}
        components={{
          a: ({ children, ...props }) => (
            <a target="_blank" rel="noreferrer" {...props}>
              {children}
            </a>
          ),
          img: ({ src, alt, ...props }) =>
            React.createElement("img", {
              src: src ?? "",
              alt: alt ?? "",
              ...props,
            }),
          pre: ({ children, ...props }) => {
            let language = "";

            if (React.isValidElement(children)) {
              const className = (children.props as { className?: string }).className;
              language = className?.replace("language-", "") ?? "";
            }

            return (
              <div className="readme-code-block">
                {language ? <span className="readme-code-language">{language}</span> : null}
                <pre {...props}>{children}</pre>
              </div>
            );
          },
          code: ({ className, children, ...props }) => {
            const content = String(children).replace(/\n$/, "");

            if (className) {
              return (
                <code className={className} {...props}>
                  {content}
                </code>
              );
            }

            return (
              <code className="inline-mono" {...props}>
                {content}
              </code>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
