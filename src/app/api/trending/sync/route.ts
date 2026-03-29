import { NextResponse } from "next/server";

import { syncTrendingRepositories } from "@/lib/server/trending";

export async function POST() {
  try {
    const result = await syncTrendingRepositories();

    return NextResponse.json({
      ok: true,
      repositoryCount: result.repositories.length,
      periodCounts: result.periods,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown trending sync error.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
