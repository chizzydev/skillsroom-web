import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStepUpPanel } from "@/components/admin/AdminStepUpPanel";
import { AdminShell } from "@/components/layout/AdminShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth-bridge";
import {
  getMatchRoomTimeline,
  getPlayerTrustSummary,
  getRoomResults,
  listResultClaims,
  type MatchEvidenceItem,
  type MatchParticipant,
  type MatchResultClaim,
  type MatchTimeline,
  type PlayerTrustSummary,
  type ResultClaimStatus
} from "@/lib/match-room-api";
import { reviewResultClaimAction } from "./actions";

function countStatus(rows: MatchResultClaim[], status: ResultClaimStatus) {
  return rows.filter((row) => row.status === status).length.toString();
}

function displayLabel(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function scoreSummaryLabel(value: string | null | undefined) {
  return value && value.trim().length ? value : "No score line supplied";
}

function playerName(participant?: MatchParticipant) {
  if (!participant) return "Unknown player";
  return participant.user_id.length > 16 ? `${participant.user_id.slice(0, 8)}...${participant.user_id.slice(-4)}` : participant.user_id;
}

function playerDisplayName(participant: MatchParticipant | undefined, trust?: PlayerTrustSummary | null) {
  if (!participant) return "Unknown player";
  return trust?.display_name || trust?.username || playerName(participant);
}

function playerHandleSummary(trust?: PlayerTrustSummary | null) {
  if (!trust?.primary_game_handle) return null;
  return trust.primary_game_external_uid ? `${trust.primary_game_handle} / ${trust.primary_game_external_uid}` : trust.primary_game_handle;
}

function playerIdentityLabel(participant: MatchParticipant | undefined, trust?: PlayerTrustSummary | null) {
  if (!participant) return "Unknown player";
  const displayName = playerDisplayName(participant, trust);
  const handle = playerHandleSummary(trust);
  return handle ? `${displayName} (${handle})` : displayName;
}

type AdminResultQueueCard = {
  claim: MatchResultClaim;
  room: MatchTimeline["room"] | null;
  participants: MatchParticipant[];
  evidence: MatchEvidenceItem[];
  trustByUserId: Map<string, PlayerTrustSummary | null>;
  loadError?: string | null;
};

async function loadQueueCard(claim: MatchResultClaim): Promise<AdminResultQueueCard> {
  try {
    const [timeline, results] = await Promise.all([
      getMatchRoomTimeline(claim.match_room_id),
      getRoomResults(claim.match_room_id)
    ]);

    const relevantParticipants = results.participants.filter(
      (participant) =>
        participant.id === claim.claimant_participant_id || participant.id === claim.claimed_winner_participant_id
    );

    const trustEntries = await Promise.all(
      relevantParticipants.map(async (participant) => {
        try {
          const result = await getPlayerTrustSummary(participant.user_id);
          return [participant.user_id, result.trust] as const;
        } catch {
          return [participant.user_id, null] as const;
        }
      })
    );

    return {
      claim,
      room: timeline.room,
      participants: results.participants,
      evidence: results.evidence_items.filter((item) => item.result_claim_id === claim.id),
      trustByUserId: new Map<string, PlayerTrustSummary | null>(trustEntries),
      loadError: null
    };
  } catch {
    return {
      claim,
      room: null,
      participants: [],
      evidence: [],
      trustByUserId: new Map<string, PlayerTrustSummary | null>(),
      loadError: "Room details unavailable for this claim."
    };
  }
}

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
    description: "Fresh claims waiting for opponent response or direct operator review.",
    emptyTitle: "Submitted queue is clear",
    emptyDescription: "No newly submitted result claims are waiting right now."
  },
  {
    status: "opponent_agreed",
    title: "Opponent-agreed claims",
    description: "Claims where the opponent agreed and ops can move directly toward approval or dispute handling.",
    emptyTitle: "Agreed queue is clear",
    emptyDescription: "No opponent-agreed result claims are waiting right now."
  },
  {
    status: "opponent_disputed",
    title: "Disputed claims",
    description: "Claims that need operator review because the opponent disputed the result or evidence.",
    emptyTitle: "Dispute queue is clear",
    emptyDescription: "No disputed result claims are waiting right now."
  }
];

