import { NextResponse } from "next/server";

import { getInstallJob } from "@/lib/server/install-jobs";
import { reopenInstallJob } from "@/lib/server/install-workflow";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const existing = await getInstallJob(jobId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Install job not found." }, { status: 404 });
  }

  await reopenInstallJob(jobId);

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") ?? `/install/${jobId}`;
  return NextResponse.redirect(new URL(returnTo, request.url), { status: 303 });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const existing = await getInstallJob(jobId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Install job not found." }, { status: 404 });
  }

  const reopened = await reopenInstallJob(jobId);

  return NextResponse.json({
    ok: true,
    job: {
      id: reopened.id,
      status: reopened.status,
    },
  });
}
