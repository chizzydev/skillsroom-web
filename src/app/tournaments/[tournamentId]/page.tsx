import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PendingLink } from "@/components/ui/PendingLink";
import { ManualPaymentPanel } from "@/components/payments/ManualPaymentPanel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Timeline } from "@/components/ui/Timeline";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth-bridge";
import {
  ApiRequestError,
  displayEnumLabel,
  formatMinorMoney,
  getTournamentDetail,
  getTournamentWinnerPage,
  listAccessibleLivestreams,
  listCommunityAnnouncements,
  listManageableAnnouncements,
  listManageableLivestreams,
  type CommunityAnnouncement,
  type CommunityLivestreamLink,
  type CommunityTournamentWinnerPage,
  type Tournament,
  type TournamentDetail,
  type TournamentHost,
  type TournamentMatch,
  type TournamentMatchSide,
  type TournamentRound,
  type TournamentStage,
  type TournamentStanding,
  type TournamentStateEvent,
  type TournamentStatus
} from "@/lib/match-room-api";
import {
  archiveTournamentAnnouncementAction,
  archiveTournamentLivestreamAction,
  checkInForTournamentAction,
  createTournamentAnnouncementAction,
  createTournamentLivestreamAction,
  publishTournamentAnnouncementAction,
  registerForTournamentAction,
  submitTournamentContributionAction
} from "./actions";

const premiumArtwork = {
  tournaments: "/marketing/skillsroom-premium/tournaments-premium.png"
} as const;

function statusTone(status: string): BadgeTone {
  if (["completed", "paid", "approved", "ready"].includes(status)) return "success";
  if (["cancelled", "voided", "disputed", "rejected"].includes(status)) return "danger";
  if (["registration_open", "in_progress", "seeding", "under_review", "submitted"].includes(status)) return "cyan";
  return "warning";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Not scheduled";
}

function projectedPrize(tournament: Tournament) {
  return Math.max(
    tournament.approved_prize_contribution_minor ?? 0,
    tournament.sponsored_prize_pool_minor + tournament.guaranteed_prize_pool_minor
  );
}

function isVisibleToPlayer(status: TournamentStatus) {
  return !["draft", "cancelled", "voided"].includes(status);
}

function lifecycleStatus(status: TournamentStatus, step: TournamentStatus[]) {
  const currentIndex = step.indexOf(status);
  return step.map((item, index) => ({
    label: displayEnumLabel(item),
    detail: lifecycleDetail(item),
    status:
      currentIndex === -1
        ? "pending" as const
        : index < currentIndex
          ? "done" as const
          : index === currentIndex
            ? "current" as const
            : "pending" as const
  }));
}

function lifecycleDetail(status: TournamentStatus) {
  const details: Record<TournamentStatus, string> = {
    draft: "Operators are still shaping the event.",
    published: "Event is visible before registration opens.",
    registration_open: "Players can register while slots remain.",
    registration_locked: "Entry list is locked for check-in and seeding.",
    seeding: "Operators prepare seeds, groups, or pairings.",
    in_progress: "Matches, rounds, or scoring windows are active.",
    awaiting_results: "Scores or evidence are being submitted.",
    under_review: "Operators are checking evidence and disputes.",
    disputed: "Resolution is paused for admin decision.",
    settlement_pending: "Results are accepted and prizes/refunds are next.",
    completed: "Event is finished and retained for audit.",
    cancelled: "Event was cancelled before completion.",
    refunded: "Approved refunds were completed instead of settling prizes.",
    voided: "Event outcome is invalidated for audit."
  };
  return details[status];
}

function buildAuditTimeline(events: TournamentStateEvent[]) {
  return events.length
    ? events.map((event, index) => ({
        label: displayEnumLabel(event.to_status),
        detail: event.reason.replaceAll("_", " "),
        status: index === events.length - 1 ? ("current" as const) : ("done" as const)
      }))
    : [{ label: "Tournament created", detail: "State changes will appear here.", status: "current" as const }];
}

function eventMetadataSummary(event: TournamentStateEvent) {
  const keys = Object.keys(event.metadata ?? {});
  if (!keys.length) return "No metadata";
  return keys
    .slice(0, 4)
    .map((key) => `${displayEnumLabel(key)}: ${String(event.metadata[key])}`)
    .join(" / ");
}

function countMatchesForStage(stage: TournamentStage, matches: TournamentMatch[]) {
  return matches.filter((match) => match.stage_id === stage.id).length;
}

function countRoundsForStage(stage: TournamentStage, rounds: TournamentRound[]) {
  return rounds.filter((round) => round.stage_id === stage.id).length;
}

function matchEntrants(match: TournamentMatch, detail: TournamentDetail) {
  const sides = detail.match_sides
    .filter((side) => side.tournament_match_id === match.id)
    .sort((left, right) => left.side_index - right.side_index);
  if (!sides.length) return "Entrants pending";

  return sides
    .map((side) => {
      const entry = side.entry_id ? detail.entries.find((item) => item.id === side.entry_id) : null;
      const label = entry?.team_name ?? entry?.display_name ?? "Slot pending";
      return side.seed ? `#${side.seed} ${label}` : label;
    })
    .join(" vs ");
}

function matchSides(match: TournamentMatch, detail: TournamentDetail) {
  return detail.match_sides
    .filter((side) => side.tournament_match_id === match.id)
    .sort((left, right) => left.side_index - right.side_index);
}

function sideEntryLabel(side: TournamentMatchSide, detail: TournamentDetail) {
  if (!side.entry_id) return "Slot pending";
  const entry = detail.entries.find((item) => item.id === side.entry_id);
  const label = entry?.team_name ?? entry?.display_name ?? side.entry_id;
  return side.seed ? `#${side.seed} ${label}` : label;
}

function sideResultTone(side: TournamentMatchSide): BadgeTone {
  if (side.is_winner || side.result === "won" || side.result === "bye") return "success";
  if (["lost", "forfeit", "no_show", "disqualified"].includes(side.result)) return "danger";
  if (side.result === "draw") return "warning";
  return "cyan";
}

