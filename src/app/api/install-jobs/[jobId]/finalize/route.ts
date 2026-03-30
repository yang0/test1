import { NextResponse } from "next/server";

import { finalizeInstallJob, getInstallJob } from "@/lib/server/install-jobs";

type FinalizeBody = {
  status?: "completed" | "failed";
  summary?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as FinalizeBody;
  const status = body.status;

  if (status !== "completed" && status !== "failed") {
    return NextResponse.json({ ok: false, error: "Invalid finalize status." }, { status: 400 });
  }

  const job = await getInstallJob(jobId);

  if (!job) {
    return NextResponse.json({ ok: false, error: "Install job not found." }, { status: 404 });
  }

  const summary = body.summary?.trim() || null;
  const finalized = await finalizeInstallJob(
    jobId,
    status,
    status === "completed" ? summary ?? "Install session was marked completed manually." : null,
    status === "failed" ? summary ?? "Install session was marked failed manually." : null,
  );

  return NextResponse.json({
    ok: true,
    job: finalized,
  });
}
