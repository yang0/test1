import { readFile } from "node:fs/promises";

import { finishInstallJob } from "@/lib/server/install-jobs";

function readArgument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function readOptionalFile(filePath: string | null) {
  if (!filePath) {
    return null;
  }

  try {
    const content = await readFile(filePath, "utf8");
    const normalized = content.trim();
    return normalized ? normalized : null;
  } catch {
    return null;
  }
}

async function main() {
  const jobId = readArgument("--job-id");
  const summaryFile = readArgument("--summary-file");
  const transcriptFile = readArgument("--transcript-file");
  const exitCodeValue = readArgument("--exit-code");

  if (!jobId || exitCodeValue === null) {
    throw new Error("Missing --job-id or --exit-code.");
  }

  const exitCode = Number(exitCodeValue);
  const summary = await readOptionalFile(summaryFile);
  const transcript = await readOptionalFile(transcriptFile);

  if (Number.isNaN(exitCode) || exitCode !== 0) {
    await finishInstallJob(
      jobId,
      "failed",
      summary,
      transcript ?? `Install command exited with code ${exitCodeValue}.`,
    );
    return;
  }

  await finishInstallJob(jobId, "completed", summary ?? "Install command completed successfully.", null);
}

void main();
