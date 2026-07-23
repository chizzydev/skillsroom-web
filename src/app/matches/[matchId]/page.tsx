import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { EvidenceMediaDrawer } from "@/components/evidence/EvidenceMediaDrawer";
import { RoomActionForm } from "@/components/matches/RoomActionForm";
import { ManualPaymentPanel } from "@/components/payments/ManualPaymentPanel";
import { MotionSection, Reveal } from "@/components/motion";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { PlayerTrustCard } from "@/components/trust/PlayerTrustCard";
import { Badge } from "@/components/ui/Badge";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Timeline } from "@/components/ui/Timeline";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { getCurrentUser } from "@/lib/auth-bridge";
import { roomIssueRulesFromRuleset } from "@/lib/room-issue-rules";
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
  type MatchRoomShell,
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
  joinMatchRoomAction,
  openMatchRoomAction,
  payRoomWithBalanceIslandAction,
  startMatchPlayIslandAction,
  respondToResultClaimAction,
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

function statusTone(status: MatchRoomStatus, expired = false) {
  if (expired) return "neutral" as const;
  if (status === "open") return "cyan" as const;
  if (["awaiting_funding", "funding_review", "funded"].includes(status)) return "warning" as const;
  if (["under_review", "disputed", "voided"].includes(status)) return "danger" as const;
  if (["active", "awaiting_results", "settlement_pending", "completed"].includes(status)) return "success" as const;
  return "neutral" as const;
}

function resultTone(status: MatchResultClaim["status"]) {
  if (status === "admin_approved" || status === "opponent_agreed") return "success" as const;
  if (status === "opponent_disputed" || status === "admin_rejected") return "danger" as const;
  return "warning" as const;
}

function roomExpired(room: Pick<MatchRoom, "expires_at">) {
  return Boolean(room.expires_at && new Date(room.expires_at).getTime() <= Date.now());
}

function roomDisplayStatusLabel(room: MatchRoom, expired = false) {
  return expired ? "Expired" : matchStatusLabel(room.status);
}

function dateTimeLabel(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos"
  }).format(new Date(value));
}

function responseWindowExpired(claim: MatchResultClaim) {
  if (claim.opponent_response_overdue_at) return true;
  const dueAt = claim.opponent_response_due_at ? new Date(claim.opponent_response_due_at).getTime() : Number.NaN;
  return Number.isFinite(dueAt) && dueAt <= Date.now();
}

function timeRemainingLabel(value?: string | null) {
  if (!value) return "No deadline set";
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms)) return "No deadline set";
  if (ms <= 0) return "Deadline passed";
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `${hours} hr left`;
  return `${Math.ceil(hours / 24)} days left`;
}

function claimResponseStatus(claim: MatchResultClaim, responses: RoomResultOverview["responses"]) {
  const response = responses.find((item) => item.result_claim_id === claim.id);
  if (response?.response === "agree") {
    return { label: "Opponent agreed", detail: "Both players accepted the result.", tone: "success" as const };
  }
  if (response?.response === "dispute") {
    return { label: "Opponent disputed", detail: response.note ?? "Skillsroom review is needed before payout.", tone: "danger" as const };
  }
  if (responseWindowExpired(claim)) {
    return { label: "Response overdue", detail: "Skillsroom can now review this under the no-response rule.", tone: "warning" as const };
  }
  return {
    label: "Waiting for opponent",
    detail: `${timeRemainingLabel(claim.opponent_response_due_at)} - due ${dateTimeLabel(claim.opponent_response_due_at)}`,
    tone: "cyan" as const
  };
}

function claimReviewStatus(claim: MatchResultClaim, reviews: RoomResultOverview["reviews"]) {
  const review = reviews.find((item) => item.result_claim_id === claim.id) ?? null;
  if (!review) {
    if (claim.status === "opponent_disputed") return { label: "Admin review needed", detail: "Payout stays paused while Skillsroom checks the dispute.", tone: "danger" as const };
    if (claim.status === "submitted") return { label: "Not ready for final decision", detail: "Waiting for the opponent response window.", tone: "warning" as const };
    return { label: "Admin review pending", detail: "Skillsroom will check the room record before final payout.", tone: "warning" as const };
  }

  const decisionLabel =
    review.decision === "approve_claim"
      ? "Winner approved"
      : review.decision === "approve_no_response" || review.decision === "opponent_timeout_awarded"
        ? "Winner awarded after no response"
        : review.decision === "reject_claim"
          ? "Claim rejected"
          : review.decision === "mark_disputed"
            ? "Dispute kept open"
            : "Match voided, refunds queued";

  return {
    label: decisionLabel,
    detail: review.decision === "void_match"
      ? review.note ?? "No winner was confirmed. Entries are being returned."
      : review.note ?? `Final decision saved on ${dateTimeLabel(review.created_at)}.`,
    tone: review.decision === "approve_claim" || review.decision === "approve_no_response" || review.decision === "opponent_timeout_awarded" ? "success" as const : review.decision === "mark_disputed" || review.decision === "void_match" ? "danger" as const : "warning" as const
  };
}

function finalDecisionSummary(claim: MatchResultClaim | null, reviews: RoomResultOverview["reviews"], room: MatchRoom) {
  if (!claim) return "No final decision yet. A player must submit result proof first.";
  const review = reviews.find((item) => item.result_claim_id === claim.id) ?? null;
  if (review?.note) return review.note;
  if (review?.decision === "approve_claim") return "Winner confirmed after proof and player responses were checked.";
  if (review?.decision === "approve_no_response" || review?.decision === "opponent_timeout_awarded") {
    return "Winner awarded after the opponent did not respond before the deadline.";
  }
  if (review?.decision === "reject_claim") return "The submitted result was not accepted after review.";
  if (review?.decision === "mark_disputed") return "The dispute remains under Skillsroom review.";
  if (review?.decision === "void_match") return "No winner was confirmed. Refund handling is the next step.";
  if (claim.status === "admin_approved") return "Winner confirmed from the submitted proof.";
  if (claim.status === "admin_rejected") return "The submitted result was rejected.";
  if (room.status === "completed") return "Final decision is complete for this room.";
  if (room.status === "settlement_pending") return "Final decision is ready for prize review.";
  if (room.status === "voided") return "Match closed without a winner.";
  return "No final decision yet.";
}

function evidencePathCards(input: {
  claim: MatchResultClaim | null;
  evidenceCount: number;
  responses: RoomResultOverview["responses"];
  reviews: RoomResultOverview["reviews"];
  room: MatchRoom;
}) {
  const response = input.claim ? claimResponseStatus(input.claim, input.responses) : null;
  const review = input.claim ? claimReviewStatus(input.claim, input.reviews) : null;
  return [
    {
      label: "Required proof",
      value: input.evidenceCount ? `${input.evidenceCount} file${input.evidenceCount === 1 ? "" : "s"} saved` : "Screenshot or video needed",
      detail: input.evidenceCount ? "Admin can open the saved proof during review." : "Upload a final scoreboard screenshot or short result video.",
      tone: input.evidenceCount ? "success" as const : "warning" as const
    },
    {
      label: "Opponent response",
      value: response?.label ?? "Starts after claim",
      detail: response?.detail ?? "The other player gets a deadline to agree or dispute.",
      tone: response?.tone ?? "neutral" as const
    },
    {
      label: "Admin status",
      value: review?.label ?? "Not ready",
      detail: review?.detail ?? "Skillsroom review starts after proof and response status are clear.",
      tone: review?.tone ?? "neutral" as const
    },
    {
      label: "Final decision",
      value: ["completed", "settlement_pending"].includes(input.room.status) ? "Decision saved" : "Pending",
      detail: finalDecisionSummary(input.claim, input.reviews, input.room),
      tone: ["completed", "settlement_pending"].includes(input.room.status) ? "success" as const : "warning" as const
    }
  ];
}

