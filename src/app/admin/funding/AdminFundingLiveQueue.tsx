"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { Badge } from "@/components/ui/Badge";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { formatEntryAmount } from "@/lib/display-format";
import type { ManualFundingSubmission } from "@/lib/match-room-api";

export type AdminFundingSnapshot = {
  submissions: ManualFundingSubmission[];
  loaded_at: string;
};

function countStatus(rows: ManualFundingSubmission[], status: ManualFundingSubmission["status"]) {
  return rows.filter((row) => row.status === status).length.toString();
}

function amountLabel(row: ManualFundingSubmission) {
  return formatEntryAmount({ currency: row.currency, entry_amount_minor: row.amount_minor });
}

async function fetchFundingSnapshot() {
  const response = await fetch("/api/admin/funding/live", {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("FUNDING_QUEUE_UNAVAILABLE");
  const payload = await response.json() as { ok?: boolean; data?: AdminFundingSnapshot };
  if (!payload.ok || !payload.data) throw new Error("FUNDING_QUEUE_UNAVAILABLE");
  return payload.data;
}

export function AdminFundingLiveQueue({ initialSnapshot }: { initialSnapshot: AdminFundingSnapshot }) {
  const { data: snapshot = initialSnapshot, isFetching, isError } = useQuery({
    queryKey: [...webQueryKeys.admin, "funding"],
    queryFn: fetchFundingSnapshot,
    initialData: initialSnapshot,
    refetchOnMount: false,
    staleTime: 6_000
  });

  const submissions = snapshot.submissions;

  return (
    <section className="grid gap-5">
      {isError ? (
        <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Funding queue could not refresh. The current queue is still available.
        </div>
      ) : null}

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusPanel detail={isFetching ? "Refreshing..." : "Needs review"} label="Submitted" tone="warning" value={countStatus(submissions, "submitted")} />
        <StatusPanel detail="Current filter" label="Approved" tone="success" value={countStatus(submissions, "approved")} />
        <StatusPanel detail="Current filter" label="Rejected" tone="danger" value={countStatus(submissions, "rejected")} />
        <StatusPanel detail="Approval records payment" label="Queue Total" tone="cyan" value={submissions.length.toString()} />
      </div>

      <Panel>
        <PanelHeader eyebrow="Queue" title="Submitted transfers" description="Copy the submission ID into the review panel after checking bank records and proof." />
        <div className="grid gap-3 p-4">
          {submissions.length ? (
            submissions.map((submission) => (
              <article className="rounded-md border border-line bg-white p-4" key={submission.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warning">Submitted</Badge>
                      <span className="font-mono text-xs font-bold text-dim">{new Date(submission.submitted_at).toLocaleString("en-NG")}</span>
                    </div>
                    <h2 className="mt-3 text-lg font-black text-ink">{amountLabel(submission)}</h2>
                    <p className="mt-1 font-mono text-xs font-bold text-muted">Room {submission.match_room_id}</p>
                  </div>
                  <div className="rounded-md border border-line bg-surfaceWarm p-3">
                    <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Submission ID</span>
                    <strong className="mt-1 block break-all font-mono text-xs text-ink">{submission.id}</strong>
                  </div>
                </div>
                <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <div>
                    <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Player</dt>
                    <dd className="mt-1 break-all font-bold text-ink">{submission.user_id}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Reference</dt>
                    <dd className="mt-1 break-all font-bold text-ink">{submission.transfer_reference}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Bank</dt>
                    <dd className="mt-1 font-bold text-ink">{submission.sender_bank_name ?? "Not provided"}</dd>
                  </div>
                </dl>
                {submission.proof_url ? (
                  <a className="mt-4 inline-flex text-sm font-black text-cyan hover:text-action" href={submission.proof_url} rel="noreferrer" target="_blank">
                    Open proof
                  </a>
                ) : null}
              </article>
            ))
          ) : (
            <AdminEmptyState description="No manual funding submissions are waiting for approval." title="Funding queue is clear" />
          )}
        </div>
      </Panel>
    </section>
  );
}
