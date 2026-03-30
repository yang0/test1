import { setTimeout as delay } from "node:timers/promises";

import { getInstallJob, maybeFinalizeInstallJobFromOutput } from "@/lib/server/install-jobs";
import {
  getLatestRetryableUpstreamSignature,
  shouldAcknowledgeCodexTrustPrompt,
} from "@/lib/server/install-template";
import { captureTmuxTail, dispatchToTmux } from "@/lib/server/tmux";

function readArgument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function main() {
  const jobId = readArgument("--job-id");
  if (!jobId) {
    throw new Error("Missing --job-id.");
  }

  let lastRetrySignature: string | null = null;

  while (true) {
    const job = await getInstallJob(jobId);
    if (!job) {
      return;
    }

    if (job.status === "completed" || job.status === "failed") {
      return;
    }

    if (!job.targetTmuxSession) {
      return;
    }

    const target = {
      session: job.targetTmuxSession,
      window: job.targetTmuxWindow,
      pane: job.targetTmuxPane,
    };

    let output = await captureTmuxTail(target, 240).catch(() => "");

    if (shouldAcknowledgeCodexTrustPrompt(output)) {
      await dispatchToTmux(target, "");
      output = await captureTmuxTail(target, 240).catch(() => output);
    }

    await maybeFinalizeInstallJobFromOutput(jobId, output);

    const retrySignature = getLatestRetryableUpstreamSignature(output);
    if (retrySignature && retrySignature !== lastRetrySignature) {
      lastRetrySignature = retrySignature;
      await dispatchToTmux(target, job.promptText);
    }

    await delay(5000);
  }
}

void main();
