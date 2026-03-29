import type { Repository } from "@/generated/prisma/client";
import { fetchExternal } from "@/lib/server/http";

const GOOGLE_TRANSLATE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";
const MAX_TRANSLATION_CHUNK_LENGTH = 1800;

function splitPlainTextIntoChunks(text: string) {
  const normalized = text.trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const candidate = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;

    if (candidate.length <= MAX_TRANSLATION_CHUNK_LENGTH) {
      currentChunk = candidate;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
      currentChunk = "";
    }

    if (paragraph.length <= MAX_TRANSLATION_CHUNK_LENGTH) {
      currentChunk = paragraph;
      continue;
    }

    for (let index = 0; index < paragraph.length; index += MAX_TRANSLATION_CHUNK_LENGTH) {
      chunks.push(paragraph.slice(index, index + MAX_TRANSLATION_CHUNK_LENGTH));
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function translateTextPreservingWhitespace(text: string) {
  if (!text.trim()) {
    return text;
  }

  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) {
    return text;
  }

  const leadingWhitespace = match[1] ?? "";
  const coreText = match[2] ?? "";
  const trailingWhitespace = match[3] ?? "";
  const chunks = splitPlainTextIntoChunks(coreText);

  if (chunks.length === 0) {
    return text;
  }

  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    translatedChunks.push(await translatePlainTextChunk(chunk));
  }

  return `${leadingWhitespace}${translatedChunks.join("\n\n")}${trailingWhitespace}`;
}

function splitMarkdownIntoSegments(markdown: string) {
  const segments: Array<{ type: "code" | "html" | "text"; value: string }> = [];
  const protectedPattern = /```[\s\S]*?```|<[^>]+>/g;

  let lastIndex = 0;

  for (const match of markdown.matchAll(protectedPattern)) {
    const start = match.index ?? 0;

    if (start > lastIndex) {
      segments.push({ type: "text", value: markdown.slice(lastIndex, start) });
    }

    segments.push({
      type: match[0].startsWith("```") ? "code" : "html",
      value: match[0],
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < markdown.length) {
    segments.push({ type: "text", value: markdown.slice(lastIndex) });
  }

  return segments;
}

function extractTranslatedText(payload: unknown) {
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected translation payload shape.");
  }

  const segments = payload[0];

  if (!Array.isArray(segments)) {
    throw new Error("Unexpected translation segment shape.");
  }

  return segments
    .map((segment) => (Array.isArray(segment) ? segment[0] : ""))
    .join("")
    .trim();
}

async function translatePlainTextChunk(text: string) {
  const url = new URL(GOOGLE_TRANSLATE_ENDPOINT);
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", "zh-CN");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetchExternal(url, {
    headers: {
      "User-Agent": "chinese-trending-workbench/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Translation request failed with ${response.status}.`);
  }

  return extractTranslatedText(await response.json());
}

export async function translateShortTextToChinese(text: string) {
  return (await translateTextPreservingWhitespace(text)).trim();
}

export async function translateMarkdownToChinese(markdown: string, _repository?: Repository) {
  void _repository;

  const segments = splitMarkdownIntoSegments(markdown);
  const translatedSegments: string[] = [];

  for (const segment of segments) {
    if (segment.type === "code" || segment.type === "html") {
      translatedSegments.push(segment.value);
      continue;
    }

    translatedSegments.push(await translateTextPreservingWhitespace(segment.value));
  }

  return translatedSegments.join("").trim();
}
