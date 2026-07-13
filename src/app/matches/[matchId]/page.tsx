import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { EvidenceMediaDrawer } from "@/components/evidence/EvidenceMediaDrawer";
import { RoomActionForm } from "@/components/matches/RoomActionForm";
import { ManualPaymentPanel } from "@/components/payments/ManualPaymentPanel";
import { MotionSection, Reveal } from "@/components/motion";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { RealtimePatchStatus } from "@/components/realtime/RealtimePatchStatus";
import { PlayerTrustCard } from "@/components/trust/PlayerTrustCard";
import { Badge } from "@/components/ui/Badge";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Timeline } from "@/components/ui/Timeline";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { getCurrentUser } from "@/lib/auth-bridge";
import {
  formatEntryAmount,
  formatMinorMoney,
  getMatchWinnerPage,
  listAccessibleLivestreams,
  listManageableLivestreams,
  getTournamentDetail,
  getPlayerTrustSummary,
  getMatchRoomShell,
  getMatchRoomTimeline,
  getRoomFunding,
  getRoomResults,
  getWalletOverview,
  listStreamingAccounts,
  matchStatusLabel,
  type CommunityLivestreamLink,
  type CommunityMatchWinnerPage,
  type ManualFundingSubmission,
  type MatchParticipant,
  type MatchResultClaim,
  type MatchRoom,
  type MatchRoomStatus,
  type MatchTimeline,
  type RoomFundingOverview,
  type RoomResultOverview,
  type PlayerTrustSummary,
  type StreamingConnectedAccount,
  type TournamentDetail,
  type TournamentMatchSide,
  type TournamentEntry
} from "@/lib/match-room-api";
import {
  archiveMatchLivestreamAction,
  checkInTournamentMatchRoomAction,
  createMatchLivestreamIslandAction,
  createRoomInviteAction,
  openMatchRoomAction,
  payRoomWithBalanceAction,
  respondToResultClaimAction,
  startMatchPlayAction,
  submitManualFundingIslandAction,
  submitResultClaimIslandAction
} from "../actions";

export const dynamic = "force-dynamic";