export default async function AdminResultsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/results");
  const { error, success } = await searchParams;

  let claims: MatchResultClaim[] = [];
  let loadError: string | null = null;
  try {
    const queueGroups = await Promise.all(queueStatuses.map(async ({ status }) => ({ status, rows: (await listResultClaims(status)).claims })));
    claims = queueGroups.flatMap((group) => group.rows);
  } catch {
    loadError = "Unable to load result review queue.";
  }

  const queueCards = await Promise.all(claims.map(loadQueueCard));
  const cardsByStatus = new Map<ResultClaimStatus, AdminResultQueueCard[]>(
    queueStatuses.map(({ status }) => [status, queueCards.filter((card) => card.claim.status === status)])
  );

  return (
    <AdminShell active="results">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Review score claims, evidence links, opponent responses, and route the room to settlement, dispute, or void."
          eyebrow="Result Ops"
          title="Evidence and Result Review"
        />

        <LiveUpdateStream eventTypePrefixes={["admin.queue.results.", "admin.queue.tournament_results.", "match.result.", "tournament.match.reviewed."]} label="Results live" />

        {error ? <TransientStatusBanner clearKeys={["error"]} durationMs={12000} message={error} /> : null}
        {success ? <TransientStatusBanner clearKeys={["success"]} durationMs={12000} message={success} tone="success" /> : null}
        {loadError ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div>
        ) : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Needs review" label="Submitted" tone="warning" value={countStatus(claims, "submitted")} />
          <StatusPanel detail="Opponent agrees" label="Agreed" tone="success" value={countStatus(claims, "opponent_agreed")} />
          <StatusPanel detail="Needs dispute lane" label="Disputed" tone="danger" value={countStatus(claims, "opponent_disputed")} />
          <StatusPanel detail="All active review lanes" label="Queue Total" tone="cyan" value={claims.length.toString()} />
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Queue" title="Result review lanes" description="Review evidence and copy the claim ID into the decision panel when you are ready to rule." />
            <div className="grid gap-3 p-4">
              {claims.length ? (
                queueStatuses.map(({ status, title, description, emptyTitle, emptyDescription }) => {
                  const statusCards = cardsByStatus.get(status) ?? [];
                  return (
                    <section className="grid gap-3" key={status}>
                      <div className="rounded-md border border-line bg-surfaceWarm p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">{displayLabel(status)}</p>
                            <h2 className="mt-2 text-lg font-black text-ink">{title}</h2>
                            <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
                          </div>
                          <Badge tone={status === "opponent_disputed" ? "danger" : status === "opponent_agreed" ? "success" : "warning"}>
                            {statusCards.length}
                          </Badge>
                        </div>
                      </div>
                      {statusCards.length ? statusCards.map((card) => {
                  const claim = card.claim;
                  const claimantParticipant = card.participants.find((item) => item.id === claim.claimant_participant_id);
                  const winnerParticipant = card.participants.find((item) => item.id === claim.claimed_winner_participant_id);
                  const claimantLabel = playerIdentityLabel(
                    claimantParticipant,
                    claimantParticipant ? card.trustByUserId.get(claimantParticipant.user_id) : null
                  );
                  const winnerLabel = playerIdentityLabel(
                    winnerParticipant,
                    winnerParticipant ? card.trustByUserId.get(winnerParticipant.user_id) : null
                  );

                        return (
                  <article className="rounded-md border border-line bg-white p-4" key={claim.id}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={claim.status === "opponent_disputed" ? "danger" : "warning"}>{displayLabel(claim.status)}</Badge>
                          <span className="font-mono text-xs font-bold text-dim">{new Date(claim.submitted_at).toLocaleString("en-NG")}</span>
                        </div>
                        <h2 className="mt-3 text-lg font-black text-ink">{scoreSummaryLabel(claim.score_summary)}</h2>
                        <p className="mt-1 text-sm font-bold text-muted">
                          {card.room?.title || "Untitled room"} {card.room?.room_code ? <span className="font-mono text-xs">({card.room.room_code})</span> : null}
                        </p>
                        <p className="mt-1 font-mono text-xs font-bold text-dim">Room ID {claim.match_room_id}</p>
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        {card.room ? (
                          <PendingLink
                            className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-surfaceWarm px-3 text-sm font-black text-ink hover:bg-surfaceHigh"
                            href={`/matches/${claim.match_room_id}#result`}
                            pendingLabel="Opening room..."
                          >
                            View room
                          </PendingLink>
                        ) : null}
                        <div className="rounded-md border border-line bg-surfaceWarm p-3">
                        <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Claim ID</span>
                        <strong className="mt-1 block break-all font-mono text-xs text-ink">{claim.id}</strong>
                        </div>
                      </div>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                      <div>
                        <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Claimant</dt>
                        <dd className="mt-1 font-bold text-muted">{claimantLabel}</dd>
                        <dd className="mt-1 break-all font-mono text-[11px] text-dim">{claim.claimant_user_id}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Winner</dt>
                        <dd className="mt-1 font-bold text-ink">{winnerLabel}</dd>
                        <dd className="mt-1 break-all font-mono text-[11px] text-dim">{claim.claimed_winner_user_id}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Note</dt>
                        <dd className="mt-1 font-bold text-ink">{claim.note ?? "No note"}</dd>
                      </div>
                    </dl>
                    {card.evidence.length ? (
                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {card.evidence.map((item) => (
                          <a
                            className="rounded-md border border-line bg-surfaceWarm p-3 text-sm font-bold text-ink hover:border-lineStrong hover:bg-surfaceHigh"
                            href={item.uri ?? "#"}
                            key={item.id}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-cyan">{displayLabel(item.evidence_type)}</span>
                            <span className="mt-1 block [overflow-wrap:anywhere]">{item.title}</span>
                            {item.notes ? <span className="mt-1 block text-xs leading-5 text-muted">{item.notes}</span> : null}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-md border border-line bg-surfaceWarm p-3 text-sm font-bold text-muted">
                        No evidence link loaded for this claim yet.
                      </div>
                    )}
                    {card.loadError ? <p className="mt-3 text-xs font-bold text-danger">{card.loadError}</p> : null}
                  </article>
                        );
                      }) : (
                        <AdminEmptyState description={emptyDescription} title={emptyTitle} />
                      )}
                    </section>
                  );
                })
              ) : (
                <AdminEmptyState description="No result claims are waiting in submitted, agreed, or disputed review lanes." title="Result review queue is clear" />
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
