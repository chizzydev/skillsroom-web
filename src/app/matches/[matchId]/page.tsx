import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PlayerTrustCard } from "@/components/trust/PlayerTrustCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Timeline } from "@/components/ui/Timeline";
import { getCurrentUser } from "@/lib/auth-bridge";
import {
  formatEntryAmount,
  listAccessibleLivestreams,
  listManageableLivestreams,
  getTournamentDetail,
  getPlayerTrustSummary,
  getMatchRoomTimeline,
  getRoomFunding,
  getRoomResults,
  matchStatusLabel,
  type CommunityLivestreamLink,
  type ManualFundingSubmission,
  type MatchParticipant,
  type MatchResultClaim,
  type MatchRoom,
  type MatchRoomStatus,
  type MatchTimeline,
  type RoomFundingOverview,
  type RoomResultOverview,
  type PlayerTrustSummary,
  type TournamentDetail,
  type TournamentMatchSide,
  type TournamentEntry
} from "@/lib/match-room-api";
import {
  archiveMatchLivestreamAction,
  checkInTournamentMatchRoomAction,
  createMatchLivestreamAction,
  createRoomInviteAction,
  openMatchRoomAction,
  respondToResultClaimAction,
  submitManualFundingAction,
  submitResultClaimAction
} from "../actions";

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
  if (room.status === "funded") return ["Play the match", "The room is funded. Follow the ruleset and keep proof ready."] as const;
  if (room.status === "active") return ["Submit the result", "Upload the score and evidence when the match is done."] as const;
  if (room.status === "awaiting_results") return ["Result evidence needed", "A player should submit the final score and scoreboard proof."] as const;
  if (room.status === "under_review") return ["Admin review in progress", "Evidence and responses are being checked before settlement."] as const;
  if (room.status === "disputed") return ["Dispute review", "Settlement is paused until an operator resolves the dispute."] as const;
  if (room.status === "settlement_pending") return ["Settlement pending", "The winner is approved and payout reservation is next."] as const;
  if (room.status === "completed") return ["Room completed", "This room is settled and retained for audit history."] as const;
  return ["Room closed", "This room no longer accepts player actions."] as const;
}

function buildProcessTimeline(room: MatchRoom) {
  const order: MatchRoomStatus[] = [
    "open",
    "awaiting_funding",
    "funded",
    "active",
    "awaiting_results",
    "under_review",
    "settlement_pending",
    "completed"
  ];
  const currentIndex = order.includes(room.status) ? order.indexOf(room.status) : room.status === "draft" ? -1 : order.length;

  return [
    { label: "Open", detail: "Room is visible or shareable by code.", status: currentIndex >= 0 ? "done" as const : "current" as const },
    { label: "Fund", detail: "Both players submit exact entry proof for review.", status: currentIndex > 1 ? "done" as const : currentIndex === 1 ? "current" as const : "pending" as const },
    { label: "Play", detail: "Match starts only after funding is approved.", status: currentIndex > 3 ? "done" as const : currentIndex === 2 || currentIndex === 3 ? "current" as const : "pending" as const },
    { label: "Evidence", detail: "Winner claim, opponent response, and proof stay attached.", status: currentIndex > 5 ? "done" as const : currentIndex === 4 || currentIndex === 5 ? "current" as const : "pending" as const },
    { label: "Settle", detail: "Approved result moves to payout or refund workflow.", status: currentIndex >= 6 ? "current" as const : "pending" as const }
  ];
}

function buildAuditTimeline(data: MatchTimeline) {
  return data.events.length
    ? data.events.map((event, index) => ({
        label: matchStatusLabel(event.to_status),
        detail: event.reason.replaceAll("_", " "),
        status: index === data.events.length - 1 ? ("current" as const) : ("done" as const)
      }))
    : [{ label: "Room created", detail: "Audit events will appear as the room moves.", status: "current" as const }];
}