function nextAction(room: MatchRoom, participantCount: number, expired = false) {
  if (expired) return ["Challenge expired", "This challenge window ended before another player accepted. Open it for history, or post a fresh challenge."] as const;
  if (room.status === "draft") return ["Open this room", "Review the details, then publish the room so an opponent can join."] as const;
  if (room.status === "open") return participantCount < room.max_participants
    ? (["Share the room code", "Send the code to an opponent or wait for a player to join from the lobby."] as const)
    : (["Confirm funding", "Both players are in. Funding proof is the next checkpoint."] as const);
  if (room.status === "awaiting_funding") return ["Complete your entry", "Use Skillsroom Balance or submit transfer proof. The room updates when your entry is confirmed."] as const;
  if (room.status === "funding_review") return ["Entry review", "Transfer proof or balance payment is being checked before play opens."] as const;
  if (room.status === "funded") return ["Confirm you are ready", "Both entries are confirmed. The match goes live after both players confirm."] as const;
  if (room.status === "active") return ["Submit result evidence", "After the match, submit the winner and proof for review."] as const;
  if (room.status === "awaiting_results") return ["Result needed", "A player should submit the winner and match proof."] as const;
  if (room.status === "under_review") return ["Review in progress", "Evidence and responses are being checked before payout."] as const;
  if (room.status === "disputed") return ["Dispute review", "Payout is paused while the Skillsroom team checks the issue."] as const;
  if (room.status === "settlement_pending") return ["Payout pending", "The winner is approved and payment is the next step."] as const;
  if (room.status === "completed") return ["Room completed", "This room is finished and saved in your history."] as const;
  return ["Room closed", "This room no longer accepts player actions."] as const;
}