function roundsForStage(stage: TournamentStage, detail: TournamentDetail) {
  return detail.rounds
    .filter((round) => round.stage_id === stage.id)
    .sort((left, right) => left.round_number - right.round_number)
    .map((round) => ({
      round,
      matches: detail.matches
        .filter((match) => match.round_id === round.id)
        .sort((left, right) => left.match_number - right.match_number)
    }));
}

function bracketStages(detail: TournamentDetail) {
  return detail.stages
    .filter((stage) => countMatchesForStage(stage, detail.matches) > 0)
    .sort((left, right) => left.stage_order - right.stage_order);
}

function stageProgress(stage: TournamentStage, detail: TournamentDetail) {
  const matches = detail.matches.filter((match) => match.stage_id === stage.id);
  const completed = matches.filter((match) => ["completed", "voided", "cancelled"].includes(match.status)).length;
  return { completed, total: matches.length };
}

function standingEntryLabel(standing: TournamentStanding, detail: TournamentDetail) {
  const entry = detail.entries.find((item) => item.id === standing.entry_id);
  return entry?.team_name ?? entry?.display_name ?? "Entry";
}

function standingStageLabel(standing: TournamentStanding, detail: TournamentDetail) {
  const stage = standing.stage_id ? detail.stages.find((item) => item.id === standing.stage_id) : null;
  return stage?.name ?? "Overall";
}

function formatStandingValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("en-NG");
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return null;
}

function rankLabel(rank: number | null) {
  return rank ? `#${rank}` : "Unranked";
}

function canManageTournamentAnnouncements(userId: string, hosts: TournamentHost[]) {
  const host = hosts.find((item) => item.user_id === userId && item.status === "active");
  if (!host) return false;
  const manageEvent = host.permissions?.manage_event;
  if (typeof manageEvent === "boolean") return manageEvent;
  return host.role !== "sponsor";
}

function hasEmbeddableLivestream(links: CommunityLivestreamLink[]) {
  return links.some((item) => Boolean(item.embed_url));
}

function standingSeed(standing: TournamentStanding) {
  const seed = standing.metadata.initial_seed ?? standing.metadata.seed;
  return typeof seed === "number" && Number.isFinite(seed) ? `Seed ${seed}` : "Seed pending";
}

function standingRecord(standing: TournamentStanding) {
  return `${standing.wins}-${standing.losses}-${standing.draws}`;
}

function orderedStandings(detail: TournamentDetail) {
  return [...detail.standings].sort((left, right) => {
    const leftStage = detail.stages.find((stage) => stage.id === left.stage_id)?.stage_order ?? 9999;
    const rightStage = detail.stages.find((stage) => stage.id === right.stage_id)?.stage_order ?? 9999;
    if (leftStage !== rightStage) return leftStage - rightStage;
    if ((left.rank ?? 9999) !== (right.rank ?? 9999)) return (left.rank ?? 9999) - (right.rank ?? 9999);
    return right.points - left.points;
  });
}

function prizeAllocationForStanding(standing: TournamentStanding, detail: TournamentDetail) {
  return detail.prize_allocations.find((allocation) => allocation.entry_id === standing.entry_id)
    ?? detail.prize_allocations.find((allocation) => allocation.rank !== null && allocation.rank === standing.rank)
    ?? null;
}

function prizeEligibleCount(detail: TournamentDetail) {
  return detail.standings.filter((standing) => Boolean(prizeAllocationForStanding(standing, detail))).length;
}

function bestPoints(detail: TournamentDetail) {
  return detail.standings.reduce((best, standing) => Math.max(best, standing.points), 0);
}