function participantName(participant?: MatchParticipant) {
  if (!participant) return "Open slot";
  return participant.user_id.length > 16 ? `${participant.user_id.slice(0, 8)}...${participant.user_id.slice(-4)}` : participant.user_id;
}

function playerDisplayName(participant: MatchParticipant | undefined, trust?: PlayerTrustSummary | null) {
  if (!participant) return "Open slot";
  return trust?.display_name || trust?.username || participantName(participant);
}

function primaryHandleLabel(trust?: PlayerTrustSummary | null) {
  if (!trust?.primary_game_handle) return "No game handle";
  return trust.primary_game_external_uid ? `${trust.primary_game_handle} / ${trust.primary_game_external_uid}` : trust.primary_game_handle;
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.length ? value : null;
}

function hasEmbeddableLivestream(links: CommunityLivestreamLink[]) {
  return links.some((item) => Boolean(item.embed_url));
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
  submission
}: {
  room: MatchRoom;
  participant?: MatchParticipant;
  submission?: ManualFundingSubmission;
}) {
  return (
    <div className="rounded-lg border border-line bg-surfaceWarm p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{participant?.slot.replace("_", " ") ?? "Open slot"}</p>
          <p className="mt-2 text-base font-black text-ink">{participantName(participant)}</p>
        </div>
        <Badge tone={submission ? fundingTone(submission.status) : "neutral"}>
          {submission ? displayLabel(submission.status) : "No proof"}
        </Badge>
      </div>
      <p className="mt-3 text-sm font-bold text-muted">{formatEntryAmount(room)} required</p>
      {submission ? (
        <div className="mt-3 rounded-md border border-line bg-white p-3 text-sm">
          <p className="font-bold text-ink">{submission.sender_account_name || "Account name hidden"}</p>
          <p className="mt-1 text-muted">{submission.sender_bank_name || "Bank not supplied"}</p>
          {submission.proof_url ? (
            <a className="mt-2 inline-flex font-black text-cyan hover:text-action" href={submission.proof_url} rel="noreferrer" target="_blank">
              View screenshot
            </a>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted">Waiting for bank, account name, and transfer screenshot.</p>
      )}
    </div>
  );
}

export default async function MatchDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ error?: string; invite_sent?: string; checked_in?: string; livestream_saved?: string; livestream_archived?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/matches");
  const { matchId } = await params;
  const {
    error,
    invite_sent: inviteSent,
    checked_in: checkedInSuccess,
    livestream_saved: livestreamSaved,
    livestream_archived: livestreamArchived
  } = await searchParams;

  let data: MatchTimeline | null = null;
  let funding: RoomFundingOverview | null = null;
  let results: RoomResultOverview | null = null;
  let tournamentDetail: TournamentDetail | null = null;
  let livestreams: CommunityLivestreamLink[] = [];
  let manageableLivestreams: CommunityLivestreamLink[] = [];
  let loadError: string | null = null;

  try {
    data = await getMatchRoomTimeline(matchId);
    funding = await getRoomFunding(matchId);
    results = await getRoomResults(matchId);
    const livestreamResult = await listAccessibleLivestreams({ target_type: "match_room", match_room_id: matchId });
    livestreams = livestreamResult.livestreams;
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
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/matches">
              Back to rooms
            </Link>
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
  const gameName = tournamentDetail?.game_name ?? "the game";
  const currentPlayerCheckedIn = currentParticipant
    ? tournamentCheckIns.some((checkIn) => checkIn.participant_id === currentParticipant.id)
    : false;
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
  const trustByUserId = new Map<string, PlayerTrustSummary | null>(trustResults);
  const latestClaim = results?.claims[0] ?? null;
  const [baseNextTitle, baseNextDetail] = nextAction(room, participants.length);
  const [nextTitle, nextDetail] =
    isTournamentRoom && !currentPlayerCheckedIn && currentParticipant
      ? (["Check in for this match", "Confirm you are present before playing or submitting result evidence."] as const)
      : [baseNextTitle, baseNextDetail];
  const canOpen = room.status === "draft" && room.created_by_user_id === user.id;
  const canSubmitFunding = ["awaiting_funding", "funding_review", "open"].includes(room.status);
  const canSubmitResult = ["funded", "active", "awaiting_results", "under_review"].includes(room.status);
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
  if (canManageLivestreams) {
    try {
      const result = await listManageableLivestreams({ target_type: "match_room", match_room_id: matchId });
      manageableLivestreams = result.livestreams;
    } catch {
      loadError = loadError ?? "Match room loaded, but livestream controls could not be loaded.";
    }
  }

  return (
    <AppShell active="matches">
      <section className="grid gap-5 md:gap-6">
        <section className="rounded-lg border border-line bg-navy-900 p-5 text-white shadow-panel md:p-7">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <Badge tone={statusTone(room.status)}>{matchStatusLabel(room.status)}</Badge>
              <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight md:text-5xl">
                {room.title ?? "COD Mobile private room"}
              </h1>
              <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-slate-300">
                <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono text-white">{room.room_code}</span>
                <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2">{isTournamentRoom ? "Tournament match" : `${formatEntryAmount(room)} entry`}</span>
                <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2">{participants.length}/{room.max_participants} players</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {canOpen ? (
                <form action={openMatchRoomAction}>
                  <input name="match_room_id" type="hidden" value={room.id} />
                  <Button type="submit">Open room</Button>
                </form>
              ) : null}
              <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/10 bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/matches">
                All rooms
              </Link>
              {canSubmitResult ? (
                <a className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="#result">
                  Submit result
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{error}</div>
        ) : null}
        {inviteSent ? (
          <div className="rounded-md border border-success bg-successSoft p-4 text-sm font-bold text-success">
            Invite sent. The player will see it in their notifications.
          </div>
        ) : null}
        {checkedInSuccess ? (
          <div className="rounded-md border border-success bg-successSoft p-4 text-sm font-bold text-success">
            Tournament match check-in recorded.
          </div>
        ) : null}
        {livestreamSaved ? (
          <div className="rounded-md border border-success bg-successSoft p-4 text-sm font-bold text-success">
            Livestream link saved.
          </div>
        ) : null}
        {livestreamArchived ? (
          <div className="rounded-md border border-success bg-successSoft p-4 text-sm font-bold text-success">
            Livestream archived.
          </div>
        ) : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Panel className="p-4">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-cyan">Next</p>
            <h2 className="mt-2 text-xl font-black text-ink">{nextTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{nextDetail}</p>
          </Panel>
          <Panel className="p-4">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">Entry</p>
            <p className="mt-2 text-2xl font-black text-warning">{isTournamentRoom ? "Tournament" : formatEntryAmount(room)}</p>
            <p className="mt-2 text-sm font-bold text-muted">{isTournamentRoom ? "Entry handled by event policy" : "Equal amount for both players"}</p>
          </Panel>
          <Panel className="p-4">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">Players</p>
            <p className="mt-2 text-2xl font-black text-success">{participants.length}/{room.max_participants}</p>
            <p className="mt-2 text-sm font-bold text-muted">Fixed two-player room</p>
          </Panel>
          <Panel className="p-4">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">State</p>
            <p className="mt-2 text-2xl font-black text-cyan">{matchStatusLabel(room.status)}</p>
            <p className="mt-2 text-sm font-bold text-muted">Audit trail enabled</p>
          </Panel>
        </div>

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
                  <Button disabled={!canTournamentCheckIn} type="submit">
                    {currentPlayerCheckedIn ? "Checked in" : "Check in"}
                  </Button>
                </form>
                {!currentParticipant ? (
                  <p className="mt-3 text-xs font-bold leading-5 text-muted">Only assigned match participants can check in.</p>
                ) : null}
              </div>
            </div>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader
            eyebrow="Broadcast"
            title="Watch links"
            description="Official livestream and watch-party links for this room."
          />
          {livestreams.length ? (
            <div className="grid gap-4 p-4">
              {hasEmbeddableLivestream(livestreams) ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
                  <div className="overflow-hidden rounded-md border border-line bg-black">
                    <iframe
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="aspect-video w-full"
                      referrerPolicy="strict-origin-when-cross-origin"
                      src={livestreams.find((item) => item.embed_url)?.embed_url ?? undefined}
                      title={livestreams.find((item) => item.embed_url)?.title ?? "Match livestream"}
                    />
                  </div>
                  <div className="grid gap-3">
                    {livestreams.map((item) => (
                      <a
                        className="rounded-md border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh"
                        href={item.stream_url}
                        key={item.id}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={item.is_featured ? "success" : "cyan"}>{item.provider}</Badge>
                          <Badge tone="neutral">{item.visibility}</Badge>
                        </div>
                        <h2 className="mt-3 text-base font-black text-ink">{item.title}</h2>
                        <p className="mt-2 text-sm text-muted">
                          {item.embed_url ? "Embedded watch available here." : "Opens on the provider because inline embed is not trusted for this source."}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {livestreams.map((item) => (
                    <a
                      className="rounded-md border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh"
                      href={item.stream_url}
                      key={item.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.is_featured ? "success" : "cyan"}>{item.provider}</Badge>
                        <Badge tone="neutral">{item.visibility}</Badge>
                      </div>
                      <h2 className="mt-3 text-base font-black text-ink">{item.title}</h2>
                      <p className="mt-2 text-sm text-muted">Open stream on {item.provider}.</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4">
              <p className="text-sm font-bold text-muted">No livestream links yet for this room.</p>
            </div>
          )}
        </Panel>

        {canManageLivestreams ? (
          <Panel>
            <PanelHeader
              eyebrow="Broadcast Controls"
              title="Manage room livestreams"
              description="Room creators, operators, and linked tournament hosts can attach official watch links."
            />
            <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <form action={createMatchLivestreamAction} className="grid gap-3 rounded-md border border-line bg-white p-4">
                <input name="match_room_id" type="hidden" value={room.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Provider
                    <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="provider">
                      <option value="youtube">YouTube</option>
                      <option value="twitch">Twitch</option>
                      <option value="facebook">Facebook</option>
                      <option value="tiktok">TikTok</option>
                      <option value="kick">Kick</option>
                      <option value="generic">Generic HTTPS</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Visibility
                    <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="visibility">
                      <option value="public">Public</option>
                      <option value="participants">Participants</option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Title
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" maxLength={140} name="title" required />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Stream URL
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="stream_url" required type="url" />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Display order
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={0} name="display_order" type="number" />
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink">
                    <input name="is_featured" type="checkbox" />
                    Featured stream
                  </label>
                </div>
                <Button type="submit">Save livestream</Button>
              </form>

              <div className="grid gap-3 rounded-md border border-line bg-white p-4">
                {manageableLivestreams.length ? (
                  manageableLivestreams.map((item) => (
                    <div className="rounded-md border border-line bg-surfaceWarm p-4" key={item.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.status === "active" ? "success" : "danger"}>{item.status}</Badge>
                        <Badge tone="cyan">{item.provider}</Badge>
                      </div>
                      <h3 className="mt-3 text-base font-black text-ink">{item.title}</h3>
                      <p className="mt-2 text-sm text-muted">{item.stream_url}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.status !== "archived" ? (
                          <form action={archiveMatchLivestreamAction}>
                            <input name="match_room_id" type="hidden" value={room.id} />
                            <input name="livestream_id" type="hidden" value={item.id} />
                            <button className="inline-flex min-h-9 items-center justify-center rounded-md border border-line bg-white px-3 text-xs font-black text-ink hover:bg-surfaceHigh" type="submit">
                              Archive
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-bold text-muted">No room livestream links saved yet.</p>
                )}
              </div>
            </div>
          </Panel>
        ) : null}

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <Panel>
            <PanelHeader eyebrow="Players" title="Room slots" description="Each player stays tied to funding, evidence, and final review." />
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {(["player_a", "player_b"] as const).map((slot) => {
                const participant = participants.find((item) => item.slot === slot);
                const trust = participant ? trustByUserId.get(participant.user_id) : null;
                return (
                  <div className="rounded-lg border border-line bg-surfaceWarm p-4" key={slot}>
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

          <Panel>
            <PanelHeader eyebrow="Flow" title="Room checkpoints" />
            <div className="p-4">
              <Timeline items={buildProcessTimeline(room)} />
            </div>
          </Panel>
        </div>

        {!isTournamentRoom ? (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]" id="funding">
          <Panel>
            <PanelHeader
              eyebrow="Funding"
              title="Submit payment proof before play"
              description="Once both players are in, each player submits exact transfer proof for admin review."
            />
            <div className="border-b border-line bg-cyanSoft p-4 text-sm font-bold leading-6 text-ink">
              Closed beta payment rail: transfer to the admin-provided account for this room, then upload the screenshot below. The permanent collection account will appear here after the Kora or bank rail is finalized.
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {(["player_a", "player_b"] as const).map((slot) => {
                const participant = participants.find((item) => item.slot === slot);
                const submission = funding?.submissions.find((item) => item.participant_id === participant?.id);
                return <FundingCard key={slot} participant={participant} room={room} submission={submission} />;
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Submit Funding" title="Transfer proof" description="Amount, sender bank, account name, and screenshot are enough for review." />
            <form action={submitManualFundingAction} className="grid gap-3 p-4">
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
                Account name
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" disabled={!canSubmitFunding} name="sender_account_name" placeholder="Name shown on the transfer" required />
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
                Note <span className="font-bold text-muted">(optional)</span>
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" disabled={!canSubmitFunding} name="proof_note" placeholder="Anything admin should know" />
              </label>
              <Button disabled={!canSubmitFunding} type="submit">Submit funding</Button>
            </form>
          </Panel>
        </div>
        ) : null}

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <Panel>
            <PanelHeader
              eyebrow={isTournamentRoom ? "Event Play" : "Game Lobby"}
              title="How to connect in-game"
              description={`Skillsroom controls the room record. Players still meet inside ${gameName} to play the match.`}
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
                  placeholder={`Join ${room.room_code} for COD Mobile.`}
                />
              </label>
              <Button disabled={room.status !== "open" || participants.length >= room.max_participants} type="submit">
                Send invite
              </Button>
              {room.status !== "open" ? (
                <p className="text-xs font-bold leading-5 text-muted">This room must be open before the invited player can accept and join.</p>
              ) : null}
            </form>
          </Panel>
          ) : (
            <Panel>
              <PanelHeader eyebrow="Tournament" title="Event controls" description="Tournament opponents are assigned by the bracket, group, Swiss, league, or playoff engine." />
              <div className="grid gap-3 p-4 text-sm leading-6 text-muted">
                <p className="font-bold text-ink">Invites are disabled for linked tournament rooms.</p>
                <p>Use the assigned opponent shown above, check in for the match, then submit result evidence when play ends.</p>
                {tournamentDetail ? (
                  <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href={`/tournaments/${tournamentDetail.id}`}>
                    View tournament
                  </Link>
                ) : null}
              </div>
            </Panel>
          )}
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]" id="result">
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
                        <p className="mt-2 text-xl font-black text-ink">{claim.score_summary}</p>
                      </div>
                      <Badge tone={resultTone(claim.status)}>{displayLabel(claim.status)}</Badge>
                    </div>
                    <p className="mt-3 text-sm font-bold text-muted">Claimed winner: {participantName(results.participants.find((item) => item.id === claim.claimed_winner_participant_id))}</p>
                    {claim.note ? <p className="mt-2 text-sm leading-6 text-muted">{claim.note}</p> : null}
                    {results.evidence_items.filter((item) => item.result_claim_id === claim.id).length ? (
                      <div className="mt-4 grid gap-2">
                        {results.evidence_items
                          .filter((item) => item.result_claim_id === claim.id)
                          .map((item) => (
                            <a
                              className="rounded-md border border-line bg-white p-3 text-sm font-bold text-ink hover:border-lineStrong hover:bg-surfaceHigh"
                              href={item.uri ?? "#"}
                              key={item.id}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <span className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-cyan">{displayLabel(item.evidence_type)}</span>
                              <span className="mt-1 block [overflow-wrap:anywhere]">{item.title}</span>
                              {item.notes ? <span className="mt-1 block text-xs leading-5 text-muted">{item.notes}</span> : null}
                            </a>
                          ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-line bg-surfaceWarm p-6">
                  <p className="text-lg font-black text-ink">No result claim yet</p>
                  <p className="mt-2 text-sm leading-6 text-muted">When the match is done, submit the winner, score, and evidence link here.</p>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Submit Result" title="Winner claim" />
            <div className="border-b border-line p-4">
              <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Evidence checklist</p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
                <li>Pre-match lobby screenshot showing both COD handles.</li>
                <li>Final scoreboard screenshot or short screen recording.</li>
                <li>Score summary must match the uploaded evidence.</li>
                <li>Do not crop out usernames, room code, or final result.</li>
              </ul>
            </div>
            <form action={submitResultClaimAction} className="grid gap-3 p-4">
              <input name="match_room_id" type="hidden" value={room.id} />
              <label className="grid gap-2 text-sm font-bold text-ink">
                Claimed winner
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" disabled={!canSubmitResult} name="claimed_winner_participant_id" required>
                  {(results?.participants ?? participants).map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.slot.replace("_", " ")} - {participantName(participant)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Score
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" disabled={!canSubmitResult} name="score_summary" placeholder="2-1" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Evidence type
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" disabled={!canSubmitResult} name="evidence_type">
                  <option value="screenshot">Screenshot</option>
                  <option value="video">Video</option>
                  <option value="link">Link</option>
                  <option value="note">Note only</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Upload evidence
                <input
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                  className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-surfaceHigh file:px-3 file:py-2 file:text-xs file:font-black file:text-ink focus:border-action"
                  disabled={!canSubmitResult}
                  name="evidence_file"
                  type="file"
                />
                <span className="text-xs leading-5 text-muted">Images up to 8MB. Videos up to 80MB.</span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Evidence link
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" disabled={!canSubmitResult} name="evidence_uri" placeholder="Use only if the file is hosted elsewhere" type="url" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Evidence title
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="Final scoreboard" disabled={!canSubmitResult} name="evidence_title" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Notes
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" disabled={!canSubmitResult} name="evidence_notes" />
              </label>
              <Button disabled={!canSubmitResult} type="submit">Submit result</Button>
            </form>
          </Panel>
        </div>

        {latestClaim ? (
          <Panel>
            <PanelHeader eyebrow="Opponent Response" title="Respond to latest claim" description="Agree when the score is correct. Dispute only when evidence or rules need operator review." />
            <form action={respondToResultClaimAction} className="grid gap-3 p-4 md:grid-cols-[1fr_12rem_12rem]">
              <input name="match_room_id" type="hidden" value={room.id} />
              <input name="result_claim_id" type="hidden" value={latestClaim.id} />
              <textarea className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" placeholder="Response note" />
              <Button name="response" type="submit" value="agree">Agree</Button>
              <Button name="response" type="submit" value="dispute" variant="danger">Dispute</Button>
            </form>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader eyebrow="Audit Trail" title="State history" description="Every important room movement is recorded for support and dispute review." />
          <div className="p-4">
            <Timeline items={buildAuditTimeline(data)} />
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
