import { NextResponse } from "next/server";

import {
  getInstallJob,
  maybeFinalizeInstallJobFromOutput,
} from "@/lib/server/install-jobs";
import {
  getLatestRetryableUpstreamSignature,
  shouldAcknowledgeCodexTrustPrompt,
} from "@/lib/server/install-template";
import {
  captureTmuxTail,
  dispatchToTmux,
  type ResolvedTmuxTarget,
} from "@/lib/server/tmux";

const lastRetrySignatureByJob = new Map<string, string>();

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const job = await getInstallJob(jobId);

  if (!job) {
    return NextResponse.json({ ok: false, error: "Install job not found." }, { status: 404 });
  }

  const target = jobToTarget(job);
  let output = target ? await captureTmuxTail(target, 240).catch(() => "") : "";

  if (target && shouldAcknowledgeCodexTrustPrompt(output)) {
    await dispatchToTmux(target, "");
    output = await captureTmuxTail(target, 240).catch(() => output);
  }

  const retrySignature = getLatestRetryableUpstreamSignature(output);
  if (target && retrySignature && lastRetrySignatureByJob.get(jobId) !== retrySignature) {
    lastRetrySignatureByJob.set(jobId, retrySignature);
    await dispatchToTmux(target, job.promptText);
    output = await captureTmuxTail(target, 240).catch(() => output);
  }

  const resolvedJob = output ? await maybeFinalizeInstallJobFromOutput(jobId, output) : job;
  const repository = resolvedJob?.repository ?? job.repository;
  const payloadJob = resolvedJob ?? job;

  return NextResponse.json({
    ok: true,
    job: {
      id: payloadJob.id,
      status: payloadJob.status,
      resultSummary: payloadJob.resultSummary,
      errorMessage: payloadJob.errorMessage,
      createdAt: payloadJob.createdAt,
      finishedAt: payloadJob.finishedAt,
      repository: repository
        ? {
            fullName: repository.fullName,
            repoUrl: repository.repoUrl,
          }
        : null,
      tmux: target,
    },
    output,
  });
}
