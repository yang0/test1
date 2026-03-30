import { NextResponse } from "next/server";

import { getInstallJob } from "@/lib/server/install-jobs";
import { startInstallRetryWorker } from "@/lib/server/install-retry-worker";
import { dispatchToTmux, type ResolvedTmuxTarget } from "@/lib/server/tmux";

type InstallInputBody = {
  text?: string;
};

function jobToTarget(job: NonNullable<Awaited<ReturnType<typeof getInstallJob>>>): ResolvedTmuxTarget | null {
  if (!job.targetTmuxSession) {
    return null;
  }

  return {
    session: job.targetTmuxSession,
    window: job.targetTmuxWindow,
    pane: job.targetTmuxPane,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const contentType = request.headers.get("content-type") ?? "";
  const text = contentType.includes("application/json")
    ? ((await request.json()) as InstallInputBody).text?.trim()
    : String((await request.formData()).get("text") ?? "").trim();

  if (!text) {
    return NextResponse.json({ ok: false, error: "Missing tmux input text." }, { status: 400 });
  }

  const job = await getInstallJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Install job not found." }, { status: 404 });
  }

  const target = jobToTarget(job);
  if (!target) {
    return NextResponse.json({ ok: false, error: "Install job has no tmux target." }, { status: 400 });
  }

  await dispatchToTmux(target, text);

  if (text === job.promptText) {
    startInstallRetryWorker(job.id);
  }

  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL(`/install/${jobId}`, request.url), { status: 303 });
  }

  return NextResponse.json({ ok: true });
}