function displayLabel(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function statusTone(status: MatchRoomStatus) {
  if (status === "open") return "cyan" as const;
  if (["awaiting_funding", "funding_review", "funded"].includes(status)) return "warning" as const;
  if (["under_review", "disputed", "voided"].includes(status)) return "danger" as const;
  if (["active", "awaiting_results", "settlement_pending", "completed"].includes(status)) return "success" as const;
  return "neutral" as const;
}

function fundingTone(status: ManualFundingSubmission["status"]) {
  if (status === "approved") return "success" as const;
  if (status === "rejected" || status === "cancelled") return "danger" as const;
  return "warning" as const;
}

function resultTone(status: MatchResultClaim["status"]) {
  if (status === "admin_approved" || status === "opponent_agreed") return "success" as const;
  if (status === "opponent_disputed" || status === "admin_rejected") return "danger" as const;
  return "warning" as const;
}

function nextAction(room: MatchRoom, participantCount: number) {
  if (room.status === "draft") return ["Open this room", "Review the details, then publish the room so an opponent can join."] as const;
  if (room.status === "open") return participantCount < room.max_participants
    ? (["Share the room code", "Send the code to an opponent or wait for a player to join from the lobby."] as const)
    : (["Confirm funding", "Both players are in. Funding proof is the next checkpoint."] as const);
  if (["awaiting_funding", "funding_review"].includes(room.status)) return ["Submit or wait for funding review", "Both entries must be approved before the match starts."] as const;
  if (room.status === "funded") return ["Start the match", "Funding is approved. Start live play when both players are ready, then submit evidence after the match ends."] as const;
  if (room.status === "active") return ["Match is live", "Play is active. Submit result evidence when the match is done."] as const;
  if (room.status === "awaiting_results") return ["Result evidence needed", "A player should submit the final score and scoreboard proof."] as const;
  if (room.status === "under_review") return ["Review in progress", "Evidence and responses are being checked before payout."] as const;
  if (room.status === "disputed") return ["Dispute review", "Payout is paused while the Skillsroom team checks the issue."] as const;
  if (room.status === "settlement_pending") return ["Payout pending", "The winner is approved and payment is the next step."] as const;
  if (room.status === "completed") return ["Room completed", "This room is finished and saved in your history."] as const;
  return ["Room closed", "This room no longer accepts player actions."] as const;
}

function buildProcessTimeline(room: MatchRoom) {
  const openDone = !["draft", "cancelled"].includes(room.status);
  const fundingDone = ["funded", "active", "awaiting_results", "under_review", "disputed", "settlement_pending", "completed", "refunded"].includes(room.status);
  const fundingCurrent = ["awaiting_funding", "funding_review"].includes(room.status);
  const playDone = ["awaiting_results", "under_review", "disputed", "settlement_pending", "completed", "refunded"].includes(room.status);
  const playCurrent = ["funded", "active"].includes(room.status);
  const evidenceDone = ["settlement_pending", "completed", "refunded"].includes(room.status);
  const evidenceCurrent = ["awaiting_results", "under_review", "disputed"].includes(room.status);
  const settlementStatus =
    room.status === "completed" || room.status === "refunded" || room.status === "voided"
      ? ("done" as const)
      : room.status === "settlement_pending"
        ? ("current" as const)
        : ("pending" as const);

  return [
    { label: "Open", detail: "Room is visible or shareable by code.", status: openDone ? "done" as const : "current" as const },
    { label: "Fund", detail: "Both player entries must be approved before play.", status: fundingDone ? "done" as const : fundingCurrent ? "current" as const : "pending" as const },
    { label: "Play", detail: "Match starts only after funding is approved.", status: playDone ? "done" as const : playCurrent ? "current" as const : "pending" as const },
    { label: "Evidence", detail: "Winner claim, opponent response, and proof stay attached.", status: evidenceDone ? "done" as const : evidenceCurrent ? "current" as const : "pending" as const },
    { label: "Payout", detail: "After review, the winner is paid or the entry is returned where needed.", status: settlementStatus }
  ];
}

function buildAuditTimeline(data: MatchTimeline) {
  const terminalStatuses: MatchRoomStatus[] = ["completed", "cancelled", "refunded", "voided"];

  return data.events.length
    ? data.events.map((event, index) => ({
        label: matchStatusLabel(event.to_status),
        detail: event.reason.replaceAll("_", " "),
        status:
          index === data.events.length - 1
            ? terminalStatuses.includes(event.to_status)
              ? ("done" as const)
              : ("current" as const)
            : ("done" as const)
      }))
    : [{ label: "Room created", detail: "Room updates will appear here as the match moves forward.", status: "current" as const }];
}

function participantName(participant?: MatchParticipant) {
  if (!participant) return "Open slot";
  return participant.user_id.length > 16 ? `${participant.user_id.slice(0, 8)}...${participant.user_id.slice(-4)}` : participant.user_id;
}

function playerDisplayName(participant: MatchParticipant | undefined, trust?: PlayerTrustSummary | null) {
  if (!participant) return "Open slot";
  return trust?.display_name || trust?.username || participantName(participant);
}

function playerHandleSummary(trust?: PlayerTrustSummary | null) {
  if (!trust?.primary_game_handle) return null;
  return trust.primary_game_external_uid ? `${trust.primary_game_handle} / ${trust.primary_game_external_uid}` : trust.primary_game_handle;
}

function playerOptionLabel(participant: MatchParticipant | undefined, trust?: PlayerTrustSummary | null) {
  if (!participant) return "Open slot";
  const label = playerDisplayName(participant, trust);
  const handle = playerHandleSummary(trust);
  return handle ? `${participant.slot.replace("_", " ")} - ${label} (${handle})` : `${participant.slot.replace("_", " ")} - ${label}`;
}

function primaryHandleLabel(trust?: PlayerTrustSummary | null) {
  if (!trust?.primary_game_handle) return "No game handle";
  return trust.primary_game_external_uid ? `${trust.primary_game_handle} / ${trust.primary_game_external_uid}` : trust.primary_game_handle;
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.length ? value : null;
}

function scoreSummaryLabel(value: string | null | undefined) {
  return value && value.trim().length ? value : "No score line supplied";
}

function selectFundingSubmission(submissions: ManualFundingSubmission[] | undefined, participantId: string | undefined) {
  if (!participantId || !submissions?.length) return null;
  const relevant = submissions
    .filter((item) => item.participant_id === participantId)
    .sort((left, right) => Date.parse(right.submitted_at) - Date.parse(left.submitted_at));
  return relevant.find((item) => item.status === "approved") ?? relevant[0] ?? null;
}

function fundingMethodSummary(funding: RoomFundingOverview | null, participant: MatchParticipant | undefined) {
  if (!participant) {
    return {
      label: "Waiting",
      detail: "This slot has not been joined yet.",
      tone: "neutral" as const
    };
  }

  const submission = selectFundingSubmission(funding?.submissions, participant.id);
  const escrowEntry = funding?.ledger_entries.find(
    (entry) =>
      entry.participant_id === participant.id &&
      entry.entry_type === "manual_funding_approved" &&
      entry.direction === "credit" &&
      entry.account_type === "match_escrow"
  );

  if (participant.funding_status === "approved" && escrowEntry?.source_type === "wallet_hold") {
    return {
      label: "Balance",
      detail: "Entry fee is locked from Skillsroom Balance.",
      tone: "success" as const
    };
  }

  if (participant.funding_status === "approved" && (submission?.status === "approved" || escrowEntry)) {
    return {
      label: "Manual transfer",
      detail: "Payment proof is approved for this room.",
      tone: "success" as const
    };
  }

  if (submission?.status === "submitted" || participant.funding_status === "submitted") {
    return {
      label: "Under review",
      detail: "Payment proof is waiting for Skillsroom review.",
      tone: "warning" as const
    };
  }

  if (submission?.status === "rejected" || participant.funding_status === "rejected") {
    return {
      label: "Needs correction",
      detail: "The last proof was rejected. Player should submit a corrected proof.",
      tone: "danger" as const
    };
  }

  if (participant.funding_status === "refunded") {
    return {
      label: "Refunded",
      detail: "This entry has been returned.",
      tone: "neutral" as const
    };
  }

  return {
    label: "Not funded",
    detail: "Player still needs to pay the entry or upload payment proof.",
    tone: "neutral" as const
  };
}

function resultCheckpointSummary(room: MatchRoom, latestClaim: MatchResultClaim | null) {
  if (!latestClaim) {
    return {
      label: "No result yet",
      detail: ["active", "awaiting_results", "under_review", "disputed"].includes(room.status)
        ? "Players can submit winner evidence after play."
        : "Result evidence opens after funding and live play.",
      tone: "neutral" as const
    };
  }

  return {
    label: displayLabel(latestClaim.status),
    detail: scoreSummaryLabel(latestClaim.score_summary),
    tone: resultTone(latestClaim.status)
  };
}

function payoutCheckpointSummary(room: MatchRoom, latestClaim: MatchResultClaim | null) {
  if (room.status === "completed") {
    return {
      label: "Paid / completed",
      detail: "Payout is complete and saved in this room history.",
      tone: "success" as const
    };
  }

  if (room.status === "settlement_pending") {
    return {
      label: "Payout pending",
      detail: "Winner is approved. Payout or wallet credit is the next step.",
      tone: "warning" as const
    };
  }

  if (latestClaim && ["admin_approved", "opponent_agreed"].includes(latestClaim.status)) {
    return {
      label: "Ready for payout",
      detail: "The result is accepted and can move to payout.",
      tone: "warning" as const
    };
  }

  return {
    label: "Not ready",
    detail: "Payout stays locked until funding, play, and result review are complete.",
    tone: "neutral" as const
  };
}

function resultReadinessMessage(room: MatchRoom, canStartPlay: boolean) {
  if (room.status === "funded") {
    return canStartPlay
      ? "Funding is complete. Start live play first, then submit result evidence when the match ends."
      : "Funding is complete, but the match still needs to be started before result evidence opens.";
  }
  if (room.status === "open" || room.status === "awaiting_funding" || room.status === "funding_review") {
    return "Result evidence stays locked until funding is fully approved and live play has started.";
  }
  if (room.status === "draft") {
    return "Open the room, fill both slots, and finish funding before result evidence becomes available.";
  }
  return "Result evidence becomes available once the room reaches live play.";
}

type LivestreamRole = "official" | "player_a" | "player_b";
type LivestreamPlaybackStatus = "live" | "offline" | "replay" | "unavailable";

function livestreamRole(item: CommunityLivestreamLink): LivestreamRole {
  const value = item.metadata?.stream_role;
  return value === "player_a" || value === "player_b" || value === "official" ? value : "official";
}

function livestreamPlaybackStatus(item: CommunityLivestreamLink): LivestreamPlaybackStatus {
  const value = item.metadata?.playback_status;
  if (value === "live" || value === "offline" || value === "replay" || value === "unavailable") return value;
  return item.embed_url ? "live" : "unavailable";
}

function livestreamRoleLabel(role: LivestreamRole) {
  if (role === "player_a") return "Player A";
  if (role === "player_b") return "Player B";
  return "Official room stream";
}

function livestreamStatusTone(status: LivestreamPlaybackStatus) {
  if (status === "live") return "success" as const;
  if (status === "replay") return "cyan" as const;
  if (status === "unavailable") return "danger" as const;
  return "neutral" as const;
}

function livestreamStatusLabel(status: LivestreamPlaybackStatus) {
  if (status === "live") return "Live";
  if (status === "offline") return "Offline";
  if (status === "replay") return "Replay";
  return "Link unavailable";
}

function streamingProviderLabel(provider: StreamingConnectedAccount["provider"]) {
  return provider === "youtube" ? "YouTube" : "Twitch";
}

function connectedStreamStatusLabel(status: StreamingConnectedAccount["live_status"]) {
  if (status === "live") return "Live now";
  if (status === "offline") return "Not live";
  if (status === "replay") return "Replay";
  if (status === "unavailable") return "Needs reconnect";
  return "Not checked";
}

function connectedStreamStatusTone(status: StreamingConnectedAccount["live_status"]) {
  if (status === "live") return "success" as const;
  if (status === "unavailable") return "danger" as const;
  if (status === "unknown") return "warning" as const;
  return "neutral" as const;
}

function livestreamEmptyRoleDetail(role: LivestreamRole, canManageLivestreams: boolean) {
  if (role === "official") {
    return canManageLivestreams
      ? "Use this slot for the host, community, or tournament broadcast."
      : "The host or Skillsroom team can add the official broadcast here.";
  }
  if (role === "player_a") {
    return canManageLivestreams
      ? "Use this slot for Player A's YouTube, Twitch, or TikTok stream."
      : "Player A's stream can be added by the room host or Skillsroom team.";
  }
  return canManageLivestreams
    ? "Use this slot for Player B's YouTube, Twitch, or TikTok stream."
    : "Player B's stream can be added by the room host or Skillsroom team.";
}

function livestreamWatchRank(item: CommunityLivestreamLink) {
  const status = livestreamPlaybackStatus(item);
  const role = livestreamRole(item);
  const statusScore = status === "live" ? 0 : status === "replay" ? 1 : status === "offline" ? 2 : 3;
  const roleScore = role === "official" ? 0 : role === "player_a" ? 1 : 2;
  return statusScore * 10 + roleScore + (item.embed_url ? 0 : 5) - (item.is_featured ? 1 : 0);
}

function tournamentMatchContext(detail: TournamentDetail | null, tournamentMatchId: string | null) {
  const match = detail?.matches.find((item) => item.id === tournamentMatchId) ?? null;
  const stage = match ? detail?.stages.find((item) => item.id === match.stage_id) ?? null : null;
  const round = match ? detail?.rounds.find((item) => item.id === match.round_id) ?? null : null;
  const sides = match ? detail?.match_sides.filter((item) => item.tournament_match_id === match.id) ?? [] : [];
  return { match, stage, round, sides };
}

function entryLabel(entry: TournamentEntry | undefined) {
  if (!entry) return "TBD";
  return entry.team_name || entry.display_name;
}

function FundingCard({
  room,
  participant,
  submission,
  trust
}: {
  room: MatchRoom;
  participant?: MatchParticipant;
  submission?: ManualFundingSubmission;
  trust?: PlayerTrustSummary | null;
}) {
  const playerLabel = playerDisplayName(participant, trust);
  const isApproved = submission?.status === "approved";
  const proofDetailsVisible = Boolean(submission?.sender_account_name || submission?.sender_bank_name || submission?.transfer_reference || submission?.proof_url);

  return (
    <div className="motion-flow-card rounded-lg border border-line bg-surfaceWarm p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{participant?.slot.replace("_", " ") ?? "Open slot"}</p>
          <p className="mt-2 text-base font-black text-ink">{playerLabel}</p>
        </div>
        <Badge tone={submission ? fundingTone(submission.status) : "neutral"}>
          {submission ? displayLabel(submission.status) : "No proof"}
        </Badge>
      </div>
      <p className="mt-3 text-sm font-bold text-muted">{formatEntryAmount(room)} required</p>
      {submission ? (
        <div className="motion-state-card mt-3 rounded-md border border-line bg-white p-3 text-sm">
          {proofDetailsVisible ? (
            <>
              {submission.sender_account_name ? <p className="font-bold text-ink">{submission.sender_account_name}</p> : null}
              {submission.sender_bank_name ? <p className="mt-1 text-muted">{submission.sender_bank_name}</p> : null}
              {submission.transfer_reference ? <p className="mt-1 font-mono text-xs font-bold text-dim">Ref: {submission.transfer_reference}</p> : null}
            </>
          ) : (
            <p className="font-bold text-ink">
              {isApproved ? "Payment proof approved for this room." : "Payment proof submitted for review."}
            </p>
          )}
          {isApproved && !proofDetailsVisible ? (
            <p className="mt-1 text-muted">Sensitive receipt fields are intentionally hidden here after approval so the card stays clear without exposing unnecessary banking details.</p>
          ) : null}
          {submission.proof_url ? (
            <EvidenceMediaDrawer compact title="View screenshot" url={submission.proof_url} />
          ) : isApproved ? (
            <p className="mt-2 text-xs font-bold leading-5 text-muted">Approval is recorded even when a screenshot is not available on this room card.</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted">Waiting for bank, account name, and transfer screenshot.</p>
      )}
    </div>
  );
}

async function RoomHistoryPanel({ matchId }: { matchId: string }) {
  const timeline = await getMatchRoomTimeline(matchId);
  return (
    <Panel>
      <PanelHeader eyebrow="Room History" title="Room progress" description="Important room updates are saved here so support can review what happened if there is a dispute." />
      <div className="p-4">
        <Timeline items={buildAuditTimeline(timeline)} />
      </div>
    </Panel>
  );
}

function RoomHistoryFallback() {
  return (
    <Panel>
      <PanelHeader eyebrow="Room History" title="Room progress" description="Loading saved room events." />
      <div className="grid gap-3 p-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="rounded-md border border-line bg-surfaceWarm p-4" key={index}>
            <div className="h-4 w-32 rounded bg-surfaceHigh" />
            <div className="mt-3 h-3 w-56 rounded bg-surfaceHigh" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

async function loadTrustByUserId(participants: MatchParticipant[]) {
  const trustResults = await Promise.all(
    participants.map(async (participant) => {
      try {
        const result = await getPlayerTrustSummary(participant.user_id);
        return [participant.user_id, result.trust] as const;
      } catch {
        return [participant.user_id, null] as const;
      }
    })
  );
  return new Map<string, PlayerTrustSummary | null>(trustResults);
}

async function RoomPlayersIsland({
  participants,
  room
}: {
  participants: MatchParticipant[];
  room: MatchRoom;
}) {
  const trustByUserId = await loadTrustByUserId(participants);
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Panel className="scroll-mt-32" id="players">
        <PanelHeader eyebrow="Players" title="Room slots" description="Check who has joined, their payment status, and the game handle to use before play." />
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {(["player_a", "player_b"] as const).map((slot) => {
            const participant = participants.find((item) => item.slot === slot);
            const trust = participant ? trustByUserId.get(participant.user_id) : null;
            return (
              <div className="motion-flow-card rounded-lg border border-line bg-surfaceWarm p-4" key={slot}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{slot.replace("_", " ")}</p>
                  <Badge tone={participant ? "success" : "neutral"}>{participant ? "Joined" : "Open"}</Badge>
                </div>
                <p className="mt-3 text-lg font-black text-ink">{playerDisplayName(participant, trust)}</p>
                <p className="mt-2 text-sm font-bold text-muted">
                  {participant ? displayLabel(participant.funding_status) : "Waiting for opponent"}
                </p>
                {participant ? (
                  <div className="mt-4 rounded-md border border-line bg-white p-3">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-cyan">Game identity</p>
                    <p className="mt-2 font-mono text-sm font-black text-ink [overflow-wrap:anywhere]">{primaryHandleLabel(trust)}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      Use this handle or UID inside the game when inviting or confirming the opponent.
                    </p>
                  </div>
                ) : null}
                {trust ? (
                  <div className="mt-4">
                    <PlayerTrustCard compact trust={trust} />
                  </div>
                ) : participant ? (
                  <p className="mt-4 rounded-md border border-line bg-white p-3 text-sm font-bold text-muted">
                    Trust summary unavailable for this player.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="scroll-mt-32" id="room-flow">
        <PanelHeader eyebrow="Flow" title="Room checkpoints" />
        <div className="p-4">
          <Timeline items={buildProcessTimeline(room)} />
        </div>
      </Panel>
    </div>
  );
}

function RoomPlayersFallback({ participants, room }: { participants: MatchParticipant[]; room: MatchRoom }) {
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Panel className="scroll-mt-32" id="players">
        <PanelHeader eyebrow="Players" title="Room slots" description="Loading player details." />
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {(["player_a", "player_b"] as const).map((slot) => {
            const participant = participants.find((item) => item.slot === slot);
            return (
              <div className="rounded-lg border border-line bg-surfaceWarm p-4" key={slot}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{slot.replace("_", " ")}</p>
                  <Badge tone={participant ? "success" : "neutral"}>{participant ? "Joined" : "Open"}</Badge>
                </div>
                <p className="mt-3 text-lg font-black text-ink">{participantName(participant)}</p>
                <div className="mt-4 h-24 rounded-md border border-line bg-white" />
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel className="scroll-mt-32" id="room-flow">
        <PanelHeader eyebrow="Flow" title="Room checkpoints" />
        <div className="p-4">
          <Timeline items={buildProcessTimeline(room)} />
        </div>
      </Panel>
    </div>
  );
}

function RoomPlayersSummary({ participants, room }: { participants: MatchParticipant[]; room: MatchRoom }) {
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Panel className="scroll-mt-32" id="players">
        <PanelHeader eyebrow="Players" title="Room slots" description="Open this section to confirm player details before play." />
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {(["player_a", "player_b"] as const).map((slot) => {
            const participant = participants.find((item) => item.slot === slot);
            return (
              <div className="rounded-lg border border-line bg-surfaceWarm p-4" key={slot}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{slot.replace("_", " ")}</p>
                  <Badge tone={participant ? "success" : "neutral"}>{participant ? "Joined" : "Open"}</Badge>
                </div>
                <p className="mt-3 text-lg font-black text-ink">{participantName(participant)}</p>
                <p className="mt-2 text-sm font-bold text-muted">
                  {participant ? displayLabel(participant.funding_status) : "Waiting for opponent"}
                </p>
                {participant ? (
                  <PendingLink
                    className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
                    href="?trust=full#players"
                    pendingLabel="Loading trust..."
                  >
                    Open trust summary
                  </PendingLink>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="scroll-mt-32" id="room-flow">
        <PanelHeader eyebrow="Flow" title="Room checkpoints" />
        <div className="p-4">
          <Timeline items={buildProcessTimeline(room)} />
        </div>
      </Panel>
    </div>
  );
}

async function RoomLivestreamIsland({
  canManageLivestreams,
  canViewSensitiveInternals,
  isTournamentRoom,
  matchId,
  room
}: {
  canManageLivestreams: boolean;
  canViewSensitiveInternals: boolean;
  isTournamentRoom: boolean;
  matchId: string;
  room: MatchRoom;
}) {
  const [accessibleResult, streamingResult, manageableResult] = await Promise.all([
    listAccessibleLivestreams({ target_type: "match_room", match_room_id: matchId }).catch(() => ({ livestreams: [] as CommunityLivestreamLink[] })),
    listStreamingAccounts().catch(() => ({ accounts: [] as StreamingConnectedAccount[] })),
    canManageLivestreams
      ? listManageableLivestreams({ target_type: "match_room", match_room_id: matchId }).catch(() => ({ livestreams: [] as CommunityLivestreamLink[] }))
      : Promise.resolve({ livestreams: [] as CommunityLivestreamLink[] })
  ]);
  const livestreams = accessibleResult.livestreams;
  const streamingAccounts = streamingResult.accounts.filter((account) => account.status !== "revoked");
  const manageableLivestreams = manageableResult.livestreams;
  const primaryLivestream = [...livestreams]
    .filter((item) => Boolean(item.embed_url))
    .sort((left, right) => livestreamWatchRank(left) - livestreamWatchRank(right))[0] ?? null;
  const livestreamRoles: LivestreamRole[] = ["official", "player_a", "player_b"];

  return (
    <>
      <Panel className="max-w-full scroll-mt-32" id="live">
        <PanelHeader eyebrow="Watch Live" title="Match watch room" description="Watch this match live when a stream link has been added." />
        <div className="grid max-w-full gap-4 p-3 sm:p-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <div className="motion-atmosphere motion-state-card motion-glow min-w-0 max-w-full overflow-hidden rounded-xl border border-line bg-navy-950 text-white">
            {primaryLivestream?.embed_url ? (
              <>
                <div className="grid min-w-0 gap-3 border-b border-white/10 bg-white/5 px-4 py-3 sm:flex sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={livestreamStatusTone(livestreamPlaybackStatus(primaryLivestream))}>
                        {livestreamStatusLabel(livestreamPlaybackStatus(primaryLivestream))}
                      </Badge>
                      <Badge tone="cyan">{livestreamRoleLabel(livestreamRole(primaryLivestream))}</Badge>
                      <Badge tone="neutral">{primaryLivestream.provider}</Badge>
                    </div>
                    <h2 className="mt-2 max-w-full text-lg font-black text-white [overflow-wrap:anywhere]">{primaryLivestream.title}</h2>
                  </div>
                  <a className="inline-flex min-h-9 w-full items-center justify-center rounded-md border border-white/10 px-3 text-sm font-black text-cyan hover:text-action sm:w-auto sm:border-0 sm:px-0" href={primaryLivestream.stream_url} rel="noreferrer" target="_blank">
                    Open source
                  </a>
                </div>
                <iframe
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="aspect-video w-full"
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={primaryLivestream.embed_url}
                  title={primaryLivestream.title}
                />
              </>
            ) : (
              <div className="motion-standby motion-sheen grid min-h-[18rem] max-w-full place-items-center overflow-hidden p-5 text-center sm:p-6">
                <div className="min-w-0 max-w-md">
                  <Badge tone="neutral">Stand by</Badge>
                  <h2 className="mt-4 text-balance text-xl font-black text-white sm:text-2xl">No live stream added yet</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">
                    Add a YouTube, Twitch, or TikTok stream to make this room watchable.
                  </p>
                  {canManageLivestreams ? (
                    <a className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="#add-room-stream">
                      Add stream link manually
                    </a>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <div className="grid min-w-0 max-w-full gap-3">
            <div className="motion-flow-card min-w-0 max-w-full rounded-lg border border-cyan bg-cyanSoft p-4">
              <div className="grid min-w-0 gap-3 sm:flex sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Connected channel</p>
                  <h3 className="mt-2 text-base font-black text-ink [overflow-wrap:anywhere]">
                    {streamingAccounts.length ? "Your saved stream channels" : "No connected channel yet"}
                  </h3>
                </div>
                <a className="inline-flex min-h-9 w-full items-center justify-center rounded-full border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:border-action sm:w-auto" href="/profile#streaming-accounts">
                  Manage
                </a>
              </div>
              {streamingAccounts.length ? (
                <div className="mt-3 grid gap-2">
                  {streamingAccounts.slice(0, 3).map((account) => (
                    <div className="min-w-0 rounded-md border border-line bg-white p-3" key={account.id}>
                      <div className="grid min-w-0 gap-2 sm:flex sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-ink [overflow-wrap:anywhere]">{account.display_name}</p>
                          <p className="text-xs font-bold text-muted [overflow-wrap:anywhere]">{streamingProviderLabel(account.provider)}</p>
                        </div>
                        <Badge tone={connectedStreamStatusTone(account.live_status)}>{connectedStreamStatusLabel(account.live_status)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <a className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh sm:w-auto" href="/profile#streaming-accounts">
                  Connect YouTube or Twitch
                </a>
              )}
            </div>

            <div className="grid min-w-0 gap-3">
              {livestreamRoles.map((role) => {
                const roleStreams = livestreams.filter((item) => livestreamRole(item) === role);
                const bestStream = [...roleStreams].sort((left, right) => livestreamWatchRank(left) - livestreamWatchRank(right))[0] ?? null;
                const status = bestStream ? livestreamPlaybackStatus(bestStream) : "unavailable";
                return (
                  <div className="motion-flow-card min-w-0 max-w-full rounded-lg border border-line bg-white p-4" key={role}>
                    <div className="grid min-w-0 gap-3 sm:flex sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">{livestreamRoleLabel(role)}</p>
                        <h3 className="mt-2 text-base font-black text-ink [overflow-wrap:anywhere]">{bestStream?.title ?? "No stream added"}</h3>
                      </div>
                      <Badge tone={bestStream ? livestreamStatusTone(status) : "neutral"}>{bestStream ? livestreamStatusLabel(status) : "No stream yet"}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted [overflow-wrap:anywhere]">
                      {bestStream ? "Saved for this room." : livestreamEmptyRoleDetail(role, canManageLivestreams)}
                    </p>
                    {bestStream ? (
                      <a className="mt-3 inline-flex text-sm font-black text-cyan hover:text-action" href={bestStream.stream_url} rel="noreferrer" target="_blank">
                        Open {bestStream.provider}
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="motion-premium-panel motion-state-card min-w-0 rounded-lg border border-cyan bg-cyanSoft p-4">
              <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Match controls nearby</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="/chat">Open chat</a>
                {canViewSensitiveInternals ? <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="#result">Result and evidence</a> : null}
                {canViewSensitiveInternals && !isTournamentRoom ? <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="#funding">Funding status</a> : null}
                <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="#room-flow">Room checkpoints</a>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {canManageLivestreams ? (
        <Panel className="scroll-mt-32" id="add-room-stream">
          <PanelHeader eyebrow="Broadcast Controls" title="Add stream link manually" description="Paste the exact YouTube, Twitch, or TikTok stream for this room." />
          <div className="grid min-w-0 max-w-full gap-5 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <RoomActionForm action={createMatchLivestreamIslandAction} className="motion-premium-panel motion-flow-card grid min-w-0 max-w-full gap-3 rounded-md border border-line bg-white p-4">
              <input name="match_room_id" type="hidden" value={room.id} />
              <div className="grid min-w-0 gap-3 md:grid-cols-3">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Stream slot
                  <select className="min-h-11 min-w-0 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="stream_role">
                    <option value="official">Official room stream</option>
                    <option value="player_a">Player A stream</option>
                    <option value="player_b">Player B stream</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Visibility
                  <select className="min-h-11 min-w-0 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="visibility">
                    <option value="public">Public</option>
                    <option value="participants">Participants</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Status
                  <select className="min-h-11 min-w-0 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="playback_status">
                    <option value="live">Live</option>
                    <option value="offline">Offline</option>
                    <option value="replay">Replay</option>
                    <option value="unavailable">Link unavailable</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Title
                <input className="min-h-11 min-w-0 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" maxLength={140} name="title" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Stream link
                <input className="min-h-11 min-w-0 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="stream_url" required type="url" />
              </label>
              <SubmitButton idleLabel="Save livestream" pendingLabel="Saving livestream..." />
            </RoomActionForm>

            <div className="grid min-w-0 max-w-full gap-3 rounded-md border border-line bg-white p-4">
              {manageableLivestreams.length ? (
                manageableLivestreams.map((item) => (
                  <div className="motion-flow-card rounded-md border border-line bg-surfaceWarm p-4" key={item.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={item.status === "active" ? "success" : "danger"}>{item.status}</Badge>
                      <Badge tone="cyan">{item.provider}</Badge>
                      <Badge tone="neutral">{livestreamRoleLabel(livestreamRole(item))}</Badge>
                    </div>
                    <h3 className="mt-3 text-base font-black text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted [overflow-wrap:anywhere]">{item.stream_url}</p>
                    {item.status !== "archived" ? (
                      <form action={archiveMatchLivestreamAction} className="mt-3">
                        <input name="match_room_id" type="hidden" value={room.id} />
                        <input name="livestream_id" type="hidden" value={item.id} />
                        <SubmitButton idleLabel="Archive" pendingLabel="Archiving..." size="sm" variant="secondary" />
                      </form>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm font-bold text-muted">No room livestream links saved yet.</p>
              )}
            </div>
          </div>
        </Panel>
      ) : null}
    </>
  );
}

function RoomLivestreamFallback() {
  return (
    <Panel className="max-w-full scroll-mt-32" id="live">
      <PanelHeader eyebrow="Watch Live" title="Match watch room" description="Loading stream links and saved channels." />
      <div className="grid max-w-full gap-4 p-3 sm:p-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="min-h-[18rem] rounded-xl border border-line bg-navy-950" />
        <div className="grid gap-3">
          <div className="h-32 rounded-lg border border-line bg-surfaceWarm" />
          <div className="h-24 rounded-lg border border-line bg-surfaceWarm" />
          <div className="h-24 rounded-lg border border-line bg-surfaceWarm" />
        </div>
      </div>
    </Panel>
  );
}

function RoomLivestreamSummary() {
  return (
    <Panel className="max-w-full scroll-mt-32" id="live">
      <PanelHeader eyebrow="Watch Live" title="Match watch room" description="Open this section to watch the match or add a stream link." />
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <p className="text-sm leading-6 text-muted">
          Live links appear here when a player or the Skillsroom team adds a stream for this room.
        </p>
        <PendingLink
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
          href="?streams=full#live"
          pendingLabel="Loading streams..."
        >
          Open live room
        </PendingLink>
      </div>
    </Panel>
  );
}

export default async function MatchDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ error?: string; invite_sent?: string; checked_in?: string; livestream_saved?: string; livestream_archived?: string; play_started?: string; balance_funded?: string; streams?: string; trust?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/matches");
  const { matchId } = await params;
  const {
    error,
    invite_sent: inviteSent,
    checked_in: checkedInSuccess,
    livestream_saved: livestreamSaved,
    livestream_archived: livestreamArchived,
    play_started: playStarted,
    balance_funded: balanceFunded,
    streams,
    trust
  } = await searchParams;
  const fullStreamsRequested = streams === "full";
  const fullTrustRequested = trust === "full";

  let data: MatchTimeline | null = null;
  let funding: RoomFundingOverview | null = null;
  let results: RoomResultOverview | null = null;
  let walletOverview: Awaited<ReturnType<typeof getWalletOverview>> | null = null;
  let tournamentDetail: TournamentDetail | null = null;
  let publicWinnerPage: CommunityMatchWinnerPage | null = null;
  let loadError: string | null = null;

  try {
    const shell = await getMatchRoomShell(matchId);
    data = { ...shell, events: [] };
    const tournamentId = metadataString(data.room.metadata, "tournament_id");
    if (tournamentId) {
      const tournamentResult = await getTournamentDetail(tournamentId);
      tournamentDetail = tournamentResult.tournament;
    }
  } catch {
    loadError = "This room could not load. Check the room link and your session, then try again.";
  }

  if (!data) {
    return (
      <AppShell active="matches">
        <Panel>
          <PanelHeader eyebrow="Room" title="Room unavailable" description={error ?? loadError ?? "The room could not be loaded."} />
          <div className="p-4">
            <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/matches" pendingLabel="Opening rooms...">
              Back to rooms
            </PendingLink>
          </div>
        </Panel>
      </AppShell>
    );
  }

  const room = data.room;
  const participants = data.participants;
  const tournamentId = metadataString(room.metadata, "tournament_id");
  const tournamentMatchId = metadataString(room.metadata, "tournament_match_id");
  const isTournamentRoom = Boolean(tournamentId && tournamentMatchId);
  const { match: tournamentMatch, stage: tournamentStage, round: tournamentRound, sides: tournamentSides } =
    tournamentMatchContext(tournamentDetail, tournamentMatchId);
  const tournamentCheckIns = data.tournament_match_check_ins ?? [];
  const currentParticipant = participants.find((participant) => participant.user_id === user.id);
  const canViewSensitiveInternals =
    Boolean(currentParticipant) || ["moderator", "admin", "owner", "support"].includes(user.role);
  const allJoinedParticipantsApproved =
    participants.length > 0 && participants.every((participant) => participant.funding_status === "approved");
  const gameName = tournamentDetail?.game_name ?? "the game";
  const currentPlayerCheckedIn = currentParticipant
    ? tournamentCheckIns.some((checkIn) => checkIn.participant_id === currentParticipant.id)
    : false;

  if (canViewSensitiveInternals) {
    try {
      [funding, results, walletOverview] = await Promise.all([getRoomFunding(matchId), getRoomResults(matchId), getWalletOverview()]);
    } catch {
      loadError = loadError ?? "Room summary loaded, but detailed funding or result records could not be loaded right now.";
    }
  } else if (["settlement_pending", "completed"].includes(room.status)) {
    try {
      publicWinnerPage = await getMatchWinnerPage(matchId);
    } catch {
      publicWinnerPage = null;
    }
  }

  const trustByUserId = new Map<string, PlayerTrustSummary | null>();
  const latestClaim = results?.claims[0] ?? null;
  const fundedParticipants = participants.filter((participant) => participant.funding_status === "approved");
  const fundsLockedMinor = fundedParticipants.length * room.entry_amount_minor;
  const resultCheckpoint = resultCheckpointSummary(room, latestClaim);
  const payoutCheckpoint = payoutCheckpointSummary(room, latestClaim);
  const displayedParticipantCount = Math.max(participants.length, room.participant_count ?? 0);
  const [baseNextTitle, baseNextDetail] = nextAction(room, displayedParticipantCount);
  const [nextTitle, nextDetail] =
    isTournamentRoom && !currentPlayerCheckedIn && currentParticipant
      ? (["Check in for this match", "Confirm you are present before playing or submitting result evidence."] as const)
      : [baseNextTitle, baseNextDetail];
  const canOpen = room.status === "draft" && room.created_by_user_id === user.id;
  const roomAllowsFundingSubmission = ["awaiting_funding", "funding_review"].includes(room.status);
  const currentFundingStatus = currentParticipant?.funding_status ?? null;
  const canSubmitFunding =
    roomAllowsFundingSubmission &&
    Boolean(currentParticipant) &&
    (currentFundingStatus === "pending" || currentFundingStatus === "rejected");
  const availableBalanceMinor = walletOverview?.account.available_balance_minor ?? 0;
  const canPayWithBalance = canSubmitFunding && availableBalanceMinor >= room.entry_amount_minor;
  const canStartPlay =
    room.status === "funded" &&
    participants.length === room.max_participants &&
    allJoinedParticipantsApproved &&
    canViewSensitiveInternals;
  const canSubmitResult = canViewSensitiveInternals && ["active", "awaiting_results", "under_review", "disputed"].includes(room.status);
  const canTournamentCheckIn =
    isTournamentRoom &&
    Boolean(currentParticipant) &&
    !currentPlayerCheckedIn &&
    ["funded", "active", "awaiting_results", "under_review"].includes(room.status);
  const canManageLivestreams =
    user.role === "owner" ||
    user.role === "admin" ||
    user.role === "moderator" ||
    user.role === "support" ||
    room.created_by_user_id === user.id ||
    (Boolean(tournamentId) &&
      Boolean(
        tournamentDetail?.hosts.find(
          (host) =>
            host.user_id === user.id &&
            host.status === "active" &&
            ((typeof host.permissions?.manage_event === "boolean" && host.permissions.manage_event) || host.role !== "sponsor")
        )
      ));
  const fundingSectionVisible = !isTournamentRoom && canViewSensitiveInternals;
  const resultSectionVisible =
    canSubmitResult ||
    Boolean(latestClaim) ||
    ["active", "awaiting_results", "under_review", "disputed", "settlement_pending", "completed", "cancelled"].includes(room.status);
  const roomNavItems = [
    { href: "#overview", label: "Overview" },
    { href: "#players", label: "Players" },
    ...(fundingSectionVisible ? [{ href: "#funding", label: "Funding" }] : []),
    { href: "#live", label: "Live" },
    ...(resultSectionVisible ? [{ href: "#result", label: "Result" }] : [])
  ];
  const primaryAction =
    canSubmitFunding
      ? { href: "#funding", label: "Submit funding" }
      : canSubmitResult
        ? { href: "#result", label: "Submit result" }
        : canManageLivestreams
          ? { href: "#live", label: "Add livestream" }
          : { href: "#players", label: displayedParticipantCount < room.max_participants ? "Check players" : "View players" };

  return (
    <AppShell active="matches">
      <MotionSection className="grid max-w-full gap-5 overflow-x-hidden md:gap-6" variant="page">
        <MotionSection className="motion-state-card rounded-lg border border-line bg-navy-900 p-5 text-white shadow-panel md:p-7" variant="hero">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <Badge tone={statusTone(room.status)}>{matchStatusLabel(room.status)}</Badge>
              <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight md:text-5xl">
                {room.title ?? "Private match room"}
              </h1>
              <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-slate-300">
                <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono text-white">{room.room_code}</span>
                <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2">{isTournamentRoom ? "Tournament match" : `${formatEntryAmount(room)} entry`}</span>
                <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2">{displayedParticipantCount}/{room.max_participants} players</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {canOpen ? (
                <form action={openMatchRoomAction}>
                  <input name="match_room_id" type="hidden" value={room.id} />
                  <SubmitButton idleLabel="Open room" pendingLabel="Opening room..." />
                </form>
              ) : null}
              <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/10 bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/matches" pendingLabel="Opening rooms...">
                All rooms
              </PendingLink>
              {canStartPlay ? (
                <form action={startMatchPlayAction}>
                  <input name="match_room_id" type="hidden" value={room.id} />
                  <SubmitButton idleLabel="Start match" pendingLabel="Starting match..." />
                </form>
              ) : null}
              {canSubmitResult ? (
                <a className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="#result">
                  Submit result
                </a>
              ) : null}
            </div>
          </div>
        </MotionSection>

        <LiveUpdateStream
          autoConnect={false}
          eventTypePrefixes={["match.", "notification.", "room.invite."]}
          label="Room live"
          matchRoomId={room.id}
          tournamentId={tournamentId ?? undefined}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <RealtimePatchStatus label="Room state" targets={["room"]} />
          <RealtimePatchStatus label="Funding" targets={["room-funding", "wallet"]} />
          <RealtimePatchStatus label="Results" targets={["room-result"]} />
        </div>

        {error ? <TransientStatusBanner clearKeys={["error"]} durationMs={10000} message={error} /> : null}
        {inviteSent ? <TransientStatusBanner clearKeys={["invite_sent"]} durationMs={12000} message="Invite sent. The player will see it in their notifications." tone="success" /> : null}
        {checkedInSuccess ? <TransientStatusBanner clearKeys={["checked_in"]} durationMs={12000} message="Tournament match check-in recorded." tone="success" /> : null}
        {livestreamSaved ? <TransientStatusBanner clearKeys={["livestream_saved"]} durationMs={12000} message="Livestream link saved." tone="success" /> : null}
        {livestreamArchived ? <TransientStatusBanner clearKeys={["livestream_archived"]} durationMs={12000} message="Livestream archived." tone="success" /> : null}
        {playStarted ? <TransientStatusBanner clearKeys={["play_started"]} durationMs={10000} message="Match play started. Submit result evidence after the game is complete." tone="success" /> : null}
        {balanceFunded ? <TransientStatusBanner clearKeys={["balance_funded"]} durationMs={10000} message="Entry paid from Skillsroom Balance. Your funds are locked for this room." tone="success" /> : null}

        <nav className="sticky top-16 z-30 max-w-full overflow-hidden rounded-2xl border border-line bg-white/95 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur md:top-16">
          <div className="flex max-w-full gap-2 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-3">
            {roomNavItems.map((item) => (
              <a
                className="motion-tap inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surfaceHigh px-4 text-sm font-black text-ink hover:border-cyan hover:bg-cyanSoft"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <section className="scroll-mt-32" id="overview">
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
            <Panel className="motion-atmosphere p-4">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-cyan">Do this next</p>
              <h2 className="mt-2 text-2xl font-black text-ink">{nextTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{nextDetail}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {canOpen ? (
                  <form action={openMatchRoomAction}>
                    <input name="match_room_id" type="hidden" value={room.id} />
                    <SubmitButton idleLabel="Open room" pendingLabel="Opening room..." />
                  </form>
                ) : null}
                {canStartPlay ? (
                  <form action={startMatchPlayAction}>
                    <input name="match_room_id" type="hidden" value={room.id} />
                    <SubmitButton idleLabel="Start match" pendingLabel="Starting match..." />
                  </form>
                ) : null}
                {!canOpen && !canStartPlay ? (
                  <a className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href={primaryAction.href}>
                    {primaryAction.label}
                  </a>
                ) : null}
                <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="#room-flow">
                  See checkpoints
                </a>
              </div>
            </Panel>
            <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <Panel className="p-4">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">Entry</p>
                <p className="mt-2 text-2xl font-black text-warning">{isTournamentRoom ? "Tournament" : formatEntryAmount(room)}</p>
                <p className="mt-2 text-sm font-bold text-muted">{isTournamentRoom ? "Entry handled by event policy" : "Equal amount for both players"}</p>
              </Panel>
              <Panel className="p-4">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">Players</p>
                <p className="mt-2 text-2xl font-black text-success">{displayedParticipantCount}/{room.max_participants}</p>
                <p className="mt-2 text-sm font-bold text-muted">Fixed two-player room</p>
              </Panel>
              <Panel className="p-4">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">Status</p>
                <p className="mt-2 text-2xl font-black text-cyan">{matchStatusLabel(room.status)}</p>
                <p className="mt-2 text-sm font-bold text-muted">Room progress is saved</p>
              </Panel>
            </div>
          </div>
        </section>

        {!canViewSensitiveInternals ? (
          <Panel>
            <PanelHeader
              eyebrow="Room Activity"
              title="Public-safe room summary"
              description="Signed-in users can see who played and the current outcome. Payment proof, match evidence, and review notes stay visible only to the players involved and the Skillsroom team."
            />
            <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  {participants.map((participant) => {
                    const trust = trustByUserId.get(participant.user_id);
                    return (
                      <div className="rounded-md border border-line bg-white p-4" key={participant.id}>
                        <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">{participant.slot.replace("_", " ")}</p>
                        <p className="mt-2 text-lg font-black text-ink">{playerDisplayName(participant, trust)}</p>
                        <p className="mt-2 text-sm font-bold text-muted">{primaryHandleLabel(trust)}</p>
                      </div>
                    );
                  })}
                </div>
                {publicWinnerPage ? (
                  <div className="rounded-md border border-success/30 bg-green-50 p-4">
                    <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-success">Approved outcome</p>
                    <h2 className="mt-2 text-xl font-black text-ink">{publicWinnerPage.winner.label}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Defeated {publicWinnerPage.opponent?.label ?? "the verified opponent"} in {publicWinnerPage.room.title ?? publicWinnerPage.room.room_code}.
                    </p>
                    <div className="mt-3 grid gap-2 text-sm font-bold text-muted sm:grid-cols-2">
                      <span>Result: {publicWinnerPage.result.status_label}</span>
                      <span>Score: {scoreSummaryLabel(publicWinnerPage.result.score_summary)}</span>
                    </div>
                    <PendingLink
                      className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
                      href={publicWinnerPage.share_path}
                      pendingLabel="Opening winner page..."
                    >
                      Open public winner page
                    </PendingLink>
                  </div>
                ) : (
                  <div className="rounded-md border border-line bg-surfaceWarm p-4 text-sm leading-6 text-muted">
                    {room.status === "completed" || room.status === "settlement_pending"
                      ? "This room is finished. Winner details will appear here once the result summary is ready."
                      : "This room summary is visible, but payment and evidence details stay private to the players involved and the Skillsroom team."}
                  </div>
                )}
              </div>
              <div className="rounded-md border border-line bg-surfaceWarm p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Visibility rules</p>
                <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
                  <li>Signed-in users can see completed room cards and safe outcome context.</li>
                  <li>Only the players involved and the Skillsroom team can open payment proof, result evidence, and review notes.</li>
                  <li>Public sharing belongs on the winner page, not inside the room details.</li>
                </ul>
              </div>
            </div>
          </Panel>
        ) : null}

        {isTournamentRoom ? (
          <Panel>
            <PanelHeader
              eyebrow="Tournament Match"
              title={tournamentDetail?.title ?? room.title ?? "Tournament match"}
              description="This room is linked to a generated tournament match. Check in, confirm your opponent, play under the event rules, then submit evidence for admin review."
            />
            <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-line bg-surfaceWarm p-4">
                    <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Stage</p>
                    <p className="mt-2 text-base font-black text-ink">{tournamentStage?.name ?? "Generated stage"}</p>
                  </div>
                  <div className="rounded-md border border-line bg-surfaceWarm p-4">
                    <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Round</p>
                    <p className="mt-2 text-base font-black text-ink">{tournamentRound?.name ?? "Generated round"}</p>
                  </div>
                  <div className="rounded-md border border-line bg-surfaceWarm p-4">
                    <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Match</p>
                    <p className="mt-2 text-base font-black text-ink">#{tournamentMatch?.match_number ?? room.room_code}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {tournamentSides.map((side: TournamentMatchSide) => {
                    const entry = tournamentDetail?.entries.find((item) => item.id === side.entry_id);
                    const participant = participants.find((item) => metadataString(item.metadata, "tournament_entry_id") === side.entry_id);
                    const checkedIn = participant ? tournamentCheckIns.some((checkIn) => checkIn.participant_id === participant.id) : false;
                    return (
                      <div className="rounded-md border border-line bg-white p-4" key={side.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Seed {side.seed ?? "-"}</p>
                            <p className="mt-2 text-lg font-black text-ink">{entryLabel(entry)}</p>
                          </div>
                          <Badge tone={checkedIn ? "success" : "warning"}>{checkedIn ? "Checked in" : "Pending"}</Badge>
                        </div>
                        <p className="mt-2 font-mono text-xs font-bold text-muted [overflow-wrap:anywhere]">{side.entry_id ?? "Unresolved entry"}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-md border border-line bg-cyanSoft p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Player check-in</p>
                <h2 className="mt-2 text-xl font-black text-ink">{currentPlayerCheckedIn ? "You are checked in" : "Confirm you are present"}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Check-in confirms you saw the matchup, opponent identity, room state, and evidence expectations before play.
                </p>
                <form action={checkInTournamentMatchRoomAction} className="mt-4">
                  <input name="match_room_id" type="hidden" value={room.id} />
                  <SubmitButton
                    disabled={!canTournamentCheckIn}
                    idleLabel={currentPlayerCheckedIn ? "Checked in" : "Check in"}
                    pendingLabel="Checking in..."
                  />
                </form>
                {!currentParticipant ? (
                  <p className="mt-3 text-xs font-bold leading-5 text-muted">Only assigned match participants can check in.</p>
                ) : null}
              </div>
            </div>
          </Panel>
        ) : null}

        <Reveal>
          {fullStreamsRequested ? (
            <Suspense fallback={<RoomLivestreamFallback />}>
              <RoomLivestreamIsland
                canManageLivestreams={canManageLivestreams}
                canViewSensitiveInternals={canViewSensitiveInternals}
                isTournamentRoom={isTournamentRoom}
                matchId={matchId}
                room={room}
              />
            </Suspense>
          ) : (
            <RoomLivestreamSummary />
          )}
        </Reveal>


        <Reveal>
          {fullTrustRequested ? (
            <Suspense fallback={<RoomPlayersFallback participants={participants} room={room} />}>
              <RoomPlayersIsland participants={participants} room={room} />
            </Suspense>
          ) : (
            <RoomPlayersSummary participants={participants} room={room} />
          )}
        </Reveal>


        {canViewSensitiveInternals ? (
          <Reveal>
          <Panel>
            <PanelHeader
              eyebrow="Payment summary"
              title="Entry status"
              description="Check each player's entry status before the match starts. The Skillsroom team confirms payments and handles payouts after review."
            />
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              {(["player_a", "player_b"] as const).map((slot) => {
                const participant = participants.find((item) => item.slot === slot);
                const trust = participant ? trustByUserId.get(participant.user_id) : null;
                const fundingMethod = fundingMethodSummary(funding, participant);
                return (
                  <div className="motion-flow-card rounded-lg border border-line bg-surfaceWarm p-4" key={slot}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{slot.replace("_", " ")}</p>
                        <p className="mt-2 text-lg font-black text-ink">{playerDisplayName(participant, trust)}</p>
                      </div>
                      <Badge tone={fundingMethod.tone}>{fundingMethod.label}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">{fundingMethod.detail}</p>
                    <div className="mt-4 grid gap-2 rounded-md border border-line bg-white p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-muted">Entry amount</span>
                        <span className="font-black text-ink">{formatEntryAmount(room)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-muted">Funding status</span>
                        <span className="font-black text-ink">{participant ? displayLabel(participant.funding_status) : "Open slot"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid gap-3 border-t border-line p-4 md:grid-cols-3">
              <div className="motion-flow-card rounded-lg border border-line bg-white p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Funds locked</p>
                <p className="mt-2 text-2xl font-black text-ink">{formatMinorMoney(room.currency, fundsLockedMinor)}</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {fundedParticipants.length}/{room.max_participants} player entries approved for this room.
                </p>
              </div>
              <div className="motion-flow-card rounded-lg border border-line bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Result</p>
                  <Badge tone={resultCheckpoint.tone}>{resultCheckpoint.label}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">{resultCheckpoint.detail}</p>
              </div>
              <div className="motion-flow-card rounded-lg border border-line bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Payout</p>
                  <Badge tone={payoutCheckpoint.tone}>{payoutCheckpoint.label}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">{payoutCheckpoint.detail}</p>
              </div>
            </div>
          </Panel>
          </Reveal>
        ) : null}

        {canStartPlay ? (
          <Reveal>
          <Panel>
            <PanelHeader
              eyebrow="Play"
              title="Start live play"
              description="Funding is complete. Start the match when both players are ready so the room enters live play and result evidence opens at the correct checkpoint."
            />
            <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <p className="text-sm leading-6 text-muted">
                This lets both players see that the match has started and opens result evidence when the match ends.
              </p>
              <form action={startMatchPlayAction}>
                <input name="match_room_id" type="hidden" value={room.id} />
                <SubmitButton idleLabel="Start match now" pendingLabel="Starting match..." />
              </form>
            </div>
          </Panel>
          </Reveal>
        ) : null}

        {!isTournamentRoom && canViewSensitiveInternals ? (
        <div className="grid min-w-0 gap-6 scroll-mt-32 xl:grid-cols-[minmax(0,1fr)_24rem]" id="funding">
          <Panel>
            <PanelHeader
              eyebrow="Funding"
              title="Choose how to fund this room"
              description="Use your approved Skillsroom Balance for instant payment, or upload bank payment proof if you prefer."
            />
            <div className="grid gap-3 border-b border-line p-4">
              <div className="motion-state-card rounded-lg border border-cyan bg-cyanSoft p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-cyan">Skillsroom Balance</p>
                    <h2 className="mt-2 text-xl font-black text-ink">Pay instantly from balance</h2>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Available: <span className="font-black text-ink">{formatMinorMoney(room.currency, availableBalanceMinor)}</span>. Required: <span className="font-black text-ink">{formatEntryAmount(room)}</span>.
                    </p>
                  </div>
                  <form action={payRoomWithBalanceAction} className="shrink-0">
                    <input name="match_room_id" type="hidden" value={room.id} />
                    <SubmitButton disabled={!canPayWithBalance} idleLabel="Use balance" pendingLabel="Locking funds..." />
                  </form>
                </div>
                {!canSubmitFunding && currentFundingStatus === "approved" ? (
                  <p className="mt-3 text-sm font-bold text-success">Your room entry is already funded.</p>
                ) : canSubmitFunding && !canPayWithBalance ? (
                  <p className="mt-3 text-sm font-bold text-muted">
                    Your balance is not enough for this room. <a className="font-black text-cyan hover:text-action" href="/wallet">Top up your wallet</a> or use manual transfer below.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="border-b border-line p-4">
              <ManualPaymentPanel
                amountLabel="Exact transfer amount"
                amountValue={formatEntryAmount(room)}
                referenceHint={`Use room code ${room.room_code} in the transfer narration or note if your banking app supports it.`}
              />
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {(["player_a", "player_b"] as const).map((slot) => {
                const participant = participants.find((item) => item.slot === slot);
                const trust = participant ? trustByUserId.get(participant.user_id) : null;
                const submission = selectFundingSubmission(funding?.submissions, participant?.id);
                return <FundingCard key={slot} participant={participant} room={room} submission={submission ?? undefined} trust={trust} />;
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Submit Funding" title="Transfer proof" description="Amount, sender bank, account name, and screenshot are enough for review." />
            <RoomActionForm action={submitManualFundingIslandAction} className="motion-flow-card grid gap-3 p-4">
              {currentParticipant ? (
                currentFundingStatus === "approved" && ["awaiting_funding", "funding_review", "funded"].includes(room.status) ? (
                  <TransientStatusBanner
                    clearKeys={[]}
                    message={
                      room.status === "funded" || allJoinedParticipantsApproved
                        ? "Both funding approvals are in. Start the match when both players are ready."
                        : "Your own funding is already approved. We are waiting for the other player so the room can move forward."
                    }
                    tone="success"
                  />
                ) : currentFundingStatus === "submitted" ? (
                  <div className="rounded-md border border-orange-200 bg-warningSoft p-4 text-sm font-bold text-warning">
                    Your payment proof is already under review. Wait for Skillsroom approval before sending anything again.
                  </div>
                ) : currentFundingStatus === "rejected" ? (
                  <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
                    Your last payment proof was rejected. Submit a corrected proof to continue.
                  </div>
                ) : null
              ) : (
                <div className="rounded-md border border-line bg-surfaceWarm p-4 text-sm font-bold text-muted">
                  Join this room first before submitting your own funding proof.
                </div>
              )}
              <input name="match_room_id" type="hidden" value={room.id} />
              <label className="grid gap-2 text-sm font-bold text-ink">
                Amount (NGN)
                <input className="min-h-11 rounded-md border border-line bg-surfaceHigh px-3 text-sm" name="amount_naira" readOnly value={room.entry_amount_minor / 100} />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" disabled={!canSubmitFunding} name="sender_bank_name" placeholder="OPay, GTBank, Moniepoint..." required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Transfer reference <span className="font-bold text-muted">(optional)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" disabled={!canSubmitFunding} name="transfer_reference" placeholder={`Narration or receipt reference for ${room.room_code}`} />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Account name
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" disabled={!canSubmitFunding} name="sender_account_name" placeholder="Name shown on the transfer" required />
              </label>
              <div className="rounded-md border border-cyan bg-cyanSoft p-4 text-sm leading-6 text-muted">
                <span className="font-black text-ink">Winner payout details</span>
              </div>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout recipient name
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" disabled={!canSubmitFunding} name="payout_recipient_name" placeholder="Account holder name for payout or refund" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout bank
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" disabled={!canSubmitFunding} name="payout_bank_name" placeholder="OPay, GTBank, PalmPay..." required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout account number
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" disabled={!canSubmitFunding} inputMode="numeric" name="payout_account_number" pattern="[0-9]{6,20}" placeholder="Destination account number" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout bank code <span className="font-bold text-muted">(optional)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" disabled={!canSubmitFunding} name="payout_bank_code" placeholder="Routing or bank code if needed" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout note <span className="font-bold text-muted">(optional)</span>
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" disabled={!canSubmitFunding} name="payout_note" placeholder="Optional instruction for ops, like preferred account label." />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Transfer screenshot
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-surfaceHigh file:px-3 file:py-2 file:text-xs file:font-black file:text-ink focus:border-action"
                  disabled={!canSubmitFunding}
                  name="proof_file"
                  required
                  type="file"
                />
                <span className="text-xs leading-5 text-muted">Upload the bank/fintech receipt screenshot. Images up to 8MB.</span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Proof link <span className="font-bold text-muted">(optional)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" disabled={!canSubmitFunding} name="proof_url" placeholder="Use if the screenshot is hosted elsewhere" type="url" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Note <span className="font-bold text-muted">(optional)</span>
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" disabled={!canSubmitFunding} name="proof_note" placeholder="Anything admin should know" />
              </label>
              <SubmitButton disabled={!canSubmitFunding} idleLabel="Submit funding" pendingLabel="Submitting funding..." />
              {!canSubmitFunding && currentFundingStatus === "approved" ? (
                <p className="text-xs font-bold leading-5 text-muted">
                  {room.status === "funded"
                    ? "Your slot is approved. Start live play when both players are ready."
                    : "Your slot is already approved. The room will stay in funding review until the opponent is approved too."}
                </p>
              ) : null}
              {!canSubmitFunding && currentFundingStatus === "submitted" ? (
                <p className="text-xs font-bold leading-5 text-muted">A submission already exists for your slot, so this form stays locked until admin reviews it.</p>
              ) : null}
              {!canSubmitFunding && room.status === "open" && currentParticipant ? (
                <p className="text-xs font-bold leading-5 text-muted">Share the room code first. Payment proof opens as soon as the second player joins.</p>
              ) : null}
              {!canSubmitFunding && !currentParticipant ? (
                <p className="text-xs font-bold leading-5 text-muted">Only joined room participants can submit funding for this room.</p>
              ) : null}
            </RoomActionForm>
          </Panel>
        </div>
        ) : null}

        <details className="group overflow-hidden rounded-[1.35rem] border border-line bg-white shadow-panel">
          <summary className="motion-tap flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-left font-black text-ink marker:hidden">
            <span>
              <span className="block font-mono text-xs uppercase tracking-[0.12em] text-cyan">More room tools</span>
              <span className="mt-1 block text-lg">Game lobby and invite details</span>
            </span>
            <span className="rounded-full border border-line bg-surfaceHigh px-3 py-1 text-xs text-muted group-open:hidden">Show</span>
            <span className="hidden rounded-full border border-line bg-surfaceHigh px-3 py-1 text-xs text-muted group-open:inline-flex">Hide</span>
          </summary>
          <div className="grid min-w-0 gap-6 border-t border-line p-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <Panel>
              <PanelHeader
                eyebrow={isTournamentRoom ? "Event Play" : "Game Lobby"}
                title="How to connect in-game"
                description={`Skillsroom keeps the room record. Players still meet inside ${gameName} to play the match.`}
              />
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {[
                  ["1", "Copy opponent identity", "Use the game handle or UID shown above, not their Skillsroom email."],
                  ["2", "Create or join lobby", "One player creates the private game lobby and shares the in-game room code if needed."],
                  ["3", "Capture pre-match proof", "Screenshot the lobby showing both players before the match starts."],
                  ["4", isTournamentRoom ? "Check in before play" : "Play only after funding", isTournamentRoom ? "Do not start until both assigned players are present and the room state is active." : "Do not start until Skillsroom shows funding approved or active room state."]
                ].map(([step, title, detail]) => (
                  <div className="rounded-md border border-line bg-surfaceWarm p-4" key={step}>
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-cyanSoft font-mono text-xs font-black text-cyan">{step}</span>
                    <h3 className="mt-3 text-base font-black text-ink">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
                  </div>
                ))}
              </div>
            </Panel>

            {!isTournamentRoom && canViewSensitiveInternals ? (
            <Panel>
              <PanelHeader eyebrow="Invite" title="Invite by username" description="Open the room first, then invite a known player by Skillsroom username." />
              <form action={createRoomInviteAction} className="grid gap-3 p-4">
                <input name="match_room_id" type="hidden" value={room.id} />
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Skillsroom username
                  <input
                    className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                    maxLength={24}
                    minLength={3}
                    name="invitee_username"
                    pattern="[A-Za-z0-9_]+"
                    placeholder="player_username"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Message
                  <textarea
                    className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action"
                    maxLength={240}
                    name="message"
                    placeholder={`Join ${room.room_code} on Skillsroom.`}
                  />
                </label>
                <SubmitButton disabled={room.status !== "open" || participants.length >= room.max_participants} idleLabel="Send invite" pendingLabel="Sending invite..." />
                {room.status !== "open" ? (
                  <p className="text-xs font-bold leading-5 text-muted">This room must be open before the invited player can accept and join.</p>
                ) : null}
              </form>
            </Panel>
            ) : (
              <Panel>
                <PanelHeader eyebrow="Tournament" title="Tournament room" description="Tournament opponents are assigned by the event setup." />
                <div className="grid gap-3 p-4 text-sm leading-6 text-muted">
                  <p className="font-bold text-ink">Invites are disabled for tournament rooms.</p>
                  <p>Use the assigned opponent shown above, check in for the match, then submit result evidence when play ends.</p>
                  {tournamentDetail ? (
                    <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href={`/tournaments/${tournamentDetail.id}`} pendingLabel="Opening tournament...">
                      View tournament
                    </PendingLink>
                  ) : null}
                </div>
              </Panel>
            )}
          </div>
        </details>

        {canViewSensitiveInternals ? (
        <div className="grid min-w-0 gap-6 scroll-mt-32 xl:grid-cols-[minmax(0,1fr)_24rem]" id="result">
          <Panel>
            <PanelHeader
              eyebrow="Result"
              title="Claims, responses, and evidence"
              description="Result decisions stay attached to this room before settlement can proceed."
            />
            <div className="grid gap-3 p-4">
              {results?.claims.length ? (
                results.claims.map((claim) => (
                  <div className="rounded-lg border border-line bg-surfaceWarm p-4" key={claim.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">Score claim</p>
                        <p className="mt-2 text-xl font-black text-ink">{scoreSummaryLabel(claim.score_summary)}</p>
                      </div>
                      <Badge tone={resultTone(claim.status)}>{displayLabel(claim.status)}</Badge>
                    </div>
                    <p className="mt-3 text-sm font-bold text-muted">
                      Claimed winner: {playerDisplayName(
                        results.participants.find((item) => item.id === claim.claimed_winner_participant_id),
                        trustByUserId.get(results.participants.find((item) => item.id === claim.claimed_winner_participant_id)?.user_id ?? "")
                      )}
                    </p>
                    {claim.note ? <p className="mt-2 text-sm leading-6 text-muted">{claim.note}</p> : null}
                    {results.evidence_items.filter((item) => item.result_claim_id === claim.id).length ? (
                      <div className="mt-4 grid gap-2">
                        {results.evidence_items
                          .filter((item) => item.result_claim_id === claim.id)
                          .map((item) => (
                            <EvidenceMediaDrawer
                              className="text-sm"
                              description={item.notes}
                              key={item.id}
                              title={item.title}
                              url={item.uri}
                            >
                              <span className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-cyan">{displayLabel(item.evidence_type)}</span>
                              <span className="mt-1 block [overflow-wrap:anywhere]">{item.title}</span>
                              {item.notes ? <span className="mt-1 block text-xs leading-5 text-muted">{item.notes}</span> : null}
                            </EvidenceMediaDrawer>
                          ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-line bg-surfaceWarm p-6">
                  <p className="text-lg font-black text-ink">No result claim yet</p>
                  <p className="mt-2 text-sm leading-6 text-muted">When the match is done, submit the winner, optional score summary, and evidence here.</p>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow={canSubmitResult ? "Submit Result" : "Result Gate"}
              title={canSubmitResult ? "Winner claim" : "Result evidence will open after play starts"}
            />
            <div className="border-b border-line p-4">
              <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Evidence checklist</p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
                <li>Pre-match lobby screenshot showing both player handles.</li>
                <li>Final scoreboard screenshot or short screen recording.</li>
                <li>Add a score line only when the game actually produces one.</li>
                <li>Do not crop out usernames, room code, or final result.</li>
              </ul>
            </div>
            {canSubmitResult ? (
              <RoomActionForm action={submitResultClaimIslandAction} className="grid gap-3 p-4">
                <input name="match_room_id" type="hidden" value={room.id} />
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Claimed winner
                  <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="claimed_winner_participant_id" required>
                    {(results?.participants ?? participants).map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {playerOptionLabel(participant, trustByUserId.get(participant.user_id))}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Score summary <span className="font-bold text-muted">(optional)</span>
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="score_summary" placeholder="2-1, Booyah, placement result, forfeit" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Evidence type
                  <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="evidence_type">
                    <option value="screenshot">Screenshot</option>
                    <option value="video">Video</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Upload evidence
                  <input
                    accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                    className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-surfaceHigh file:px-3 file:py-2 file:text-xs file:font-black file:text-ink focus:border-action"
                    name="evidence_file"
                    required
                    type="file"
                  />
                  <span className="text-xs leading-5 text-muted">Images up to 8MB. Videos up to 80MB.</span>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Claim note <span className="font-bold text-muted">(optional)</span>
                  <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" placeholder="Short result context for review, for example overtime, disconnect, or forfeit." />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Evidence title <span className="font-bold text-muted">(optional)</span>
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="Final scoreboard" name="evidence_title" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Evidence notes
                  <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="evidence_notes" />
                </label>
                <SubmitButton idleLabel="Submit result" pendingLabel="Submitting result..." />
              </RoomActionForm>
            ) : (
              <div className="grid gap-4 p-4">
                <div className="rounded-md border border-cyan-200 bg-cyanSoft p-4 text-sm font-bold text-cyan">
                  {resultReadinessMessage(room, canStartPlay)}
                </div>
                {canStartPlay ? (
                  <form action={startMatchPlayAction} className="grid gap-3 sm:max-w-xs">
                    <input name="match_room_id" type="hidden" value={room.id} />
                    <SubmitButton idleLabel="Start match now" pendingLabel="Starting match..." />
                  </form>
                ) : null}
                <p className="text-xs font-bold leading-5 text-muted">
                  Score summaries stay optional because some games resolve through placement, eliminations, survival, forfeit, or other non-scoreline outcomes.
                </p>
              </div>
            )}
          </Panel>
        </div>
        ) : null}

        {canViewSensitiveInternals && latestClaim ? (
          <Panel>
            <PanelHeader eyebrow="Opponent Response" title="Respond to latest claim" description="Agree when the score is correct. Dispute only when evidence or rules need Skillsroom review." />
            <form action={respondToResultClaimAction} className="grid gap-3 p-4 md:grid-cols-[1fr_12rem_12rem]">
              <input name="match_room_id" type="hidden" value={room.id} />
              <input name="result_claim_id" type="hidden" value={latestClaim.id} />
              <textarea className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" placeholder="Response note" />
              <SubmitButton idleLabel="Agree" name="response" pendingLabel="Submitting..." value="agree" />
              <SubmitButton idleLabel="Dispute" name="response" pendingLabel="Submitting..." value="dispute" variant="danger" />
            </form>
          </Panel>
        ) : null}

        {canViewSensitiveInternals ? (
          <Suspense fallback={<RoomHistoryFallback />}>
            <RoomHistoryPanel matchId={room.id} />
          </Suspense>
        ) : null}
      </MotionSection>
    </AppShell>
  );
}
