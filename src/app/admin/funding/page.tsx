import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminShell } from "@/components/layout/AdminShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth-bridge";
import { formatEntryAmount, listFundingSubmissions, type ManualFundingSubmission } from "@/lib/match-room-api";
import { reviewFundingSubmissionAction } from "./actions";

function countStatus(rows: ManualFundingSubmission[], status: ManualFundingSubmission["status"]) {
  return rows.filter((row) => row.status === status).length.toString();
}

function amountLabel(row: ManualFundingSubmission) {
  return formatEntryAmount({ currency: row.currency, entry_amount_minor: row.amount_minor });
}

export default async function AdminFundingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/funding");
  const { error } = await searchParams;

  let submissions: ManualFundingSubmission[] = [];
  let loadError: string | null = null;
  try {
    submissions = (await listFundingSubmissions("submitted")).submissions;
  } catch {
    loadError = "Unable to load funding queue.";
  }

  return (
    <AdminShell active="funding">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Confirm exact transfer amount, sender identity, room, and reference before approval writes ledger entries."
          eyebrow="Funding Ops"
          title="Manual Funding Queue"
          tone="warning"
        />

        {(error || loadError) && (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {error ?? loadError}
          </div>
        )}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Needs review" label="Submitted" tone="warning" value={countStatus(submissions, "submitted")} />
          <StatusPanel detail="Current filter" label="Approved" tone="success" value={countStatus(submissions, "approved")} />
          <StatusPanel detail="Current filter" label="Rejected" tone="danger" value={countStatus(submissions, "rejected")} />
          <StatusPanel detail="Ledger on approval" label="Queue Total" tone="cyan" value={submissions.length.toString()} />
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Queue" title="Submitted transfers" description="Copy the submission ID into the review panel after checking bank records and proof." />
            <div className="grid gap-3 p-4">
              {submissions.length ? (
                submissions.map((submission) => (
                  <article className="rounded-md border border-line bg-white p-4" key={submission.id}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="warning">{submission.status}</Badge>
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

          <Panel className="h-fit xl:sticky xl:top-24">
            <PanelHeader eyebrow="Decision" title="Approve or reject funding" description="Approvals create balanced ledger entries into platform cash and match escrow." />
            <form action={reviewFundingSubmissionAction} className="grid gap-3 p-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Submission ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="submission_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Step-up token
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="step_up_token" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Review note
                <textarea className="min-h-28 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" />
              </label>
              <div className="grid gap-2">
                <Button name="decision" type="submit" value="approve">Approve funding</Button>
                <Button name="decision" type="submit" value="reject" variant="danger">Reject funding</Button>
              </div>
            </form>
          </Panel>
        </div>
      </section>
    </AdminShell>
  );
}