function buildProcessTimeline(room: MatchRoom, expired = false) {
  const openDone = !["draft", "cancelled"].includes(room.status) && !expired;
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
    {
      label: expired ? "Expired" : "Open",
      detail: expired ? "The join window ended before another player accepted." : "Room is visible or shareable by code.",
      status: expired ? "current" as const : openDone ? "done" as const : "current" as const
    },
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

function resultReadinessMessage(room: MatchRoom, canConfirmStart: boolean) {
  if (room.status === "funded") {
    return canConfirmStart
      ? "Funding is complete. Confirm you are ready; the match goes live only after both players confirm."
      : "Your readiness is confirmed. Waiting for the other player before result evidence opens.";
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

async function RoomHistoryPanel({ matchId }: { matchId: string }) {
  let timeline: MatchTimeline | null = null;
  try {
    timeline = await getMatchRoomTimeline(matchId);
  } catch {
    timeline = null;
  }

  return (
    <Panel className="scroll-mt-32" id="room-history">
      <PanelHeader
        eyebrow="Room History"
        title="Room progress"
        description={
          timeline
            ? "Important room updates are saved here so support can review what happened if there is a dispute."
            : "The room opened, but the saved progress timeline could not load right now."
        }
      />
      <div className="p-4">
        {timeline ? (
          <Timeline items={buildAuditTimeline(timeline)} />
        ) : (
          <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
            Refresh this room in a moment if you need the full timeline. Funding, result, and player actions remain available above.
          </div>
        )}
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

function mergeLatestFundingParticipants(shellParticipants: MatchParticipant[], fundingParticipants?: MatchParticipant[]) {
  if (!fundingParticipants?.length) return shellParticipants;

  const shellById = new Map(shellParticipants.map((participant) => [participant.id, participant]));
  const mergedById = new Map<string, MatchParticipant>();

  for (const participant of fundingParticipants) {
    mergedById.set(participant.id, {
      ...shellById.get(participant.id),
      ...participant
    });
  }

  for (const participant of shellParticipants) {
    if (!mergedById.has(participant.id)) mergedById.set(participant.id, participant);
  }

  return Array.from(mergedById.values()).sort((a, b) => {
    const slotOrder = { player_a: 0, player_b: 1 } as const;
    return slotOrder[a.slot] - slotOrder[b.slot];
  });
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
          <Timeline items={buildProcessTimeline(room, room.status === "open" && roomExpired(room))} />
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
          <Timeline items={buildProcessTimeline(room, room.status === "open" && roomExpired(room))} />
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
          <Timeline items={buildProcessTimeline(room, room.status === "open" && roomExpired(room))} />
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
                <a className="inline-flex min-h-9 w-full items-center justify-center rounded-full border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:border-action sm:w-auto" href="/profile?sections=full#streaming-accounts">
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
                <a className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh sm:w-auto" href="/profile?sections=full#streaming-accounts">
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
  searchParams: Promise<{ error?: string; invite_sent?: string; checked_in?: string; livestream_saved?: string; livestream_archived?: string; play_started?: string; play_confirmed?: string; balance_funded?: string; streams?: string; trust?: string }>;
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
    play_confirmed: playConfirmed,
    balance_funded: balanceFunded,
    streams,
    trust
  } = await searchParams;
  const fullStreamsRequested = streams === "full";
  const fullTrustRequested = trust === "full";

  let data: (MatchRoomShell & { events: MatchTimeline["events"] }) | null = null;
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
      try {
        const tournamentResult = await getTournamentDetail(tournamentId);
        tournamentDetail = tournamentResult.tournament;
      } catch {
        loadError = "Room loaded, but tournament context could not load right now.";
      }
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

  const shellRoom = data.room;
  const shellParticipants = data.participants;
  const preliminaryCurrentParticipant = shellParticipants.find((participant) => participant.user_id === user.id);
  const canViewSensitiveInternals =
    Boolean(preliminaryCurrentParticipant) || ["moderator", "admin", "owner", "support"].includes(user.role);

  if (canViewSensitiveInternals) {
    try {
      [funding, results, walletOverview] = await Promise.all([getRoomFunding(matchId), getRoomResults(matchId), getWalletOverview()]);
    } catch {
      loadError = loadError ?? "Room summary loaded, but detailed funding or result records could not be loaded right now.";
    }
  } else if (["settlement_pending", "completed"].includes(shellRoom.status)) {
    try {
      publicWinnerPage = await getMatchWinnerPage(matchId);
    } catch {
      publicWinnerPage = null;
    }
  }

  const room = funding?.room ? { ...shellRoom, ...funding.room, participant_count: shellRoom.participant_count } : shellRoom;
  const roomIssueRules = roomIssueRulesFromRuleset(room.ruleset_rules);
  const participants = mergeLatestFundingParticipants(shellParticipants, funding?.participants);
  const tournamentId = metadataString(room.metadata, "tournament_id");
  const tournamentMatchId = metadataString(room.metadata, "tournament_match_id");
  const isTournamentRoom = Boolean(tournamentId && tournamentMatchId);
  const { match: tournamentMatch, stage: tournamentStage, round: tournamentRound, sides: tournamentSides } =
    tournamentMatchContext(tournamentDetail, tournamentMatchId);
  const tournamentCheckIns = data.tournament_match_check_ins ?? [];
  const startConfirmations = data.start_confirmations ?? [];
  const currentParticipant = participants.find((participant) => participant.user_id === user.id);
  const allJoinedParticipantsApproved =
    participants.length > 0 && participants.every((participant) => participant.funding_status === "approved");
  const gameName = tournamentDetail?.game_name ?? "the game";
  const currentPlayerCheckedIn = currentParticipant
    ? tournamentCheckIns.some((checkIn) => checkIn.participant_id === currentParticipant.id)
    : false;
  const currentPlayerStartConfirmed = currentParticipant
    ? startConfirmations.some((confirmation) => confirmation.participant_id === currentParticipant.id)
    : false;

  const trustByUserId = new Map<string, PlayerTrustSummary | null>();
  const latestClaim = results?.claims[0] ?? null;
  const displayedParticipantCount = Math.max(participants.length, room.participant_count ?? 0);
  const isExpiredOpenRoom = room.status === "open" && roomExpired(room);
  const [baseNextTitle, baseNextDetail] = nextAction(room, displayedParticipantCount, isExpiredOpenRoom);
  const [nextTitle, nextDetail] =
    isTournamentRoom && !currentPlayerCheckedIn && currentParticipant
      ? (["Check in for this match", "Confirm you are present before playing or submitting result evidence."] as const)
      : [baseNextTitle, baseNextDetail];
  const canOpen = room.status === "draft" && room.created_by_user_id === user.id;
  const roomAllowsFundingSubmission = ["awaiting_funding", "funding_review"].includes(room.status);
  const currentFundingStatus = currentParticipant?.funding_status ?? null;
  const currentEntryApproved = currentFundingStatus === "approved";
  const currentEntrySubmitted = currentFundingStatus === "submitted";
  const confirmedEntryCount = participants.filter((participant) => participant.funding_status === "approved").length;
  const canSubmitFunding =
    roomAllowsFundingSubmission &&
    Boolean(currentParticipant) &&
    (currentFundingStatus === "pending" || currentFundingStatus === "rejected");
  const availableBalanceMinor = walletOverview?.account.available_balance_minor ?? 0;
  const canPayWithBalance = canSubmitFunding && availableBalanceMinor >= room.entry_amount_minor;
  const joinedParticipants = participants.filter((participant) => participant.participant_status === "joined");
  const startConfirmationsRequired = joinedParticipants.length;
  const startConfirmationsCount = startConfirmations.length;
  const waitingForOpponentStart =
    room.status === "funded" &&
    Boolean(currentParticipant) &&
    currentPlayerStartConfirmed &&
    startConfirmationsCount < startConfirmationsRequired;
  const canConfirmStart =
    room.status === "funded" &&
    joinedParticipants.length === room.max_participants &&
    allJoinedParticipantsApproved &&
    Boolean(currentParticipant) &&
    !currentPlayerStartConfirmed;
  const canSubmitResult = Boolean(currentParticipant) && ["active", "awaiting_results"].includes(room.status);
  const canSubmitNewResult = canSubmitResult && !latestClaim;
  const reviewInProgress = ["under_review", "disputed"].includes(room.status);
  const finalStage = ["settlement_pending", "completed", "refunded", "voided"].includes(room.status);
  const finalWinnerParticipant = latestClaim
    ? results?.participants.find((participant) => participant.id === latestClaim.claimed_winner_participant_id)
      ?? participants.find((participant) => participant.id === latestClaim.claimed_winner_participant_id)
    : null;
  const canRespondToLatestClaim =
    Boolean(currentParticipant) &&
    Boolean(latestClaim) &&
    latestClaim?.status === "submitted" &&
    latestClaim.claimant_user_id !== user.id &&
    latestClaim.claimant_participant_id !== currentParticipant?.id &&
    latestClaim.claimed_winner_participant_id !== currentParticipant?.id;
  const canTournamentCheckIn =
    isTournamentRoom &&
    Boolean(currentParticipant) &&
    !currentPlayerCheckedIn &&
    ["funded", "active", "awaiting_results", "under_review"].includes(room.status);
  const canManageRoomInvites =
    !isTournamentRoom &&
    (room.created_by_user_id === user.id || ["moderator", "admin", "owner"].includes(user.role));
  const canSendRoomInvite =
    canManageRoomInvites &&
    room.status === "open" &&
    !isExpiredOpenRoom &&
    displayedParticipantCount < room.max_participants;
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
  const canJoinOpenRoom =
    !isTournamentRoom &&
    room.status === "open" &&
    !isExpiredOpenRoom &&
    !currentParticipant &&
    displayedParticipantCount < room.max_participants;
  const entryPrimaryStillMatters = ["awaiting_funding", "funding_review"].includes(room.status);
  const showEntryPrimary =
    entryPrimaryStillMatters &&
    (canSubmitFunding || roomAllowsFundingSubmission || currentFundingStatus === "submitted" || currentFundingStatus === "approved");
  const fundingSectionVisible = !isTournamentRoom && canViewSensitiveInternals && showEntryPrimary;
  const resultSectionVisible =
    canSubmitResult ||
    Boolean(latestClaim) ||
    ["active", "awaiting_results", "under_review", "disputed", "settlement_pending", "completed", "refunded", "voided", "cancelled"].includes(room.status);
  const roomNavItems = [
    { href: "#current-step", label: "Current" },
    { href: "#overview", label: "Overview" },
    { href: "#players", label: "Players" },
    ...(fundingSectionVisible ? [{ href: "#funding", label: "Entry" }] : []),
    { href: "#live", label: "Live" },
    ...(resultSectionVisible ? [{ href: "#result", label: "Result" }] : [])
  ];
  const primaryAction =
    isExpiredOpenRoom
      ? { href: "/challenges?mode=create", label: "Post fresh challenge" }
      : room.status === "open" && canJoinOpenRoom
        ? { href: "#join-room", label: "Join room" }
        : room.status === "open" && canSendRoomInvite
          ? { href: "#invite-player", label: "Invite player" }
          : room.status === "open"
            ? { href: "#overview", label: displayedParticipantCount < room.max_participants ? "Share code" : "View players" }
            : canSubmitFunding
      ? { href: "#funding", label: "Submit funding" }
      : canConfirmStart
          ? { href: "#current-step", label: "Confirm ready" }
        : waitingForOpponentStart
          ? { href: "#current-step", label: "Waiting opponent" }
          : canRespondToLatestClaim
            ? { href: "#current-step", label: "Respond" }
          : canSubmitNewResult
            ? { href: "#result", label: "Submit result" }
            : canSubmitResult && latestClaim
              ? { href: "#result", label: "View result" }
              : reviewInProgress
                ? { href: "#result", label: "View review" }
                : finalStage
                  ? { href: "#result", label: room.status === "completed" ? "View outcome" : "View status" }
            : canManageLivestreams
              ? { href: "#live", label: "Add livestream" }
              : { href: "#players", label: displayedParticipantCount < room.max_participants ? "Check players" : "View players" };
  return (
    <AppShell active="matches">
      <MotionSection className="grid max-w-full gap-5 overflow-x-hidden md:gap-6" variant="page">
        <MotionSection className="motion-state-card rounded-lg border border-line bg-navy-900 p-5 text-white shadow-panel md:p-7" variant="hero">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <Badge tone={statusTone(room.status, isExpiredOpenRoom)}>{roomDisplayStatusLabel(room, isExpiredOpenRoom)}</Badge>
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
              {canRespondToLatestClaim ? (
                <a className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="#current-step">
                  Respond to result
                </a>
              ) : canSubmitNewResult ? (
                <a className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="#result">
                  Submit result
                </a>
              ) : canSubmitResult && latestClaim ? (
                <a className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="#result">
                  View result
                </a>
              ) : null}
            </div>
          </div>
        </MotionSection>

        <LiveUpdateStream
          autoConnect
          eventTypePrefixes={["match.", "notification.", "room.invite."]}
          label="Room live"
          matchRoomId={room.id}
          quiet
          refreshOnPatch
          tournamentId={tournamentId ?? undefined}
        />

        {error ? <TransientStatusBanner clearKeys={["error"]} durationMs={10000} message={error} /> : null}
        {inviteSent ? <TransientStatusBanner clearKeys={["invite_sent"]} durationMs={12000} message="Invite sent. The player will see it in their notifications." tone="success" /> : null}
        {checkedInSuccess ? <TransientStatusBanner clearKeys={["checked_in"]} durationMs={12000} message="Tournament match check-in recorded." tone="success" /> : null}
        {livestreamSaved ? <TransientStatusBanner clearKeys={["livestream_saved"]} durationMs={12000} message="Livestream link saved." tone="success" /> : null}
        {livestreamArchived ? <TransientStatusBanner clearKeys={["livestream_archived"]} durationMs={12000} message="Livestream archived." tone="success" /> : null}
        {playStarted ? <TransientStatusBanner clearKeys={["play_started"]} durationMs={10000} message="Match play started. Submit result evidence after the game is complete." tone="success" /> : null}
        {playConfirmed ? <TransientStatusBanner clearKeys={["play_confirmed"]} durationMs={10000} message="Ready confirmed. Waiting for the other player before the match goes live." tone="success" /> : null}
        {balanceFunded ? <TransientStatusBanner clearKeys={["balance_funded"]} durationMs={10000} message="Entry paid from Skillsroom Balance. Your funds are locked for this room." tone="success" /> : null}

        <section className="scroll-mt-28" id="current-step">
          <Panel className="overflow-hidden border-cyan/40 shadow-[0_24px_70px_rgba(24,197,138,0.12)]">
            <div className="grid gap-4 border-b border-line bg-gradient-to-r from-cyanSoft via-white to-green-50 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-cyan">Current step</p>
                <h2 className="mt-2 text-2xl font-black text-ink">{nextTitle}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{nextDetail}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 md:min-w-[22rem]">
                <div className="rounded-md border border-line bg-white p-3">
                  <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Status</p>
                  <p className="mt-1 text-sm font-black text-ink">{roomDisplayStatusLabel(room, isExpiredOpenRoom)}</p>
                </div>
                <div className="rounded-md border border-line bg-white p-3">
                  <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Players</p>
                  <p className="mt-1 text-sm font-black text-ink">{displayedParticipantCount}/{room.max_participants}</p>
                </div>
                <div className="rounded-md border border-line bg-white p-3">
                  <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Entry</p>
                  <p className="mt-1 text-sm font-black text-ink">{isTournamentRoom ? "Tournament" : formatEntryAmount(room)}</p>
                </div>
              </div>
            </div>

            {isExpiredOpenRoom ? (
              <div className="grid gap-3 p-4">
                <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
                  This challenge window has ended. Open the room history below, or create a fresh challenge for another player.
                </div>
                <div className="flex flex-wrap gap-2">
                  <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="/challenges?mode=create" pendingLabel="Opening challenges...">
                    Post fresh challenge
                  </PendingLink>
                  <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="#room-history">
                    View history
                  </a>
                </div>
              </div>
            ) : canOpen ? (
              <div className="grid gap-3 p-4">
                <p className="text-sm leading-6 text-muted">Review the details, then open the room so another player can join.</p>
                <form action={openMatchRoomAction}>
                  <input name="match_room_id" type="hidden" value={room.id} />
                  <SubmitButton idleLabel="Open room" pendingLabel="Opening room..." />
                </form>
              </div>
            ) : room.status === "open" ? (
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="grid gap-3">
                  <div className="rounded-md border border-cyan/30 bg-cyanSoft p-4">
                    <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-cyan">Room code</p>
                    <p className="mt-2 break-all font-mono text-2xl font-black text-ink">{room.room_code}</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-muted">
                      Share this code with your opponent. Entry confirmation starts when both player slots are filled.
                    </p>
                  </div>
                  {displayedParticipantCount < room.max_participants ? (
                    <div className="rounded-md border border-line bg-white p-4 text-sm font-bold leading-6 text-muted">
                      One open slot remains. Share the room code or send a direct invite if you already know the player.
                    </div>
                  ) : (
                    <div className="rounded-md border border-success/30 bg-green-50 p-4 text-sm font-bold leading-6 text-success">
                      Both players are in. Entry confirmation opens next.
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {(["player_a", "player_b"] as const).map((slot) => {
                      const participant = participants.find((item) => item.slot === slot);
                      const trust = participant ? trustByUserId.get(participant.user_id) : null;
                      return (
                        <div className="rounded-md border border-line bg-surfaceWarm p-4" key={slot}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{slot.replace("_", " ")}</p>
                              <p className="mt-2 text-base font-black text-ink">{participant ? playerDisplayName(participant, trust) : "Open slot"}</p>
                            </div>
                            <Badge tone={participant ? "success" : "warning"}>{participant ? "Joined" : "Waiting"}</Badge>
                          </div>
                          <p className="mt-2 text-xs font-bold leading-5 text-muted">
                            {participant ? primaryHandleLabel(trust) : "This slot fills when another player joins with the room code or accepts an invite."}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-3 self-start">
                  {canJoinOpenRoom ? (
                    <form action={joinMatchRoomAction} className="grid scroll-mt-32 gap-3 rounded-lg border border-line bg-white p-4 shadow-tight" id="join-room">
                      <input name="room_code" type="hidden" value={room.room_code} />
                      <input name="error_path" type="hidden" value={`/matches/${room.id}`} />
                      <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-cyan">Join room</p>
                      <h3 className="text-xl font-black text-ink">Use this room code</h3>
                      <p className="text-sm leading-6 text-muted">Joining adds you to this room. Entry confirmation still happens after both players are in.</p>
                      <SubmitButton idleLabel="Join room" pendingLabel="Joining room..." />
                    </form>
                  ) : canSendRoomInvite ? (
                    <div className="rounded-lg border border-line bg-white p-4 shadow-tight">
                      <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-cyan">Invite</p>
                      <h3 className="mt-2 text-xl font-black text-ink">Invite a player</h3>
                      <p className="mt-2 text-sm leading-6 text-muted">Send a direct invite from the overview panel, or share the room code anywhere.</p>
                      <a className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="#invite-player">
                        Invite player
                      </a>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-line bg-white p-4 shadow-tight">
                      <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-cyan">Open room</p>
                      <h3 className="mt-2 text-xl font-black text-ink">{displayedParticipantCount < room.max_participants ? "Waiting for opponent" : "Entry is next"}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {displayedParticipantCount < room.max_participants
                          ? "Keep the room code handy while the next player joins."
                          : "Both players are in. Entry confirmation starts next."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : showEntryPrimary ? (
              <div className="grid scroll-mt-32 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_24rem]" id="funding">
                <div className="grid gap-3">
                  <div className="rounded-md border border-line bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-cyan">Entry payment</p>
                        <h3 className="mt-2 text-xl font-black text-ink">
                          {currentEntryApproved ? "Your entry is confirmed" : currentEntrySubmitted ? "Payment proof is under review" : currentFundingStatus === "rejected" ? "Update your transfer proof" : "Confirm your entry"}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          Required: <span className="font-black text-ink">{formatEntryAmount(room)}</span>. Balance available: <span className="font-black text-ink">{formatMinorMoney(room.currency, availableBalanceMinor)}</span>.
                        </p>
                      </div>
                      <RoomActionForm action={payRoomWithBalanceIslandAction} className="shrink-0" refreshOnSuccess>
                        <input name="match_room_id" type="hidden" value={room.id} />
                        <SubmitButton disabled={!canPayWithBalance} idleLabel="Use balance" pendingLabel="Locking funds..." />
                      </RoomActionForm>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border border-line bg-surfaceWarm p-3">
                        <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Entry</p>
                        <p className="mt-1 text-lg font-black text-ink">{formatEntryAmount(room)}</p>
                        <p className="mt-1 text-xs font-bold leading-5 text-muted">Equal amount for both players</p>
                      </div>
                      <div className="rounded-md border border-line bg-surfaceWarm p-3">
                        <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Confirmed</p>
                        <p className="mt-1 text-lg font-black text-ink">{confirmedEntryCount}/{room.max_participants}</p>
                        <p className="mt-1 text-xs font-bold leading-5 text-muted">Approved entries</p>
                      </div>
                    </div>
                    {canSubmitFunding ? (
                      <div className="mt-3 rounded-md border border-cyan/30 bg-cyanSoft p-3 text-sm font-bold leading-6 text-cyan">
                        Next step: confirm your {formatEntryAmount(room)} entry with Skillsroom Balance or transfer proof.
                      </div>
                    ) : null}
                    {currentParticipant && (canSubmitFunding || currentEntrySubmitted || currentEntryApproved) ? (
                      <div className="mt-3 rounded-md border border-line bg-surfaceWarm p-3 text-sm font-bold leading-6 text-muted">
                        Add your payout account on Profile before result review so approved winnings can be paid quickly.
                      </div>
                    ) : null}
                    {currentEntryApproved ? (
                      <p className="mt-3 text-sm font-bold text-success">{allJoinedParticipantsApproved ? "Both entries are approved. Start play when both players are ready." : "Your slot is approved. We are waiting for the other player."}</p>
                    ) : currentEntrySubmitted ? (
                      <p className="mt-3 text-sm font-bold text-success">Your transfer proof is under review. You do not need to submit again unless Skillsroom asks for a correction.</p>
                    ) : currentFundingStatus === "rejected" ? (
                      <p className="mt-3 text-sm font-bold text-danger">Your last transfer proof needs correction. Upload a clearer proof or update the transfer details below.</p>
                    ) : canSubmitFunding && !canPayWithBalance ? (
                      <p className="mt-3 text-sm font-bold text-muted">Your balance is not enough for this room. Top up your wallet or upload transfer proof now.</p>
                    ) : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(["player_a", "player_b"] as const).map((slot) => {
                      const participant = participants.find((item) => item.slot === slot);
                      const trust = participant ? trustByUserId.get(participant.user_id) : null;
                      const fundingMethod = fundingMethodSummary(funding, participant);
                      return (
                        <div className="rounded-md border border-line bg-surfaceWarm p-4" key={slot}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{slot.replace("_", " ")}</p>
                              <p className="mt-2 text-base font-black text-ink">{playerDisplayName(participant, trust)}</p>
                            </div>
                            <Badge tone={fundingMethod.tone}>{fundingMethod.label}</Badge>
                          </div>
                          <p className="mt-2 text-xs font-bold leading-5 text-muted">{fundingMethod.detail}</p>
                          <div className="mt-3 grid gap-2 rounded-md border border-line bg-white p-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-bold text-muted">Entry amount</span>
                              <span className="font-black text-ink">{formatEntryAmount(room)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-bold text-muted">Entry status</span>
                              <span className="font-black text-ink">{participant ? displayLabel(participant.funding_status) : "Waiting"}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-bold text-muted">Proof</span>
                              <span className="font-black text-ink">{participant ? fundingMethod.label : "No proof shown"}</span>
                            </div>
                          </div>
                          {trust ? <div className="mt-3"><PlayerTrustCard compact trust={trust} /></div> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {canSubmitFunding ? (
                  <RoomActionForm action={submitManualFundingIslandAction} className="grid gap-3 rounded-lg border border-line bg-white p-4 shadow-tight">
                    <input name="match_room_id" type="hidden" value={room.id} />
                    <input name="amount_naira" type="hidden" value={room.entry_amount_minor / 100} />
                    <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-cyan">Transfer proof</p>
                    <ManualPaymentPanel
                      amountLabel="Exact transfer amount"
                      amountValue={formatEntryAmount(room)}
                      referenceHint={`Use room code ${room.room_code} in the transfer narration or note if your banking app supports it.`}
                    />
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      Bank
                      <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="sender_bank_name" placeholder="OPay, GTBank, Moniepoint..." required />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      Account name
                      <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="sender_account_name" placeholder="Name shown on the transfer" required />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      Transfer screenshot
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-surfaceHigh file:px-3 file:py-2 file:text-xs file:font-black file:text-ink focus:border-action"
                        name="proof_file"
                        required
                        type="file"
                      />
                    </label>
                    <details className="rounded-md border border-line bg-surfaceWarm">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-black text-ink">Optional transfer details</summary>
                      <div className="grid gap-3 border-t border-line p-3">
                        <label className="grid gap-2 text-sm font-bold text-ink">
                          Transfer reference
                          <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="transfer_reference" placeholder={`Narration or receipt reference for ${room.room_code}`} />
                        </label>
                        <label className="grid gap-2 text-sm font-bold text-ink">
                          Proof link
                          <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="proof_url" placeholder="Use if the screenshot is hosted elsewhere" type="url" />
                        </label>
                        <label className="grid gap-2 text-sm font-bold text-ink">
                          Note
                          <textarea className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="proof_note" placeholder="Anything Skillsroom should know" />
                        </label>
                      </div>
                    </details>
                    <SubmitButton idleLabel="Submit payment proof" pendingLabel="Submitting proof..." />
                  </RoomActionForm>
                ) : !currentParticipant ? (
                  <div className="rounded-lg border border-line bg-white p-4 text-sm font-bold leading-6 text-muted shadow-tight">
                    Only room participants can submit entry proof for this room.
                  </div>
                ) : null}
              </div>
            ) : canTournamentCheckIn ? (
              <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <p className="text-sm leading-6 text-muted">Confirm you are present before playing this tournament match.</p>
                <form action={checkInTournamentMatchRoomAction}>
                  <input name="match_room_id" type="hidden" value={room.id} />
                  <SubmitButton idleLabel="Check in" pendingLabel="Checking in..." />
                </form>
              </div>
            ) : canConfirmStart ? (
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                <div className="grid gap-3">
                  <div className="rounded-md border border-success/30 bg-green-50 p-4 text-sm font-bold leading-6 text-success">
                    Both entries are confirmed. Confirm ready only when both players are set to begin.
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Entries</p>
                      <p className="mt-1 text-lg font-black text-ink">{confirmedEntryCount}/{room.max_participants}</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-muted">Confirmed</p>
                    </div>
                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Ready</p>
                      <p className="mt-1 text-lg font-black text-ink">{startConfirmationsCount}/{startConfirmationsRequired}</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-muted">Player confirmations</p>
                    </div>
                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Result</p>
                      <p className="mt-1 text-lg font-black text-ink">Locked</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-muted">Opens after play starts</p>
                    </div>
                  </div>
                </div>
                <RoomActionForm action={startMatchPlayIslandAction} className="grid gap-2 rounded-lg border border-line bg-white p-4 shadow-tight" refreshOnSuccess>
                  <input name="match_room_id" type="hidden" value={room.id} />
                  <SubmitButton idleLabel="Confirm ready" pendingLabel="Confirming..." />
                </RoomActionForm>
              </div>
            ) : waitingForOpponentStart ? (
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                <div className="grid gap-3">
                <div className="rounded-md border border-success/30 bg-green-50 p-4 text-sm font-bold leading-6 text-success">
                  Your ready status is confirmed. The match will go live after the other player confirms.
                </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Entries</p>
                      <p className="mt-1 text-lg font-black text-ink">{confirmedEntryCount}/{room.max_participants}</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-muted">Confirmed</p>
                    </div>
                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Ready</p>
                      <p className="mt-1 text-lg font-black text-ink">{startConfirmationsCount}/{startConfirmationsRequired}</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-muted">Waiting for opponent</p>
                    </div>
                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Result</p>
                      <p className="mt-1 text-lg font-black text-ink">Locked</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-muted">Opens after play starts</p>
                    </div>
                  </div>
                </div>
                <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href="#live">
                  Open live section
                </a>
              </div>
            ) : canRespondToLatestClaim && latestClaim ? (
              <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="grid gap-3">
                  <div className="rounded-md border border-cyan/30 bg-cyanSoft p-4">
                    <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-cyan">Opponent response</p>
                    <h3 className="mt-2 text-xl font-black text-ink">Agree or dispute this result</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Tap Agree only if the winner, score, and proof are correct. Tap Dispute if proof is missing, unclear, or the score is wrong.
                    </p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Claimed score</p>
                      <p className="mt-2 text-lg font-black text-ink">{scoreSummaryLabel(latestClaim.score_summary)}</p>
                    </div>
                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Response due</p>
                      <p className="mt-2 text-lg font-black text-ink">{timeRemainingLabel(latestClaim.opponent_response_due_at)}</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-muted">{dateTimeLabel(latestClaim.opponent_response_due_at)}</p>
                    </div>
                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">No response</p>
                      <p className="mt-2 text-xs font-bold leading-5 text-muted">Skillsroom can review the claim after the deadline.</p>
                    </div>
                  </div>
                  <a className="text-sm font-black text-cyan hover:text-action" href="#result">See submitted proof</a>
                </div>
                <form action={respondToResultClaimAction} className="grid gap-3 rounded-lg border border-line bg-white p-4 shadow-tight">
                  <input name="match_room_id" type="hidden" value={room.id} />
                  <input name="result_claim_id" type="hidden" value={latestClaim.id} />
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Response note
                    <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" placeholder="If you dispute, explain what is wrong: score, player identity, missing proof, lag, disconnect, or rule issue." />
                  </label>
                  <details className="rounded-md border border-line bg-surfaceWarm">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-black text-ink">Optional dispute proof</summary>
                    <div className="grid gap-3 border-t border-line p-3">
                      <div className="rounded-md border border-warning bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">
                        Add proof when disputing if you have a screenshot or video that shows what is wrong.
                      </div>
                      <label className="grid gap-2 text-sm font-bold text-ink">
                        Screenshot or video
                        <input
                          accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                          className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-surfaceHigh file:px-3 file:py-2 file:text-xs file:font-black file:text-ink focus:border-action"
                          name="response_evidence_file"
                          type="file"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-bold text-ink">
                        Proof title
                        <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="Dispute proof" name="response_evidence_title" />
                      </label>
                      <label className="grid gap-2 text-sm font-bold text-ink">
                        Proof notes
                        <textarea className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="response_evidence_notes" placeholder="Tell Skillsroom where to look in the screenshot or video." />
                      </label>
                    </div>
                  </details>
                  <div className="flex flex-wrap gap-3">
                    <SubmitButton idleLabel="Agree with result" name="response" pendingLabel="Submitting..." value="agree" />
                    <SubmitButton idleLabel="Dispute result" name="response" pendingLabel="Submitting..." value="dispute" variant="danger" />
                  </div>
                </form>
              </div>
            ) : canSubmitNewResult ? (
              <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="grid gap-3">
                  <div className="rounded-md border border-cyan/30 bg-cyanSoft p-4">
                    <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-cyan">Result evidence</p>
                    <h3 className="mt-2 text-xl font-black text-ink">Submit the winner and proof</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">Play only when the room says it is live. After the match, upload a clear final scoreboard screenshot or short video.</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {[
                      ["1", "Score", "Add the final score or result summary."],
                      ["2", "Proof", "Attach proof with player names, game handles, and the final result visible."],
                      ["3", "Response", "The opponent can agree or dispute after your claim."],
                      ["4", "Decision", "Skillsroom checks the result before payout or refund."]
                    ].map(([step, title, detail]) => (
                      <div className="rounded-md border border-line bg-white p-3" key={step}>
                        <span className="grid size-8 place-items-center rounded-full bg-cyan text-xs font-black text-white">{step}</span>
                        <p className="mt-2 text-sm font-black text-ink">{title}</p>
                        <p className="mt-1 text-xs font-bold leading-5 text-muted">{detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <RoomActionForm action={submitResultClaimIslandAction} className="grid gap-3 rounded-lg border border-line bg-white p-4 shadow-tight">
                  <input name="match_room_id" type="hidden" value={room.id} />
                  <input name="claimed_winner_participant_id" type="hidden" value={currentParticipant?.id ?? ""} />
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Winner
                    <div className="rounded-md border border-line bg-surfaceWarm px-3 py-3 text-sm font-black text-ink">
                      {playerOptionLabel(currentParticipant, currentParticipant ? trustByUserId.get(currentParticipant.user_id) : null)}
                    </div>
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Score summary <span className="font-bold text-muted">(optional)</span>
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="score_summary" placeholder="2-1, Booyah, placement result, forfeit" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Proof type
                    <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="evidence_type">
                      <option value="screenshot">Screenshot</option>
                      <option value="video">Video</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Required screenshot or video
                    <input
                      accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                      className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-surfaceHigh file:px-3 file:py-2 file:text-xs file:font-black file:text-ink focus:border-action"
                      name="evidence_file"
                      required
                      type="file"
                    />
                  </label>
                  <details className="rounded-md border border-line bg-surfaceWarm">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-black text-ink">Optional result note</summary>
                    <div className="grid gap-3 border-t border-line p-3">
                      <label className="grid gap-2 text-sm font-bold text-ink">
                        What should Skillsroom know?
                        <textarea className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" placeholder="Overtime, disconnect, forfeit, lag, or rule issue." />
                      </label>
                      <label className="grid gap-2 text-sm font-bold text-ink">
                        Proof notes
                        <textarea className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="evidence_notes" placeholder="Point to the score, timestamp, winner name, or rule issue." />
                      </label>
                    </div>
                  </details>
                  <input name="evidence_title" type="hidden" value="Final scoreboard" />
                  <SubmitButton idleLabel="Submit result" pendingLabel="Submitting result..." />
                  <a className="text-sm font-black text-cyan hover:text-action" href="#result">See result details</a>
                </RoomActionForm>
              </div>
            ) : canSubmitResult && latestClaim ? (
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                <div className="grid gap-3">
                  <div className="rounded-md border border-cyan/30 bg-cyanSoft p-4">
                    <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-cyan">Result submitted</p>
                    <h3 className="mt-2 text-xl font-black text-ink">
                      {latestClaim.status === "submitted" ? "Waiting for opponent response" : "Result review is moving"}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {latestClaim.status === "submitted"
                        ? `Opponent response is due ${dateTimeLabel(latestClaim.opponent_response_due_at)}. Keep this room open for updates.`
                        : "The submitted result, proof, response, and final decision stay attached to this room."}
                    </p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {evidencePathCards({
                      claim: latestClaim,
                      evidenceCount: results?.evidence_items.filter((item) => item.result_claim_id === latestClaim.id).length ?? 0,
                      responses: results?.responses ?? [],
                      reviews: results?.reviews ?? [],
                      room
                    }).map((card) => (
                      <div className="rounded-md border border-line bg-white p-3" key={card.label}>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">{card.label}</p>
                          <Badge tone={card.tone}>{card.value}</Badge>
                        </div>
                        <p className="mt-2 text-xs font-bold leading-5 text-muted">{card.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <a className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="#result">
                  View result details
                </a>
              </div>
            ) : reviewInProgress ? (
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                <div className="grid gap-3">
                  <div className={room.status === "disputed" ? "rounded-md border border-danger bg-red-50 p-4" : "rounded-md border border-warning/40 bg-warningSoft p-4"}>
                    <p className={room.status === "disputed" ? "font-mono text-xs font-black uppercase tracking-[0.14em] text-danger" : "font-mono text-xs font-black uppercase tracking-[0.14em] text-warning"}>
                      {room.status === "disputed" ? "Dispute review" : "Result review"}
                    </p>
                    <h3 className="mt-2 text-xl font-black text-ink">
                      {room.status === "disputed" ? "Skillsroom is checking the dispute" : "Skillsroom is checking the result"}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {room.status === "disputed"
                        ? "Payout stays paused while the submitted proof, opponent response, and dispute details are reviewed."
                        : "Proof and player responses are being checked before the room moves to payout or refund handling."}
                    </p>
                  </div>
                  <div className="rounded-md border border-line bg-white p-4 text-sm font-bold leading-6 text-muted">
                    No action is needed from you right now. Keep your proof available in case Skillsroom asks for more context.
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {evidencePathCards({
                      claim: latestClaim,
                      evidenceCount: results?.evidence_items.filter((item) => !latestClaim || item.result_claim_id === latestClaim.id).length ?? 0,
                      responses: results?.responses ?? [],
                      reviews: results?.reviews ?? [],
                      room
                    }).map((card) => (
                      <div className="rounded-md border border-line bg-white p-3" key={card.label}>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">{card.label}</p>
                          <Badge tone={card.tone}>{card.value}</Badge>
                        </div>
                        <p className="mt-2 text-xs font-bold leading-5 text-muted">{card.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <a className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="#result">
                  View review details
                </a>
              </div>
            ) : finalStage ? (
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                <div className="grid gap-3">
                  <div className={
                    room.status === "voided"
                      ? "rounded-md border border-danger bg-red-50 p-4"
                      : room.status === "refunded" || room.status === "settlement_pending"
                        ? "rounded-md border border-warning/40 bg-warningSoft p-4"
                        : "rounded-md border border-success/30 bg-green-50 p-4"
                  }>
                    <p className={
                      room.status === "voided"
                        ? "font-mono text-xs font-black uppercase tracking-[0.14em] text-danger"
                        : room.status === "refunded" || room.status === "settlement_pending"
                          ? "font-mono text-xs font-black uppercase tracking-[0.14em] text-warning"
                          : "font-mono text-xs font-black uppercase tracking-[0.14em] text-success"
                    }>
                      {room.status === "completed" ? "Room complete" : room.status === "settlement_pending" ? "Payout pending" : room.status === "refunded" ? "Refund handling" : "Room closed"}
                    </p>
                    <h3 className="mt-2 text-xl font-black text-ink">
                      {room.status === "completed"
                        ? "This room is settled"
                        : room.status === "settlement_pending"
                          ? "Winner approved. Payout is next"
                          : room.status === "refunded"
                            ? "Entries are being returned"
                            : "No winner was confirmed"}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {room.status === "completed"
                        ? "The final decision and money handling are complete. This room is saved in history."
                        : room.status === "settlement_pending"
                          ? "The result has been accepted. Skillsroom will complete payout handling from the approved outcome."
                          : room.status === "refunded"
                            ? "This room used the refund path. Check your wallet or room updates for the returned entry status."
                            : "This match was closed without a confirmed winner. Any entry return or follow-up stays attached to this room."}
                    </p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Outcome</p>
                      <p className="mt-2 text-lg font-black text-ink">
                        {room.status === "refunded" || room.status === "voided"
                          ? "No payout winner"
                          : finalWinnerParticipant
                            ? playerDisplayName(finalWinnerParticipant, trustByUserId.get(finalWinnerParticipant.user_id))
                            : publicWinnerPage?.winner.label ?? "Winner approved"}
                      </p>
                      <p className="mt-1 text-xs font-bold leading-5 text-muted">
                        {finalDecisionSummary(latestClaim, results?.reviews ?? [], room)}
                      </p>
                    </div>
                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Money status</p>
                      <p className="mt-2 text-lg font-black text-ink">
                        {room.status === "completed"
                          ? "Complete"
                          : room.status === "settlement_pending"
                            ? "Payout pending"
                            : room.status === "refunded"
                              ? "Refund path"
                              : "Closed"}
                      </p>
                      <p className="mt-1 text-xs font-bold leading-5 text-muted">
                        {room.status === "completed"
                          ? "Prize or refund handling is finished."
                          : room.status === "settlement_pending"
                            ? "Winner payout is waiting for final handling."
                            : room.status === "refunded"
                              ? "Entry return is the active money outcome."
                              : "No payout will be made from this room unless Skillsroom reopens the case."}
                      </p>
                    </div>
                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Room status</p>
                      <p className="mt-2 text-lg font-black text-ink">{roomDisplayStatusLabel(room)}</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-muted">
                        {room.status === "completed" ? "No player action is needed." : "Keep this room for the saved decision and updates."}
                      </p>
                    </div>
                  </div>
                  {latestClaim ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {evidencePathCards({
                        claim: latestClaim,
                        evidenceCount: results?.evidence_items.filter((item) => item.result_claim_id === latestClaim.id).length ?? 0,
                        responses: results?.responses ?? [],
                        reviews: results?.reviews ?? [],
                        room
                      }).map((card) => (
                        <div className="rounded-md border border-line bg-white p-3" key={card.label}>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">{card.label}</p>
                            <Badge tone={card.tone}>{card.value}</Badge>
                          </div>
                          <p className="mt-2 text-xs font-bold leading-5 text-muted">{card.detail}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <a className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="#result">
                  View result details
                </a>
              </div>
            ) : (
              <div className="grid gap-3 p-4">
                <div className="rounded-md border border-line bg-surfaceWarm p-4 text-sm font-bold leading-6 text-muted">
                  No action is needed from you right now. Keep this room open for updates, or use the sections below to check players, payment, proof, and history.
                </div>
                <a className="inline-flex min-h-10 w-fit items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href={primaryAction.href}>
                  {primaryAction.label}
                </a>
              </div>
            )}
          </Panel>
        </section>

        <nav className="sticky top-16 z-30 max-w-full overflow-hidden rounded-2xl border border-line bg-white/95 p-2 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur md:top-16">
          <div className="grid max-w-full grid-cols-3 gap-2 min-[430px]:grid-cols-4 lg:flex lg:flex-wrap">
            {roomNavItems.map((item) => (
              <a
                className="motion-tap inline-flex min-h-10 min-w-0 items-center justify-center rounded-xl border border-line bg-surfaceHigh px-2 text-center text-xs font-black leading-tight text-ink hover:border-cyan hover:bg-cyanSoft sm:px-4 sm:text-sm"
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
              <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-cyan">Room summary</p>
              <h2 className="mt-2 text-2xl font-black text-ink">Match snapshot</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Use this overview to check the room details after handling the current step above.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {canOpen ? (
                  <form action={openMatchRoomAction}>
                    <input name="match_room_id" type="hidden" value={room.id} />
                    <SubmitButton idleLabel="Open room" pendingLabel="Opening room..." />
                  </form>
                ) : null}
                {!canOpen ? (
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
                <p className="mt-2 text-2xl font-black text-cyan">{roomDisplayStatusLabel(room, isExpiredOpenRoom)}</p>
                <p className="mt-2 text-sm font-bold text-muted">Room progress is saved</p>
              </Panel>
              {canManageRoomInvites ? (
                <Panel className="scroll-mt-32 p-4" id="invite-player">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-cyan">Invite</p>
                  <h2 className="mt-2 text-xl font-black text-ink">Invite a player</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Send a direct room invite by Skillsroom username. They can accept it from their inbox.
                  </p>
                  {isExpiredOpenRoom ? (
                    <div className="mt-4 rounded-md border border-warning bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">
                      This challenge window has ended. Post a fresh challenge or create a new room before another player joins.
                    </div>
                  ) : null}
                  <form action={createRoomInviteAction} className="mt-4 grid gap-3">
                    <input name="match_room_id" type="hidden" value={room.id} />
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      Username
                      <input
                        className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                        disabled={!canSendRoomInvite}
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
                        className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action"
                        disabled={!canSendRoomInvite}
                        maxLength={240}
                        name="message"
                        placeholder={`Join ${room.room_code} on Skillsroom.`}
                      />
                    </label>
                    <SubmitButton disabled={!canSendRoomInvite} idleLabel="Send invite" pendingLabel="Sending invite..." />
                  </form>
                  {isExpiredOpenRoom ? (
                    <p className="mt-3 text-xs font-bold leading-5 text-muted">This challenge window has ended. Create a new room before inviting another player.</p>
                  ) : room.status !== "open" ? (
                    <p className="mt-3 text-xs font-bold leading-5 text-muted">Open the room before inviting another player.</p>
                  ) : displayedParticipantCount >= room.max_participants ? (
                    <p className="mt-3 text-xs font-bold leading-5 text-muted">This room already has all players.</p>
                  ) : (
                    <p className="mt-3 text-xs font-bold leading-5 text-muted">Room code sharing still works. Direct invite is best when you already know the player.</p>
                  )}
                </Panel>
              ) : null}
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

            {!isTournamentRoom ? (
            <Panel>
              <PanelHeader eyebrow="Invite" title="Room invite options" description="Use the room code for quick sharing, or send a direct invite from the overview panel." />
              <div className="grid gap-3 p-4">
                <div className="rounded-md border border-line bg-surfaceWarm p-4">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">Room code</p>
                  <p className="mt-2 break-all text-2xl font-black text-ink">{room.room_code}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">Your opponent can paste this code from the Rooms page to join.</p>
                </div>
                {canSendRoomInvite ? (
                  <a className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="#invite-player">
                    Invite by username
                  </a>
                ) : isExpiredOpenRoom ? (
                  <p className="text-sm font-bold leading-6 text-muted">This challenge window has ended. Create a new room before inviting another player.</p>
                ) : (
                  <p className="text-sm font-bold leading-6 text-muted">Only the room creator or Skillsroom team can send direct player invites.</p>
                )}
              </div>
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
          <div className="border-t border-line bg-white p-4">
            <PanelHeader
              eyebrow="Fair Play Rules"
              title="When play does not go cleanly"
              description="These room rules cover late opponents, no-shows, disconnects, timeouts, and proof that cannot be verified."
            />
            <div className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-5">
              {roomIssueRules.map((rule) => (
                <div className="rounded-md border border-line bg-surfaceWarm p-4" key={rule.key}>
                  <h3 className="text-sm font-black text-ink">{rule.title}</h3>
                  <p className="mt-2 text-xs font-bold leading-5 text-muted">{rule.body}</p>
                </div>
              ))}
            </div>
          </div>
        </details>

        {canViewSensitiveInternals ? (
        <div className="grid min-w-0 gap-6 scroll-mt-32 xl:grid-cols-[minmax(0,1fr)_24rem]" id="result">
          <Panel>
            <PanelHeader
              eyebrow="Result"
              title="Claims, responses, and evidence"
              description="Proof, opponent response, dispute status, admin review, and final decision stay attached to this room."
            />
            <div className="grid gap-3 p-4">
              <div className="grid gap-3 lg:grid-cols-4">
                {evidencePathCards({
                  claim: latestClaim,
                  evidenceCount: results?.evidence_items.filter((item) => !latestClaim || item.result_claim_id === latestClaim.id).length ?? 0,
                  responses: results?.responses ?? [],
                  reviews: results?.reviews ?? [],
                  room
                }).map((card) => (
                  <div className="rounded-md border border-line bg-white p-3" key={card.label}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">{card.label}</p>
                      <Badge tone={card.tone}>{card.value}</Badge>
                    </div>
                    <p className="mt-2 text-xs font-bold leading-5 text-muted">{card.detail}</p>
                  </div>
                ))}
              </div>

              {results?.claims.length ? (
                results.claims.map((claim) => {
                  const responseStatus = claimResponseStatus(claim, results.responses);
                  const reviewStatus = claimReviewStatus(claim, results.reviews);
                  const claimEvidence = results.evidence_items.filter((item) => item.result_claim_id === claim.id);
                  const claimedWinner = results.participants.find((item) => item.id === claim.claimed_winner_participant_id);

                  return (
                    <div className="rounded-lg border border-line bg-surfaceWarm p-4" key={claim.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">Submitted result</p>
                          <p className="mt-2 text-xl font-black text-ink">{scoreSummaryLabel(claim.score_summary)}</p>
                        </div>
                        <Badge tone={resultTone(claim.status)}>{displayLabel(claim.status)}</Badge>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        <div className="rounded-md border border-line bg-white p-3">
                          <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Winner claimed</p>
                          <p className="mt-2 text-sm font-black text-ink">
                            {playerDisplayName(claimedWinner, trustByUserId.get(claimedWinner?.user_id ?? ""))}
                          </p>
                          <p className="mt-1 text-xs font-bold text-muted">Submitted {dateTimeLabel(claim.submitted_at)}</p>
                        </div>
                        <div className="rounded-md border border-line bg-white p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Opponent response</p>
                            <Badge tone={responseStatus.tone}>{responseStatus.label}</Badge>
                          </div>
                          <p className="mt-2 text-xs font-bold leading-5 text-muted">{responseStatus.detail}</p>
                        </div>
                        <div className="rounded-md border border-line bg-white p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Final decision</p>
                            <Badge tone={reviewStatus.tone}>{reviewStatus.label}</Badge>
                          </div>
                          <p className="mt-2 text-xs font-bold leading-5 text-muted">{reviewStatus.detail}</p>
                        </div>
                      </div>

                      {claim.note ? (
                        <div className="mt-3 rounded-md border border-line bg-white p-3 text-sm leading-6 text-muted">
                          <strong className="text-ink">Player note:</strong> {claim.note}
                        </div>
                      ) : null}

                      <div className="mt-4 rounded-md border border-cyan/20 bg-cyanSoft p-3">
                        <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-cyan">Proof attached</p>
                        <p className="mt-1 text-sm font-bold text-ink">
                          {claimEvidence.length} file{claimEvidence.length === 1 ? "" : "s"} saved for this result.
                        </p>
                      </div>

                      {claimEvidence.length ? (
                        <div className="mt-4 grid gap-2">
                          {claimEvidence.map((item) => (
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
                  );
                })
              ) : (
                <div className="rounded-lg border border-dashed border-line bg-surfaceWarm p-6">
                  <p className="text-lg font-black text-ink">No result claim yet</p>
                  <p className="mt-2 text-sm leading-6 text-muted">When the match is done, submit the winner, optional score summary, and evidence here.</p>
                </div>
              )}
            </div>
          </Panel>

          {!canSubmitResult ? (
            <Panel>
              <PanelHeader
                eyebrow="Result Gate"
                title="Result evidence will open after play starts"
              />
              <div className="border-b border-line p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Evidence checklist</p>
                <div className="mt-3 grid gap-2 text-sm leading-6 text-muted">
                  {[
                    ["1", "Before play", "Screenshot the lobby or invite screen showing both game handles."],
                    ["2", "After play", "Upload the final scoreboard screenshot or a short video showing the result."],
                    ["3", "Keep names visible", "Do not crop out usernames, room code, final result, or match time."],
                    ["4", "Explain anything unusual", "Use the note for disconnects, forfeit, overtime, lag, or rule issues."]
                  ].map(([step, title, detail]) => (
                    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-md border border-line bg-white p-3" key={step}>
                      <span className="grid size-8 place-items-center rounded-full bg-cyan text-xs font-black text-white">{step}</span>
                      <span>
                        <strong className="block text-ink">{title}</strong>
                        <span className="block text-muted">{detail}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 p-4">
                <div className="rounded-md border border-cyan-200 bg-cyanSoft p-4 text-sm font-bold text-cyan">
                  {resultReadinessMessage(room, canConfirmStart)}
                </div>
                {canConfirmStart ? (
                  <RoomActionForm action={startMatchPlayIslandAction} className="grid gap-3 sm:max-w-xs" refreshOnSuccess>
                    <input name="match_room_id" type="hidden" value={room.id} />
                    <SubmitButton idleLabel="Confirm ready" pendingLabel="Confirming..." />
                  </RoomActionForm>
                ) : null}
                <p className="text-xs font-bold leading-5 text-muted">
                  Score summaries stay optional because some games resolve through placement, eliminations, survival, forfeit, or other non-scoreline outcomes.
                </p>
              </div>
            </Panel>
          ) : null}
        </div>
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
