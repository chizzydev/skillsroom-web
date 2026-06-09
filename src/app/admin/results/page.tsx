import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStepUpPanel } from "@/components/admin/AdminStepUpPanel";
import { AdminShell } from "@/components/layout/AdminShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth-bridge";
import { listResultClaims, type MatchResultClaim } from "@/lib/match-room-api";
import { reviewResultClaimAction } from "./actions";

function countStatus(rows: MatchResultClaim[], status: MatchResultClaim["status"]) {
  return rows.filter((row) => row.status === status).length.toString();
}

function displayLabel(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function AdminResultsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/results");
  const { error, success } = await searchParams;

  let claims: MatchResultClaim[] = [];
  let loadError: string | null = null;
  try {
    claims = (await listResultClaims("submitted")).claims;
  } catch {
    loadError = "Unable to load result review queue.";
  }

  return (
    <AdminShell active="results">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Review score claims, evidence links, opponent responses, and route the room to settlement, dispute, or void."
          eyebrow="Result Ops"
          title="Evidence and Result Review"
        />

        <LiveUpdateStream eventTypePrefixes={["admin.queue.results.", "admin.queue.tournament_results.", "match.result.", "tournament.match.reviewed."]} label="Results live" />

        {error ? <TransientStatusBanner clearKeys={["error"]} durationMs={9000} message={error} /> : null}
        {success ? <TransientStatusBanner clearKeys={["success"]} durationMs={9000} message={success} tone="success" /> : null}
        {loadError ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div>
        ) : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Needs review" label="Submitted" tone="warning" value={countStatus(claims, "submitted")} />
          <StatusPanel detail="Opponent agrees" label="Agreed" tone="success" value={countStatus(claims, "opponent_agreed")} />
          <StatusPanel detail="Needs dispute lane" label="Disputed" tone="danger" value={countStatus(claims, "opponent_disputed")} />
          <StatusPanel detail="Current filter" label="Queue Total" tone="cyan" value={claims.length.toString()} />
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Queue" title="Submitted result claims" description="Copy the claim ID into the decision panel after reviewing the room evidence." />
            <div className="grid gap-3 p-4">
              {claims.length ? (
                claims.map((claim) => (
                  <article className="rounded-md border border-line bg-white p-4" key={claim.id}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={claim.status === "opponent_disputed" ? "danger" : "warning"}>{displayLabel(claim.status)}</Badge>
                          <span className="font-mono text-xs font-bold text-dim">{new Date(claim.submitted_at).toLocaleString("en-NG")}</span>
                        </div>
                        <h2 className="mt-3 text-lg font-black text-ink">{claim.score_summary}</h2>
                        <p className="mt-1 font-mono text-xs font-bold text-muted">Room {claim.match_room_id}</p>
                      </div>
                      <div className="rounded-md border border-line bg-surfaceWarm p-3">
                        <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Claim ID</span>
                        <strong className="mt-1 block break-all font-mono text-xs text-ink">{claim.id}</strong>
                      </div>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                      <div>
                        <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Claimant</dt>
                        <dd className="mt-1 break-all font-bold text-muted">{claim.claimant_user_id}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Winner</dt>
                        <dd className="mt-1 break-all font-bold text-ink">{claim.claimed_winner_user_id}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Note</dt>
                        <dd className="mt-1 font-bold text-ink">{claim.note ?? "No note"}</dd>
                      </div>
                    </dl>
                  </article>
                ))
              ) : (
                <AdminEmptyState description="No result claims are waiting for operator decision." title="Result review queue is clear" />
              )}
            </div>
          </Panel>

          <div className="grid h-fit gap-4 xl:sticky xl:top-24">
            <AdminStepUpPanel returnTo="/admin/results" />
            <Panel>
              <PanelHeader eyebrow="Decision" title="Review result claim" description="Unlock first, then move a room toward settlement, dispute resolution, or void." />
              <form action={reviewResultClaimAction} className="grid gap-3 p-4">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Claim ID
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="claim_id" required />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Review note
                  <textarea className="min-h-28 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" />
                </label>
                <div className="grid gap-2">
                  <Button name="decision" type="submit" value="approve_claim">Approve claim</Button>
                  <Button name="decision" type="submit" value="mark_disputed" variant="secondary">Mark disputed</Button>
                  <Button name="decision" type="submit" value="reject_claim" variant="danger">Reject claim</Button>
                  <Button name="decision" type="submit" value="void_match" variant="danger">Void match</Button>
                </div>
              </form>
            </Panel>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
