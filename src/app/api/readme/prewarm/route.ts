import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { prewarmRepositoryReadmes } from "@/lib/server/repo-detail";

type PrewarmRequestBody = {
  repositoryIds?: string[];
};

const MAX_PREWARM_REPOSITORIES = 8;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PrewarmRequestBody;
    const repositoryIds = Array.from(new Set(body.repositoryIds ?? [])).slice(0, MAX_PREWARM_REPOSITORIES);

    if (repositoryIds.length === 0) {
      return NextResponse.json({ ok: true, count: 0, results: [] });
    }

    const repositories = await prisma.repository.findMany({
      where: { id: { in: repositoryIds } },
    });

    const orderedRepositories = repositoryIds
      .map((repositoryId) => repositories.find((repository) => repository.id === repositoryId))
      .filter((repository): repository is NonNullable<typeof repository> => Boolean(repository));

    const results = await prewarmRepositoryReadmes(orderedRepositories);

    return NextResponse.json({
      ok: true,
      count: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown README prewarm error.",
      },
      { status: 500 },
    );
  }
}
