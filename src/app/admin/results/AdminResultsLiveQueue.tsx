"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { Badge } from "@/components/ui/Badge";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { type MatchResultClaim, type ResultClaimStatus } from "@/lib/match-room-api";

export type AdminResultsSnapshot = {
  claims: MatchResultClaim[];
  loaded_at: string;
};

const queueStatuses: Array<{
  status: ResultClaimStatus;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}> = [
  {
    status: "submitted",
    title: "Submitted result claims",
    description: "Fresh claims waiting for the opponent to agree or dispute. Approval stays locked at this stage.",
    emptyTitle: "Submitted queue is clear",
    emptyDescription: "No newly submitted result claims are waiting right now."
  },
  {
    status: "opponent_agreed",
    title: "Opponent-agreed claims",
    description: "Claims where the opponent agreed and the team can move toward approval or dispute handling.",
    emptyTitle: "Agreed queue is clear",
    emptyDescription: "No opponent-agreed result claims are waiting right now."
  },
  {
    status: "opponent_disputed",
    title: "Disputed claims",
    description: "Claims that need team review because the opponent disputed the result or proof.",
    emptyTitle: "Dispute queue is clear",
    emptyDescription: "No disputed result claims are waiting right now."
  }
];

function countStatus(rows: MatchResultClaim[], status: ResultClaimStatus) {
  return rows.filter((row) => row.status === status).length.toString();
}

function displayLabel(value: string) {
  return value.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function scoreSummaryLabel(value: string | null | undefined) {
  return value && value.trim().length ? value : "No score line supplied";
}

function dateTimeLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function responseWindowExpired(claim: MatchResultClaim) {
  if (claim.opponent_response_overdue_at) return true;
  const dueAt = claim.opponent_response_due_at ? new Date(claim.opponent_response_due_at).getTime() : Number.NaN;
  return Number.isFinite(dueAt) && dueAt <= Date.now();
}

async function fetchResultsSnapshot() {
  const response = await fetch("/api/admin/results/live", {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("RESULT_QUEUE_UNAVAILABLE");
  const payload = await response.json() as { ok?: boolean; data?: AdminResultsSnapshot };
  if (!payload.ok || !payload.data) throw new Error("RESULT_QUEUE_UNAVAILABLE");
  return payload.data;
}

export function AdminResultsLiveQueue({ initialSnapshot }: { initialSnapshot: AdminResultsSnapshot }) {
  const { data: snapshot = initialSnapshot, isFetching, isError } = useQuery({
    queryKey: [...webQueryKeys.admin, "results"],
    queryFn: fetchResultsSnapshot,
    initialData: initialSnapshot,
    refetchOnMount: false,
    staleTime: 6_000
  });

  const claims = snapshot.claims;

  return (
    <section className="grid gap-5">
      {isError ? <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold text-amber-800">Result queue could not refresh. The current queue is still available.</div> : null}

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusPanel detail={isFetching ? "Refreshing..." : "Awaiting opponent"} label="Submitted" tone="warning" value={countStatus(claims, "submitted")} />
        <StatusPanel detail="Opponent agrees" label="Agreed" tone="success" value={countStatus(claims, "opponent_agreed")} />
        <StatusPanel detail="Needs dispute review" label="Disputed" tone="danger" value={countStatus(claims, "opponent_disputed")} />
        <StatusPanel detail="All active reviews" label="Queue Total" tone="cyan" value={claims.length.toString()} />
      </div>

      <Panel>
        <PanelHeader eyebrow="Queue" title="Result review queue" description="Review evidence and copy the claim ID into the decision panel when you are ready to rule." />
        <div className="grid gap-3 p-4">
          {claims.length ? queueStatuses.map(({ status, title, description, emptyTitle, emptyDescription }) => {
            const statusClaims = claims.filter((claim) => claim.status === status);
            return (
              <section className="grid gap-3" key={status}>
                <div className="rounded-md border border-line bg-surfaceWarm p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">{displayLabel(status)}</p>
                      <h2 className="mt-2 text-lg font-black text-ink">{title}</h2>
                      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
                    </div>
                    <Badge tone={status === "opponent_disputed" ? "danger" : status === "opponent_agreed" ? "success" : "warning"}>{statusClaims.length}</Badge>
                  </div>
                </div>
                {statusClaims.length ? statusClaims.map((claim) => (
                  <article className="rounded-md border border-line bg-white p-4" key={claim.id}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={claim.status === "opponent_disputed" ? "danger" : "warning"}>{displayLabel(claim.status)}</Badge>
                          {claim.status === "submitted" && responseWindowExpired(claim) ? <Badge tone="danger">Response overdue</Badge> : null}
                          <span className="font-mono text-xs font-bold text-dim">{new Date(claim.submitted_at).toLocaleString("en-NG")}</span>
                        </div>
                        <h2 className="mt-3 text-lg font-black text-ink">{scoreSummaryLabel(claim.score_summary)}</h2>
                        <p className="mt-1 font-mono text-xs font-bold text-dim">Room ID {claim.match_room_id}</p>
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-surfaceWarm px-3 text-sm font-black text-ink hover:bg-surfaceHigh" href={`/matches/${claim.match_room_id}#result`} pendingLabel="Opening room...">
                          View room
                        </PendingLink>
                        <div className="rounded-md border border-line bg-surfaceWarm p-3">
                          <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Claim ID</span>
                          <strong className="mt-1 block break-all font-mono text-xs text-ink">{claim.id}</strong>
                        </div>
                      </div>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                      <div><dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Claimant</dt><dd className="mt-1 break-all font-mono text-[11px] text-dim">{claim.claimant_user_id}</dd></div>
                      <div><dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Winner</dt><dd className="mt-1 break-all font-mono text-[11px] text-dim">{claim.claimed_winner_user_id}</dd></div>
                      <div><dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Note</dt><dd className="mt-1 font-bold text-ink">{claim.note ?? "No note"}</dd></div>
                    </dl>
                    {claim.status === "submitted" ? (
                      <div className={["mt-4 rounded-md border p-3 text-sm font-bold leading-6", responseWindowExpired(claim) ? "border-danger bg-red-50 text-danger" : "border-amber-200 bg-amber-50 text-amber-900"].join(" ")}>
                        Opponent response due: {dateTimeLabel(claim.opponent_response_due_at)}.
                      </div>
                    ) : null}
                  </article>
                )) : <AdminEmptyState description={emptyDescription} title={emptyTitle} />}
              </section>
            );
          }) : <AdminEmptyState description="No result claims are waiting in submitted, agreed, or disputed review." title="Result review queue is clear" />}
        </div>
      </Panel>
    </section>
  );
}
