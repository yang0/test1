import Link from "next/link";
import { notFound } from "next/navigation";

import { getInstallJob } from "@/lib/server/install-jobs";
import { captureTmuxTail } from "@/lib/server/tmux";

import { InstallSessionClient } from "./install-session-client";

export const dynamic = "force-dynamic";

type InstallPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function InstallSessionPage({ params }: InstallPageProps) {
  const { jobId } = await params;
  const job = await getInstallJob(jobId);

  if (!job) {
    notFound();
  }

  const output = job.targetTmuxSession
    ? await captureTmuxTail(
        {
          session: job.targetTmuxSession,
          window: job.targetTmuxWindow,
          pane: job.targetTmuxPane,
        },
        240,
      ).catch(() => "")
    : "";
  const installPagePath = `/install/${job.id}`;

  return (
    <main className="install-session-shell">
      <div className="install-session-layout">
        {job.repository ? (
          <div className="install-session-toolbar">
            <div className="flex flex-wrap gap-[var(--space-3)]">
              <Link href={`/repo/${job.repository.owner}/${job.repository.name}`} className="secondary-button">
                返回仓库详情
              </Link>
              <Link
                href={`/api/install-jobs/${job.id}/reopen?returnTo=${encodeURIComponent(installPagePath)}`}
                className="secondary-button"
              >
                重开会话
              </Link>
            </div>
          </div>
        ) : null}
        <InstallSessionClient
          jobId={job.id}
          activeRepository={job.repository?.fullName ?? null}
          initialOutput={output}
          initialStatus={job.status}
          initialErrorMessage={job.errorMessage}
          promptText={job.promptText}
        />
      </div>
    </main>
  );
}
