"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { RoomActionForm } from "@/components/matches/RoomActionForm";
import type { RoomLiveSnapshot } from "@/components/matches/roomLiveSnapshot";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { formatMinorMoney, matchStatusLabel, type ManualFundingSubmission, type MatchParticipant, type MatchResultClaim, type MatchRoom, type MatchRoomStatus, type RoomFundingOverview } from "@/lib/match-room-api";
import { startMatchPlayIslandAction } from "@/app/matches/actions";

type RoomLiveSnapshotIslandProps = {
  initialSnapshot: RoomLiveSnapshot;
};

async function fetchRoomLiveSnapshot(roomId: string): Promise<RoomLiveSnapshot> {
  const response = await fetch(`/api/matches/${encodeURIComponent(roomId)}/live`, {
    headers: { accept: "application/json" },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; data?: RoomLiveSnapshot; error?: string } | null;
  if (!response.ok || payload?.ok !== true || !payload.data) throw new Error("Room status could not be loaded.");
  return payload.data;
}

function displayLabel(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function statusTone(status: MatchRoomStatus, expired = false): BadgeTone {
  if (expired) return "neutral";
  if (status === "open") return "cyan";
  if (["awaiting_funding", "funding_review", "funded"].includes(status)) return "warning";
  if (["under_review", "disputed", "voided"].includes(status)) return "danger";
  if (["active", "awaiting_results", "settlement_pending", "completed"].includes(status)) return "success";
  return "neutral";
}

function resultTone(status: MatchResultClaim["status"]): BadgeTone {
  if (status === "admin_approved" || status === "opponent_agreed") return "success";
  if (status === "opponent_disputed" || status === "admin_rejected") return "danger";
  return "warning";
}

function roomExpired(room: Pick<MatchRoom, "expires_at">) {
  return Boolean(room.expires_at && new Date(room.expires_at).getTime() <= Date.now());
}

function roomDisplayStatusLabel(room: MatchRoom, expired = false) {
  return expired ? "Expired" : matchStatusLabel(room.status);
}

function formatEntryAmount(room: Pick<MatchRoom, "currency" | "entry_amount_minor">) {
  return formatMinorMoney(room.currency, room.entry_amount_minor);
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
    return { label: "Waiting", detail: "This slot has not been joined yet.", tone: "neutral" as BadgeTone };
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
    return { label: "Balance", detail: "Entry fee is locked from Skillsroom Balance.", tone: "success" as BadgeTone };
  }
  if (participant.funding_status === "approved" && (submission?.status === "approved" || escrowEntry)) {
    return { label: "Manual transfer", detail: "Payment proof is approved for this room.", tone: "success" as BadgeTone };
  }
  if (submission?.status === "submitted" || participant.funding_status === "submitted") {
    return { label: "Under review", detail: "Payment proof is waiting for Skillsroom review.", tone: "warning" as BadgeTone };
  }
  if (submission?.status === "rejected" || participant.funding_status === "rejected") {
    return { label: "Needs correction", detail: "The last proof was rejected. Player should submit a corrected proof.", tone: "danger" as BadgeTone };
  }
  if (participant.funding_status === "refunded") {
    return { label: "Refunded", detail: "This entry has been returned.", tone: "neutral" as BadgeTone };
  }

  return { label: "Not funded", detail: "Player still needs to pay the entry or upload payment proof.", tone: "neutral" as BadgeTone };
}

function nextAction(room: MatchRoom, participantCount: number, expired = false) {
  if (expired) return ["Challenge expired", "This challenge window ended before another player accepted. Open it for history, or post a fresh challenge."] as const;
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

function resultSummary(room: MatchRoom, latestClaim: MatchResultClaim | null) {
  if (!latestClaim) {
    return {
      label: "No result yet",
      detail: ["active", "awaiting_results", "under_review", "disputed"].includes(room.status)
        ? "Players can submit winner evidence after play."
        : "Result evidence opens after funding and live play.",
      tone: "neutral" as BadgeTone
    };
  }

  return {
    label: displayLabel(latestClaim.status),
    detail: scoreSummaryLabel(latestClaim.score_summary),
    tone: resultTone(latestClaim.status)
  };
}

function participantName(participant?: MatchParticipant) {
  if (!participant) return "Open slot";
  return participant.user_id.length > 16 ? `${participant.user_id.slice(0, 8)}...${participant.user_id.slice(-4)}` : participant.user_id;
}

export function RoomLiveSnapshotIsland({ initialSnapshot }: RoomLiveSnapshotIslandProps) {
  const { data = initialSnapshot, isFetching, isError } = useQuery({
    queryKey: webQueryKeys.room(initialSnapshot.room.id),
    queryFn: () => fetchRoomLiveSnapshot(initialSnapshot.room.id),
    initialData: initialSnapshot,
    refetchInterval: 20_000
  });

  const room = data.room;
  const participants = data.participants;
  const funding = data.funding;
  const latestClaim = data.results?.claims[0] ?? null;
  const currentParticipant = participants.find((participant) => participant.user_id === data.current_user_id);
  const joinedParticipants = participants.filter((participant) => participant.participant_status === "joined");
  const approvedParticipants = participants.filter((participant) => participant.funding_status === "approved");
  const participantCount = Math.max(participants.length, room.participant_count ?? 0);
  const expired = room.status === "open" && roomExpired(room);
  const [nextTitle, nextDetail] = nextAction(room, participantCount, expired);
  const allJoinedParticipantsApproved = joinedParticipants.length > 0 && joinedParticipants.every((participant) => participant.funding_status === "approved");
  const currentPlayerStartConfirmed = currentParticipant
    ? data.start_confirmations.some((confirmation) => confirmation.participant_id === currentParticipant.id)
    : false;
  const canConfirmStart =
    room.status === "funded" &&
    joinedParticipants.length === room.max_participants &&
    allJoinedParticipantsApproved &&
    Boolean(currentParticipant) &&
    !currentPlayerStartConfirmed;
  const waitingForOpponentStart =
    room.status === "funded" &&
    Boolean(currentParticipant) &&
    currentPlayerStartConfirmed &&
    data.start_confirmations.length < joinedParticipants.length;
  const result = resultSummary(room, latestClaim);
  const loadedLabel = useMemo(() => {
    return new Date(data.loaded_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  }, [data.loaded_at]);

  return (
    <section className="scroll-mt-28" id="current-step">
      <Panel className="overflow-hidden border-cyan/40 shadow-[0_24px_70px_rgba(24,197,138,0.12)]">
        <PanelHeader
          eyebrow="Live room status"
          title={nextTitle}
          description={nextDetail}
          action={<Badge tone={isError ? "warning" : isFetching ? "cyan" : "success"} live={!isError}>{isError ? "Checking" : isFetching ? "Updating" : `Live ${loadedLabel}`}</Badge>}
        />
        <div className="grid gap-3 border-b border-line bg-gradient-to-r from-cyanSoft via-white to-green-50 p-4 md:grid-cols-4">
          <div className="rounded-md border border-line bg-white p-3">
            <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Status</p>
            <div className="mt-2">
              <Badge tone={statusTone(room.status, expired)}>{roomDisplayStatusLabel(room, expired)}</Badge>
            </div>
          </div>
          <div className="rounded-md border border-line bg-white p-3">
            <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Players</p>
            <p className="mt-1 text-sm font-black text-ink">{participantCount}/{room.max_participants}</p>
          </div>
          <div className="rounded-md border border-line bg-white p-3">
            <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Entry</p>
            <p className="mt-1 text-sm font-black text-ink">{formatEntryAmount(room)}</p>
          </div>
          <div className="rounded-md border border-line bg-white p-3">
            <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Funding</p>
            <p className="mt-1 text-sm font-black text-ink">{approvedParticipants.length}/{room.max_participants} approved</p>
          </div>
        </div>
        {canConfirmStart || waitingForOpponentStart ? (
          <div className="grid gap-3 border-b border-line p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-cyan">Start confirmation</p>
              <p className="mt-2 text-sm font-bold leading-6 text-muted">
                {canConfirmStart ? "Both entries are approved. Confirm when you are ready so the match can go live." : "Your ready status is confirmed. Waiting for the other player."}
              </p>
            </div>
            {canConfirmStart ? (
              <RoomActionForm action={startMatchPlayIslandAction} className="grid gap-2" refreshOnSuccess={false}>
                <input name="match_room_id" type="hidden" value={room.id} />
                <SubmitButton idleLabel="Confirm ready" pendingLabel="Confirming..." />
              </RoomActionForm>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div className="grid gap-3 md:grid-cols-2">
            {(["player_a", "player_b"] as const).map((slot) => {
              const participant = participants.find((item) => item.slot === slot);
              const method = fundingMethodSummary(funding, participant);
              return (
                <div className="rounded-lg border border-line bg-white p-4 shadow-tight" key={slot}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{slot.replace("_", " ")}</p>
                      <p className="mt-2 break-all text-lg font-black text-ink">{participantName(participant)}</p>
                    </div>
                    <Badge tone={method.tone}>{method.label}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted">{method.detail}</p>
                </div>
              );
            })}
          </div>
          <div className="rounded-lg border border-line bg-white p-4 shadow-tight">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Result</p>
              <Badge tone={result.tone}>{result.label}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{result.detail}</p>
          </div>
        </div>
      </Panel>
    </section>
  );
}
