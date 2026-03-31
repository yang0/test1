"use client";

import { useEffect } from "react";

type ReadmePrewarmTriggerProps = {
  repositoryIds: string[];
};

export function ReadmePrewarmTrigger({ repositoryIds }: ReadmePrewarmTriggerProps) {
  useEffect(() => {
    const visibleRepositoryIds = repositoryIds.slice(0, 8);

    if (visibleRepositoryIds.length === 0) {
      return;
    }

    let cancelled = false;
    let triggered = false;

    const run = () => {
      if (cancelled || triggered) {
        return;
      }

      triggered = true;
      void fetch("/api/readme/prewarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryIds: visibleRepositoryIds }),
        keepalive: true,
      }).catch(() => undefined);
    };

    const timeoutId = window.setTimeout(run, 1500);
    let idleId: number | null = null;

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(run);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);

      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [repositoryIds]);

  return null;
}