function tiebreakerSummary(standing: TournamentStanding) {
  const preferredKeys = [
    "buchholz",
    "head_to_head",
    "score_diff",
    "score_difference",
    "points_for",
    "points_against",
    "kills",
    "placement",
    "best_placement",
    "best_time_ms",
    "cumulative_score",
    "matches_played",
    "win_percentage"
  ];
  const keys = [
    ...preferredKeys.filter((key) => Object.prototype.hasOwnProperty.call(standing.tiebreakers, key)),
    ...Object.keys(standing.tiebreakers).filter((key) => !preferredKeys.includes(key))
  ];
  const values = keys
    .map((key) => {
      const value = formatStandingValue(standing.tiebreakers[key]);
      return value ? `${displayEnumLabel(key)}: ${value}` : null;
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 3);

  return values.length ? values.join(" / ") : "No tie-breakers yet";
}

function configuredTiebreakers(detail: TournamentDetail) {
  const source = detail.settings?.tiebreakers;
  if (Array.isArray(source)) return source.map((item) => String(item)).filter(Boolean);
  if (typeof source === "string" && source.trim()) return source.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function registrationAction(tournament: TournamentDetail) {
  if (tournament.status === "registration_open") {
    const remaining = Math.max(0, tournament.max_entries - (tournament.registered_entry_count ?? 0));
    return [`${remaining} slots available`, "Register here while entries are open, then complete check-in before seeding starts."] as const;
  }
  if (tournament.status === "published") return ["Registration not open", "Operators have published the event but not opened entries yet."] as const;
  if (tournament.status === "registration_locked") return ["Registration locked", "Entrants are being checked in, seeded, or grouped."] as const;
  return [displayEnumLabel(tournament.status), lifecycleDetail(tournament.status)] as const;
}

export default async function TournamentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<{
    error?: string;
    registered?: string;
    checked_in?: string;
    contribution_submitted?: string;
    announcement_saved?: string;
    announcement_published?: string;
    announcement_archived?: string;
    livestream_saved?: string;
    livestream_archived?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/tournaments");
  const { tournamentId } = await params;
  const {
    error,
    registered,
    checked_in: checkedInSuccess,
    contribution_submitted: contributionSubmitted,
    announcement_saved: announcementSaved,
    announcement_published: announcementPublished,
    announcement_archived: announcementArchived,
    livestream_saved: livestreamSaved,
    livestream_archived: livestreamArchived
  } = await searchParams;

  let detail: TournamentDetail | null = null;
  let events: TournamentStateEvent[] = [];
  let announcements: CommunityAnnouncement[] = [];
  let livestreams: CommunityLivestreamLink[] = [];
  let manageableAnnouncements: CommunityAnnouncement[] = [];
  let manageableLivestreams: CommunityLivestreamLink[] = [];
  let loadError: string | null = null;

  try {
    const result = await getTournamentDetail(tournamentId);
    detail = result.tournament;
    events = result.events;
    const announcementResult = await listCommunityAnnouncements({ scope: "tournament", tournament_id: tournamentId, limit: 12 });
    announcements = announcementResult.announcements;
    const livestreamResult = await listAccessibleLivestreams({ target_type: "tournament", tournament_id: tournamentId });
    livestreams = livestreamResult.livestreams;
  } catch {
    loadError = "This tournament could not be loaded. Check the link and try again.";
  }

  if (!detail || (!canAccessAdmin(user) && !isVisibleToPlayer(detail.status))) {
    return (
      <AppShell active="tournaments">
        <Panel>
          <PanelHeader
            description={loadError ?? "This tournament is not available to players right now."}
            eyebrow="Tournament"
            title="Tournament unavailable"
          />
          <div className="p-4">
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/tournaments">
              Back to tournaments
            </Link>
          </div>
        </Panel>
      </AppShell>
    );
  }

  const [registrationTitle, registrationDetail] = registrationAction(detail);
  const prize = projectedPrize(detail);
  const entries = detail.registered_entry_count ?? 0;
  const checkedIn = detail.checked_in_entry_count ?? 0;
  const myEntry = detail.entries.find((entry) => entry.captain_user_id === user.id)
    ?? detail.entries.find((entry) => detail.entry_members.some((member) => member.entry_id === entry.id && member.user_id === user.id));
  const viewerIsHost = detail.hosts.some((host) => host.user_id === user.id && host.status === "active");
  const viewerHasSensitiveAuditAccess = canAccessAdmin(user) || detail.created_by_user_id === user.id || viewerIsHost || Boolean(myEntry);
  const registrationOpen = detail.status === "registration_open";
  const checkInOpen = ["registration_open", "registration_locked"].includes(detail.status);
  const canCheckIn = Boolean(myEntry && myEntry.status === "registered" && checkInOpen);
  const canManageAnnouncements = canAccessAdmin(user) || canManageTournamentAnnouncements(user.id, detail.hosts) || detail.created_by_user_id === user.id;
  if (canManageAnnouncements) {
    try {
      const result = await listManageableAnnouncements({ scope: "tournament", tournament_id: tournamentId, limit: 20 });
      manageableAnnouncements = result.announcements;
      const livestreamResult = await listManageableLivestreams({ target_type: "tournament", tournament_id: tournamentId });
      manageableLivestreams = livestreamResult.livestreams;
    } catch {
      loadError = loadError ?? "Tournament loaded, but host broadcast controls could not be loaded.";
    }
  }
  const leaderboardRows = orderedStandings(detail);
  const eligiblePrizeRows = prizeEligibleCount(detail);
  const tiePolicy = configuredTiebreakers(detail);
  const visualStages = bracketStages(detail);
  const lifecycle = lifecycleStatus(detail.status, [
    "published",
    "registration_open",
    "registration_locked",
    "seeding",
    "in_progress",
    "awaiting_results",
    "under_review",
    "settlement_pending",
    "refunded",
    "completed"
  ]);
  let winnerPage: CommunityTournamentWinnerPage | null = null;
  if (["settlement_pending", "completed"].includes(detail.status)) {
    try {
      winnerPage = await getTournamentWinnerPage(detail.id);
    } catch (error) {
      if (!(error instanceof ApiRequestError && error.status === 404)) throw error;
    }
  }

  return (
    <AppShell active="tournaments">
      <section className="grid min-w-0 gap-6">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(320px,38%)]">
            <div className="relative p-5 md:p-7 lg:p-9">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(33,170,255,0.18),transparent_36%)]" />
              <div className="relative min-w-0">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={statusTone(detail.status)}>{displayEnumLabel(detail.status)}</Badge>
                  <Badge tone={statusTone(detail.fee_mode)}>{displayEnumLabel(detail.fee_mode)}</Badge>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs font-black text-white">
                    {displayEnumLabel(detail.format)}
                  </span>
                </div>
                <h1 className="mt-4 max-w-5xl break-words text-3xl font-black leading-tight [overflow-wrap:anywhere] sm:text-4xl lg:text-5xl">
                  {detail.title}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  {detail.description ?? `${detail.game_name ?? "Skillsroom"} tournament with ${displayEnumLabel(detail.scoring_mode)} scoring.`}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <PendingLink
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/10 bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
                    href="/tournaments"
                    pendingLabel="Opening tournaments..."
                  >
                    All tournaments
                  </PendingLink>
                  {canAccessAdmin(user) ? (
                    <PendingLink
                      className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover"
                      href="/admin/tournaments"
                      pendingLabel="Opening tournament ops..."
                    >
                      Manage
                    </PendingLink>
                  ) : null}
                </div>
                <div className="mt-8 grid gap-3 xl:max-w-2xl xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Event state</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Registration, check-in, review, and settlement all stay attached to one tournament record.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Player clarity</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Players can read the current state, prize model, and format without digging through operator-only detail.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Competitive history</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Finished results can stay public while sensitive evidence and payout records remain restricted.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative min-h-[300px] border-t border-white/10 xl:min-h-full xl:border-l xl:border-t-0">
              <Image alt="Premium tournament detail artwork" className="object-cover" fill priority sizes="(min-width: 1280px) 38vw, 100vw" src={premiumArtwork.tournaments} />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#08131f]/80" />
              <div className="absolute inset-x-4 bottom-4 md:inset-x-6">
                <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Tournament surface</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">A clearer event page for registrations, standings, host updates, and public-safe outcomes.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <LiveUpdateStream eventTypePrefixes={["tournament.", "notification."]} label="Tournament live" tournamentId={detail.id} />

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail={registrationDetail} label="Registration" tone="cyan" value={registrationTitle} />
          <StatusPanel detail={`${checkedIn} checked in`} label="Entries" tone="success" value={`${entries}/${detail.max_entries}`} />
          <StatusPanel detail={displayEnumLabel(detail.prize_distribution_mode)} label="Prize Pool" tone="success" value={formatMinorMoney(detail.currency, prize)} />
          <StatusPanel detail={detail.game_name ?? detail.game_id} label="Format" tone="warning" value={displayEnumLabel(detail.format)} />
        </div>

        {winnerPage ? (
          <Panel>
            <PanelHeader
              eyebrow="Completed Activity"
              title="Public-safe tournament finish"
              description="This finished-event summary stays visible while contribution proofs, payout instructions, and operator-only review details stay restricted."
            />
            <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="rounded-[1.25rem] border border-line bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success">{winnerPage.winner.result_label}</Badge>
                  {winnerPage.tournament.game_name ? <Badge tone="cyan">{winnerPage.tournament.game_name}</Badge> : null}
                </div>
                <h2 className="mt-3 text-xl font-black text-ink">{winnerPage.winner.player_label}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {winnerPage.winner.entry_name} is the retained winner record for {winnerPage.tournament.title}.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <PendingLink
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
                    href={`/community/winners/tournaments/${encodeURIComponent(detail.id)}`}
                    pendingLabel="Opening winner page..."
                  >
                    Open public winner page
                  </PendingLink>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="rounded-[1.25rem] border border-line bg-surfaceWarm p-4">
                  <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim">Visibility boundary</p>
                  <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
                    <li>Signed-in users can inspect finished tournament outcomes.</li>
                    <li>Public sharing belongs on the winner page, not the ops record.</li>
                    <li>Contribution proofs, payout instructions, and operator-only metadata stay restricted.</li>
                  </ul>
                </div>
                <div className="rounded-md border border-line bg-white p-4">
                  <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim">Placements retained</p>
                  <p className="mt-2 text-2xl font-black text-ink">{winnerPage.placements.length}</p>
                  <p className="mt-1 text-sm font-bold text-muted">Approved podium context remains visible after the event closes.</p>
                </div>
              </div>
            </div>
          </Panel>
        ) : null}

        {(error || registered || checkedInSuccess || contributionSubmitted || announcementSaved || announcementPublished || announcementArchived || livestreamSaved || livestreamArchived) ? (
          <div
            className={[
              "rounded-md border p-4 text-sm font-bold",
              error ? "border-danger bg-red-50 text-danger" : "border-success bg-successSoft text-success"
            ].join(" ")}
          >
            {error
              ?? (announcementArchived
                ? "Announcement archived."
                : announcementPublished
                  ? "Announcement published."
                  : announcementSaved
                    ? "Announcement saved."
                    : livestreamArchived
                      ? "Livestream archived."
                      : livestreamSaved
                        ? "Livestream saved."
                    : contributionSubmitted
                      ? "Contribution proof submitted for admin review."
                      : checkedInSuccess
                        ? "Check-in complete. Your entry is ready for seeding."
                        : "Registration received. Your entry is now attached to this tournament.")}
          </div>
        ) : null}

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <Panel>
            <PanelHeader
              description="These settings define how the event accepts entrants, scores matches, and handles prize obligations."
              eyebrow="Overview"
              title="Tournament policy"
            />
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Game", detail.game_name ?? detail.game_id],
                ["Ruleset", detail.ruleset_slug ?? "Flexible by stage"],
                ["Entry type", displayEnumLabel(detail.entry_type)],
                ["Scoring", displayEnumLabel(detail.scoring_mode)],
                ["Fee mode", displayEnumLabel(detail.fee_mode)],
                ["Entry fee", formatMinorMoney(detail.currency, detail.entry_fee_amount_minor)],
                ["Sponsor pool", formatMinorMoney(detail.currency, detail.sponsored_prize_pool_minor)],
                ["Guaranteed pool", formatMinorMoney(detail.currency, detail.guaranteed_prize_pool_minor)],
                ["Team size", `${detail.team_size_min}-${detail.team_size_max}`],
                ["Commission", `${detail.commission_bps / 100}%`],
                ["Registration opens", formatDate(detail.registration_opens_at)],
                ["Registration closes", formatDate(detail.registration_closes_at)],
                ["Starts", formatDate(detail.starts_at)],
                ["Ends", formatDate(detail.ends_at)]
              ].map(([label, value]) => (
                <div className="rounded-md border border-line bg-surfaceWarm p-3" key={label}>
                  <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim">{label}</p>
                  <p className="mt-2 text-sm font-black text-ink [overflow-wrap:anywhere]">{value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Lifecycle" title="Event checkpoints" />
            <div className="p-4">
              <Timeline items={lifecycle} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Broadcast"
              title="Livestream and watch links"
              description="Official event streams and watch-party links posted by operators or tournament hosts."
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
                        title={livestreams.find((item) => item.embed_url)?.title ?? "Tournament livestream"}
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
                <EmptyState title="No livestream links yet" description="When hosts publish a watch link, it will appear here for the event." />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Announcements"
              title="Tournament updates"
              description="Published host and operator updates for this event."
            />
            {announcements.length ? (
              <div className="grid gap-3 p-4">
                {announcements.map((item) => (
                  <Link
                    className="rounded-md border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh"
                    href={`/community/announcements/${encodeURIComponent(item.id)}`}
                    key={item.id}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={item.priority === "critical" ? "danger" : item.priority === "high" ? "warning" : "cyan"}>{item.priority}</Badge>
                      <Badge tone="neutral">{item.category.replaceAll("_", " ")}</Badge>
                    </div>
                    <h2 className="mt-3 text-base font-black text-ink">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted">{item.summary}</p>
                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                      {new Date(item.published_at ?? item.created_at).toLocaleString("en-NG")}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState title="No published updates yet" description="Tournament hosts and operators can post public updates here." />
              </div>
            )}
          </Panel>

          {canManageAnnouncements ? (
            <Panel>
              <PanelHeader
                eyebrow="Host Broadcast"
                title="Manage livestream links"
                description="Attach official watch links for YouTube, Twitch, Facebook, TikTok, Kick, or another safe HTTPS destination."
              />
              <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <form action={createTournamentLivestreamAction} className="grid gap-3 rounded-md border border-line bg-white p-4">
                  <input name="tournament_id" type="hidden" value={detail.id} />
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
                  <SubmitButton idleLabel="Save livestream" pendingLabel="Saving livestream..." />
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
                            <form action={archiveTournamentLivestreamAction}>
                              <input name="tournament_id" type="hidden" value={detail.id} />
                              <input name="livestream_id" type="hidden" value={item.id} />
                              <SubmitButton idleLabel="Archive" pendingLabel="Archiving..." size="sm" variant="secondary" />
                            </form>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No host livestreams yet" description="Saved tournament watch links will appear here." />
                  )}
                </div>
              </div>
            </Panel>
          ) : null}

          {canManageAnnouncements ? (
            <Panel>
              <PanelHeader
                eyebrow="Host Controls"
                title="Post a tournament update"
                description="Creators, co-hosts, and operators can save drafts or publish public updates for this tournament."
              />
              <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <form action={createTournamentAnnouncementAction} className="grid gap-3 rounded-md border border-line bg-white p-4">
                  <input name="tournament_id" type="hidden" value={detail.id} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      Category
                      <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="category">
                        <option value="tournament_update">Tournament update</option>
                        <option value="announcement">Announcement</option>
                        <option value="winner_post">Winner post</option>
                        <option value="sponsor_note">Sponsor note</option>
                        <option value="incident">Incident</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      Priority
                      <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="priority">
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                        <option value="low">Low</option>
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Title
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" maxLength={140} name="title" required />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Summary
                    <textarea className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" maxLength={280} name="summary" required />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Body
                    <textarea className="min-h-32 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" maxLength={4000} name="body" required />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      CTA label
                      <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="cta_label" />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      CTA URL
                      <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="cta_url" type="url" />
                    </label>
                  </div>
                  <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink">
                    <input name="publish_now" type="checkbox" />
                    Publish immediately
                  </label>
                  <SubmitButton idleLabel="Save update" pendingLabel="Saving update..." />
                </form>

                <div className="grid gap-3 rounded-md border border-line bg-white p-4">
                  {manageableAnnouncements.length ? (
                    manageableAnnouncements.map((item) => (
                      <div className="rounded-md border border-line bg-surfaceWarm p-4" key={item.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={item.status === "published" ? "success" : item.status === "archived" ? "danger" : "warning"}>{item.status}</Badge>
                          <Badge tone={item.priority === "critical" ? "danger" : item.priority === "high" ? "warning" : "cyan"}>{item.priority}</Badge>
                        </div>
                        <h3 className="mt-3 text-base font-black text-ink">{item.title}</h3>
                        <p className="mt-2 text-sm text-muted">{item.summary}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.status !== "published" ? (
                            <form action={publishTournamentAnnouncementAction}>
                              <input name="tournament_id" type="hidden" value={detail.id} />
                              <input name="announcement_id" type="hidden" value={item.id} />
                              <SubmitButton idleLabel="Publish" pendingLabel="Publishing..." size="sm" variant="secondary" />
                            </form>
                          ) : null}
                          {item.status !== "archived" ? (
                            <form action={archiveTournamentAnnouncementAction}>
                              <input name="tournament_id" type="hidden" value={detail.id} />
                              <input name="announcement_id" type="hidden" value={item.id} />
                              <SubmitButton idleLabel="Archive" pendingLabel="Archiving..." size="sm" variant="secondary" />
                            </form>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No host updates yet" description="Draft and published tournament posts will appear here." />
                  )}
                </div>
              </div>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader eyebrow="Contribution" title="Submit prize or entry funding" />
            <div className="border-b border-line p-4">
              <ManualPaymentPanel
                amountLabel={detail.entry_fee_amount_minor > 0 ? "Standard entry fee" : "Current entry fee"}
                amountValue={formatMinorMoney(detail.currency, detail.entry_fee_amount_minor)}
                referenceHint={`Use ${detail.title} in the transfer narration or note so the contribution can be matched quickly.`}
              />
            </div>
            <form action={submitTournamentContributionAction} className="grid gap-3 p-4">
              <input name="tournament_id" type="hidden" value={detail.id} />
              <label className="grid gap-2 text-sm font-bold text-ink">
                Source
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="source">
                  <option value="participant_entries">My entry fee</option>
                  <option value="sponsor_contribution">Sponsor contribution</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Amount
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={detail.entry_fee_amount_minor / 100} min="0" name="amount_naira" required step="100" type="number" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Reference
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="external_reference" placeholder="Transfer reference" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Proof screenshot
                <input accept="image/png,image/jpeg,image/webp" className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-surfaceHigh file:px-3 file:py-2 file:text-xs file:font-black file:text-ink focus:border-action" name="proof_file" type="file" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Proof link
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="proof_url" placeholder="Use if proof is hosted elsewhere" type="url" />
              </label>
              <div className="rounded-md border border-cyan/40 bg-cyan-50 p-4 text-sm leading-6 text-muted">
                <p className="font-black text-ink">Winner payout details</p>
                <p className="mt-1">
                  Save the bank account that should receive any tournament payout or refund for this entry so ops can settle approved winnings without manual repair work later.
                </p>
              </div>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout recipient name
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  name="payout_recipient_name"
                  placeholder="Account holder name for payout or refund"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout bank
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  name="payout_bank_name"
                  placeholder="OPay, GTBank, PalmPay..."
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout account number
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
                  inputMode="numeric"
                  name="payout_account_number"
                  placeholder="Destination account number"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout bank code <span className="font-bold text-muted">(optional)</span>
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  name="payout_bank_code"
                  placeholder="Optional settlement rail code"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout note <span className="font-bold text-muted">(optional)</span>
                <textarea
                  className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action"
                  name="payout_note"
                  placeholder="Anything ops should know about this payout account"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Notes
                <textarea className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="notes" />
              </label>
              <SubmitButton idleLabel="Submit contribution" pendingLabel="Submitting contribution..." />
            </form>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <Panel>
            <PanelHeader
              description="Prize records are explicit so manual payout and future provider automation can reconcile cleanly."
              eyebrow="Prizes"
              title="Prize pool and allocations"
            />
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <div className="rounded-md border border-line bg-surfaceWarm p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Projected or approved</p>
                <strong className="mt-2 block text-3xl font-black text-success">{formatMinorMoney(detail.currency, prize)}</strong>
                <p className="mt-2 text-sm font-bold text-muted">{displayEnumLabel(detail.prize_distribution_mode)} distribution</p>
              </div>
              <div className="rounded-md border border-line bg-surfaceWarm p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Contribution records</p>
                <strong className="mt-2 block text-3xl font-black text-ink">{detail.prize_contributions.length}</strong>
                <p className="mt-2 text-sm font-bold text-muted">Participant, sponsor, platform, and manual adjustment records</p>
              </div>
            </div>
            {detail.prize_allocations.length ? (
              <DataTable
                columns={[
                  { key: "rank", label: "Rank", render: (row) => <span className="font-mono text-xs font-bold text-ink">{row.rank ?? "Entry"}</span> },
                  { key: "amount_minor", label: "Amount", render: (row) => <span className="font-bold text-ink">{formatMinorMoney(row.currency, row.amount_minor)}</span> },
                  { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{displayEnumLabel(row.status)}</Badge> },
                  { key: "notes", label: "Notes", render: (row) => <span className="text-muted">{row.notes ?? "No note"}</span> }
                ]}
                rows={detail.prize_allocations}
              />
            ) : (
              <div className="p-4 pt-0">
                <EmptyState description="Prize allocations will appear after operators configure payout ranks or fixed awards." title="No prize allocations yet" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Registration" title="Entry readiness" />
            <div className="grid gap-3 p-4">
              <div className="rounded-md border border-line bg-white p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Slots</p>
                <p className="mt-2 text-2xl font-black text-ink">{entries}/{detail.max_entries}</p>
                <p className="mt-1 text-sm font-bold text-muted">Minimum required: {detail.min_entries}</p>
              </div>
              <div className="rounded-md border border-line bg-white p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Check-in</p>
                <p className="mt-2 text-2xl font-black text-ink">{checkedIn}</p>
                <p className="mt-1 text-sm font-bold text-muted">{checkInOpen ? "Check-in is available for registered entries." : "Check-in is not open."}</p>
              </div>
              <div className="rounded-md border border-line bg-white p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Your entry</p>
                <p className="mt-2 text-2xl font-black text-ink">{myEntry ? displayEnumLabel(myEntry.status) : "Not entered"}</p>
                <p className="mt-1 text-sm font-bold text-muted">
                  {myEntry ? displayEnumLabel(myEntry.funding_status) : registrationOpen ? "Registration is open" : "Registration is not open"}
                </p>
              </div>
            </div>
            <form action={registerForTournamentAction} className="grid gap-3 border-t border-line p-4">
              <input name="tournament_id" type="hidden" value={detail.id} />
              <label className="grid gap-2 text-sm font-bold text-ink">
                Display name
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  disabled={!registrationOpen || Boolean(myEntry)}
                  name="display_name"
                  placeholder="Name shown in bracket"
                />
              </label>
              {detail.entry_type === "team" ? (
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Team name
                  <input
                    className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                    disabled={!registrationOpen || Boolean(myEntry)}
                    name="team_name"
                    placeholder="Team or clan name"
                    required
                  />
                </label>
              ) : null}
              <SubmitButton
                className="disabled:opacity-50"
                disabled={!registrationOpen || Boolean(myEntry)}
                idleLabel={myEntry ? "Already registered" : registrationOpen ? "Register" : "Registration closed"}
                pendingLabel="Registering..."
              />
              <p className="text-xs font-bold leading-5 text-muted">
                Registration requires a complete profile, age confirmation, and a primary game account for this tournament game.
              </p>
            </form>
            <form action={checkInForTournamentAction} className="grid gap-3 border-t border-line p-4">
              <input name="tournament_id" type="hidden" value={detail.id} />
              <SubmitButton
                className="disabled:opacity-50"
                disabled={!canCheckIn}
                idleLabel={myEntry?.status === "checked_in" ? "Checked in" : checkInOpen ? "Check in" : "Check-in closed"}
                pendingLabel="Checking in..."
                variant="secondary"
              />
              <p className="text-xs font-bold leading-5 text-muted">
                Check-in confirms you are ready for seeding. Paid or hybrid entries must have approved funding first.
              </p>
            </form>
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            description="Entrants are real registration records. Team member expansion and invites continue from the same roster model."
            eyebrow="Entrants"
            title="Registered entries"
          />
          {detail.entries.length ? (
            <DataTable
              columns={[
                {
                  key: "display_name",
                  label: "Entry",
                  render: (row) => (
                    <div>
                      <strong className="text-ink">{row.team_name ?? row.display_name}</strong>
                      <p className="mt-1 text-xs font-bold text-muted">{row.captain_username ?? row.captain_display_name ?? row.captain_user_id}</p>
                    </div>
                  )
                },
                { key: "seed", label: "Seed", render: (row) => <span className="font-mono text-xs font-bold text-ink">{row.seed ?? "Pending"}</span> },
                { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{displayEnumLabel(row.status)}</Badge> },
                { key: "funding_status", label: "Funding", render: (row) => <Badge tone={statusTone(row.funding_status)}>{displayEnumLabel(row.funding_status)}</Badge> },
                { key: "checked_in_at", label: "Check-in", render: (row) => <span className="text-sm font-bold text-muted">{row.checked_in_at ? formatDate(row.checked_in_at) : "Not checked in"}</span> },
                {
                  key: "roster",
                  label: "Roster",
                  render: (row) => {
                    const members = detail.entry_members.filter((member) => member.entry_id === row.id);
                    return (
                      <span className="text-sm font-bold text-muted">
                        {members.length}/{detail.team_size_max}
                      </span>
                    );
                  }
                }
              ]}
              rows={detail.entries}
            />
          ) : (
            <div className="p-4">
              <EmptyState description="Entries will appear as players register from this page." title="No registered entries yet" />
            </div>
          )}
        </Panel>

        {detail.standings.length ? (
          <Panel>
            <PanelHeader
              description="Placements, points, records, tie-breakers, and prize eligibility are calculated from approved tournament results and explicit prize allocation records."
              eyebrow="Leaderboard"
              title="Tournament standings"
            />
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-line bg-surfaceWarm p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Ranked entries</p>
                <p className="mt-2 text-2xl font-black text-ink">{detail.standings.length}</p>
                <p className="mt-1 text-sm font-bold text-muted">Across {new Set(detail.standings.map((standing) => standing.stage_id ?? "overall")).size} table scopes</p>
              </div>
              <div className="rounded-md border border-line bg-surfaceWarm p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Prize eligible</p>
                <p className="mt-2 text-2xl font-black text-success">{eligiblePrizeRows}</p>
                <p className="mt-1 text-sm font-bold text-muted">Backed by allocation rows</p>
              </div>
              <div className="rounded-md border border-line bg-surfaceWarm p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Top points</p>
                <p className="mt-2 text-2xl font-black text-ink">{bestPoints(detail)}</p>
                <p className="mt-1 text-sm font-bold text-muted">{displayEnumLabel(detail.scoring_mode)} scoring</p>
              </div>
              <div className="rounded-md border border-line bg-surfaceWarm p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Tie policy</p>
                <p className="mt-2 text-sm font-black text-ink [overflow-wrap:anywhere]">
                  {tiePolicy.length
                    ? tiePolicy.map((item) => displayEnumLabel(item)).join(", ")
                    : "Default rank, points, and score rules"}
                </p>
              </div>
            </div>
            <DataTable
              columns={[
                { key: "rank", label: "Place", render: (row) => <span className="font-mono text-xs font-black text-ink">{rankLabel(row.rank)}</span> },
                {
                  key: "entry_id",
                  label: "Entry",
                  render: (row) => (
                    <div>
                      <strong className="text-ink">{standingEntryLabel(row, detail)}</strong>
                      <p className="mt-1 text-xs font-bold text-muted">{standingSeed(row)}</p>
                    </div>
                  )
                },
                { key: "stage_id", label: "Stage", render: (row) => <span className="text-sm font-bold text-muted">{standingStageLabel(row, detail)}</span> },
                { key: "record", label: "Record", render: (row) => <span className="font-mono text-xs font-bold text-ink">{standingRecord(row)}</span> },
                { key: "points", label: "Pts", render: (row) => <span className="font-mono text-xs font-black text-ink">{row.points}</span> },
                {
                  key: "tiebreakers",
                  label: "Tie-breakers",
                  render: (row) => <span className="text-sm font-bold text-muted">{tiebreakerSummary(row)}</span>
                },
                {
                  key: "prize",
                  label: "Prize eligibility",
                  render: (row) => {
                    const allocation = prizeAllocationForStanding(row, detail);
                    return allocation ? (
                      <div>
                        <span className="font-black text-success">{formatMinorMoney(allocation.currency, allocation.amount_minor)}</span>
                        <p className="mt-1 text-xs font-bold text-muted">{displayEnumLabel(allocation.status)}</p>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-muted">Not in payout band</span>
                    );
                  }
                }
              ]}
              rows={leaderboardRows}
            />
          </Panel>
        ) : null}

        {visualStages.length ? (
          <Panel>
            <PanelHeader
              description="Round-by-round view of generated tournament matches, including unresolved slots, byes, linked match rooms, and reviewed outcomes."
              eyebrow="Bracket"
              title="Competition map"
            />
            <div className="grid gap-5 p-4">
              {visualStages.map((stage) => {
                const stageRounds = roundsForStage(stage, detail);
                const progress = stageProgress(stage, detail);
                return (
                  <section className="min-w-0 rounded-md border border-line bg-white" key={stage.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={statusTone(stage.status)}>{displayEnumLabel(stage.status)}</Badge>
                          <Badge tone="cyan">{displayEnumLabel(stage.stage_type)}</Badge>
                        </div>
                        <h2 className="mt-2 break-words text-lg font-black text-ink [overflow-wrap:anywhere]">{stage.name}</h2>
                      </div>
                      <div className="rounded-md border border-line bg-surfaceWarm px-3 py-2 text-right">
                        <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Progress</p>
                        <p className="mt-1 text-sm font-black text-ink">{progress.completed}/{progress.total} matches</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto p-4">
                      <div className="grid min-w-[48rem] auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-4">
                        {stageRounds.map(({ round, matches }) => (
                          <div className="grid content-start gap-3" key={round.id}>
                            <div className="rounded-md border border-line bg-surfaceWarm p-3">
                              <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Round {round.round_number}</p>
                              <p className="mt-1 text-sm font-black text-ink [overflow-wrap:anywhere]">{round.name}</p>
                              <p className="mt-1 text-xs font-bold text-muted">{matches.length} matches</p>
                            </div>
                            {matches.map((match) => {
                              const sides = matchSides(match, detail);
                              return (
                                <article className="rounded-md border border-line bg-white p-3 shadow-tight" key={match.id}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Match {match.match_number}</p>
                                      <Badge tone={statusTone(match.status)}>{displayEnumLabel(match.status)}</Badge>
                                    </div>
                                    {match.match_room_id ? (
                                      <PendingLink className="shrink-0 rounded-md border border-line bg-white px-2 py-1 text-xs font-black text-cyan hover:bg-surfaceHigh" href={`/matches/${match.match_room_id}`} pendingLabel="Opening room...">
                                        Room
                                      </PendingLink>
                                    ) : null}
                                  </div>
                                  <div className="mt-3 grid gap-2">
                                    {sides.length ? sides.map((side) => (
                                      <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-line bg-surfaceWarm px-3 py-2" key={side.id}>
                                        <span className="min-w-0 text-sm font-black text-ink [overflow-wrap:anywhere]">{sideEntryLabel(side, detail)}</span>
                                        <Badge tone={sideResultTone(side)}>{displayEnumLabel(side.result)}</Badge>
                                      </div>
                                    )) : (
                                      <div className="rounded-md border border-line bg-surfaceWarm px-3 py-2 text-sm font-bold text-muted">Entrants pending</div>
                                    )}
                                  </div>
                                  <p className="mt-3 text-xs font-bold text-muted [overflow-wrap:anywhere]">
                                    {match.result_summary ?? formatDate(match.scheduled_at)}
                                  </p>
                                </article>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader
            description="Stages, rounds, and matches will fill in as operators seed and generate the tournament structure."
            eyebrow="Competition"
            title="Stages and matches"
          />
          {detail.stages.length ? (
            <DataTable
              columns={[
                { key: "name", label: "Stage", render: (row) => <strong className="text-ink">{row.name}</strong> },
                { key: "stage_type", label: "Type", render: (row) => <span className="font-bold text-muted">{displayEnumLabel(row.stage_type)}</span> },
                { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{displayEnumLabel(row.status)}</Badge> },
                { key: "rounds", label: "Rounds", render: (row) => <span className="font-mono text-xs font-bold text-ink">{countRoundsForStage(row, detail.rounds)}</span> },
                { key: "matches", label: "Matches", render: (row) => <span className="font-mono text-xs font-bold text-ink">{countMatchesForStage(row, detail.matches)}</span> }
              ]}
              rows={detail.stages}
            />
          ) : (
            <div className="p-4">
              <EmptyState description="When seeding begins, generated groups, brackets, rounds, and linked match rooms will appear here." title="Structure not generated yet" />
            </div>
          )}
        </Panel>

        {detail.matches.length ? (
          <Panel>
            <PanelHeader eyebrow="Matches" title="Tournament match rooms" />
            <DataTable
              columns={[
                { key: "match_number", label: "Match", render: (row) => <span className="font-mono text-xs font-bold text-ink">#{row.match_number}</span> },
                { key: "entrants", label: "Entrants", render: (row) => <span className="text-sm font-bold text-ink">{matchEntrants(row, detail)}</span> },
                { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{displayEnumLabel(row.status)}</Badge> },
                { key: "scheduled_at", label: "Scheduled", render: (row) => <span className="text-muted">{formatDate(row.scheduled_at)}</span> },
                {
                  key: "match_room_id",
                  label: "Room",
                  render: (row) =>
                    row.match_room_id ? (
                      <PendingLink className="font-black text-cyan hover:text-action" href={`/matches/${row.match_room_id}`} pendingLabel="Opening room...">
                        Open room
                      </PendingLink>
                    ) : (
                      <span className="text-muted">Not linked</span>
                    )
                },
                { key: "result_summary", label: "Result", render: (row) => <span className="text-muted">{row.result_summary ?? "Pending"}</span> }
              ]}
              rows={detail.matches}
            />
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader
            description={
              viewerHasSensitiveAuditAccess
                ? "Tournament state changes are retained for support, moderation, settlement, and dispute review."
                : "Finished-state history stays visible here without exposing actor IDs, payout detail, or operator-only metadata."
            }
            eyebrow="Audit"
            title="Tournament history"
          />
          <div className="grid gap-4 p-4">
            <Timeline items={buildAuditTimeline(events)} />
            {events.length ? (
              <DataTable
                columns={
                  viewerHasSensitiveAuditAccess
                    ? [
                        { key: "created_at", label: "When", render: (row) => <span className="font-mono text-xs font-bold text-muted">{formatDate(row.created_at)}</span> },
                        { key: "status", label: "State", render: (row) => <Badge tone={statusTone(row.to_status)}>{displayEnumLabel(row.to_status)}</Badge> },
                        { key: "reason", label: "Reason", render: (row) => <span className="font-bold text-ink">{row.reason.replaceAll("_", " ")}</span> },
                        { key: "actor_user_id", label: "Actor", render: (row) => <span className="font-mono text-xs font-bold text-muted [overflow-wrap:anywhere]">{row.actor_user_id ?? "System"}</span> },
                        { key: "metadata", label: "Metadata", render: (row) => <span className="text-sm font-bold text-muted">{eventMetadataSummary(row)}</span> }
                      ]
                    : [
                        { key: "created_at", label: "When", render: (row) => <span className="font-mono text-xs font-bold text-muted">{formatDate(row.created_at)}</span> },
                        { key: "status", label: "State", render: (row) => <Badge tone={statusTone(row.to_status)}>{displayEnumLabel(row.to_status)}</Badge> },
                        { key: "reason", label: "Public-safe summary", render: (row) => <span className="font-bold text-ink">{row.reason.replaceAll("_", " ")}</span> }
                      ]
                }
                rows={[...events].reverse().slice(0, 12)}
              />
            ) : null}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
