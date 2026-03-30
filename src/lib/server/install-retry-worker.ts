import { spawn } from "node:child_process";

const activeRetryWorkers = new Set<string>();

export function startInstallRetryWorker(jobId: string) {
  if (activeRetryWorkers.has(jobId)) {
    return;
  }

  activeRetryWorkers.add(jobId);

  const child = spawn(
    "npx",
    ["tsx", "scripts/retry-install-job.ts", "--job-id", jobId],
    {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
    },
  );

  child.unref();
  child.on("exit", () => {
    activeRetryWorkers.delete(jobId);
  });
}
