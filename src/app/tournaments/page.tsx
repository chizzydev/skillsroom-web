import Image from "next/image";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PendingLink } from "@/components/ui/PendingLink";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth-bridge";
import {
  displayEnumLabel,
  formatMinorMoney,
  listCommunityHighlights,
  listTournaments,
  type CommunityTournamentHighlightCard,
  type Tournament,
  type TournamentFormat,
  type TournamentStatus
} from "@/lib/match-room-api";
import { TournamentBoardClient, type TournamentBoardFilter, type TournamentBoardRow } from "./TournamentBoardClient";

const visibleStatuses: TournamentStatus[] = [
  "published",
  "registration_open",
  "registration_locked",
  "seeding",
  "in_progress",
  "awaiting_results",
  "under_review",
  "disputed",
  "settlement_pending",
  "refunded",
  "completed"
];

const formatGroups: Array<{ formats: TournamentFormat[]; label: string }> = [
  { label: "Brackets", formats: ["single_elimination", "double_elimination"] },
  { label: "Groups", formats: ["round_robin", "group_stage_playoffs"] },
  { label: "Swiss", formats: ["swiss"] },
  { label: "Leagues", formats: ["league", "season"] },
  { label: "Scores", formats: ["free_for_all", "leaderboard", "race", "time_trial", "grand_prix"] }
];

const premiumArtwork = {
  tournaments: "/marketing/skillsroom-premium/tournaments-premium.png",
  hero: "/marketing/skillsroom-premium/hero-premium.jpg"
} as const;

function statusTone(status: TournamentStatus): BadgeTone {
  if (["completed", "refunded"].includes(status)) return "success";
  if (["disputed", "under_review"].includes(status)) return "danger";
  if (["registration_open", "in_progress", "seeding"].includes(status)) return "cyan";
  return "warning";
}

function feeTone(feeMode: string): BadgeTone {
  if (feeMode === "free") return "success";
  if (feeMode === "sponsored") return "cyan";
  if (feeMode === "hybrid") return "warning";
  return "danger";
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

function filterByTab(tournaments: Tournament[], filter: TournamentBoardFilter) {
  if (filter === "all") return tournaments;
  if (filter === "in_progress") {
    return tournaments.filter((tournament) =>
      ["seeding", "in_progress", "awaiting_results", "under_review", "disputed", "settlement_pending"].includes(
        tournament.status
      )
    );
  }
  return tournaments.filter((tournament) => tournament.status === filter);
}

function sortTournaments(tournaments: Tournament[]) {
  const rank: Record<TournamentStatus, number> = {
    registration_open: 1,
    published: 2,
    registration_locked: 3,
    seeding: 4,
    in_progress: 5,
    awaiting_results: 6,
    under_review: 7,
    disputed: 8,
    settlement_pending: 9,
    refunded: 10,
    completed: 11,
    draft: 12,
    cancelled: 13,
    voided: 14
  };

  return [...tournaments].sort((left, right) => {
    const statusRank = rank[left.status] - rank[right.status];
    if (statusRank !== 0) return statusRank;
    return Date.parse(left.starts_at ?? left.created_at) - Date.parse(right.starts_at ?? right.created_at);
  });
}

export default async function TournamentsPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: TournamentBoardFilter }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/tournaments");
  const { filter = "all" } = await searchParams;
  const activeFilter: TournamentBoardFilter = ["all", "registration_open", "in_progress", "completed"].includes(filter)
    ? filter
    : "all";

  let tournaments: Tournament[] = [];
  let highlights: CommunityTournamentHighlightCard[] = [];
  let loadError: string | null = null;

  try {
    const [result, highlightResult] = await Promise.all([
      listTournaments({ limit: 100 }),
      listCommunityHighlights(6)
    ]);
    tournaments = sortTournaments(result.tournaments.filter((tournament) => visibleStatuses.includes(tournament.status)));
    highlights = highlightResult.tournament_highlights;
  } catch {
    loadError = "Unable to load tournaments right now. Check your session and try again.";
  }

  const tournamentBoardRows: TournamentBoardRow[] = tournaments.map((tournament) => ({
    id: tournament.id,
    title: tournament.title,
    description: tournament.description ?? null,
    status: tournament.status,
    status_label: displayEnumLabel(tournament.status),
    status_tone: statusTone(tournament.status),
    fee_mode_label: displayEnumLabel(tournament.fee_mode),
    fee_mode_tone: feeTone(tournament.fee_mode),
    format_label: displayEnumLabel(tournament.format),
    scoring_label: displayEnumLabel(tournament.scoring_mode),
    game_name: tournament.game_name ?? null,
    registered_entry_count: tournament.registered_entry_count ?? 0,
    max_entries: tournament.max_entries,
    starts_at_label: formatDate(tournament.starts_at),
    prize_label: formatMinorMoney(tournament.currency, projectedPrize(tournament)),
    entry_fee_label: formatMinorMoney(tournament.currency, tournament.entry_fee_amount_minor),
    prize_distribution_label: displayEnumLabel(tournament.prize_distribution_mode),
    entry_type_label: displayEnumLabel(tournament.entry_type),
    team_size_label: `${tournament.team_size_min}-${tournament.team_size_max}`
  }));
  const openCount = tournaments.filter((tournament) => tournament.status === "registration_open").length;
  const liveCount = filterByTab(tournaments, "in_progress").length;
  const completedCount = tournaments.filter((tournament) => tournament.status === "completed").length;
  const totalPrize = tournaments.reduce((sum, tournament) => sum + projectedPrize(tournament), 0);

  return (
    <AppShell active="tournaments">
      <section className="grid min-w-0 gap-6">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(320px,40%)]">
            <div className="relative p-5 md:p-7 lg:p-9">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(33,170,255,0.18),transparent_36%)]" />
              <div className="relative">
                <Badge tone="cyan">Tournaments</Badge>
                <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                  Find serious Skillsroom events.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  Browse brackets, groups, Swiss events, leagues, and score-based formats across supported games.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {canAccessAdmin(user) ? (
                    <PendingLink
                      className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/10 bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
                      href="/admin/tournaments"
                      pendingLabel="Opening tournament ops..."
                    >
                      Manage events
                    </PendingLink>
                  ) : null}
                </div>
                <div className="mt-8 grid gap-3 xl:max-w-2xl xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Easy to follow</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">You can quickly see whether an event is open, live, under review, or finished.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Different event types</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">You can run brackets, leagues, Swiss events, and score-based competitions here.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Finished events stay visible</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Completed events can still be viewed later without showing private review details.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative min-h-[320px] border-t border-white/10 xl:min-h-full xl:border-l xl:border-t-0">
              <Image alt="Premium tournament control room artwork" className="object-cover" fill priority sizes="(min-width: 1280px) 40vw, 100vw" src={premiumArtwork.tournaments} />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#08131f]/80" />
              <div className="absolute inset-x-4 bottom-4 grid gap-3 md:inset-x-6">
                <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">For players</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">See open events, finished highlights, and the format each tournament is using.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Behind the scenes</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">Reviews, funding checks, disputes, and payouts all stay tied to the same event.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loadError ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {loadError}
          </div>
        ) : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Can accept entrants" label="Open" tone="cyan" value={openCount.toString()} />
          <StatusPanel detail="Seeding, live, review" label="In Motion" tone="warning" value={liveCount.toString()} />
          <StatusPanel detail="Finished events" label="Completed" tone="success" value={completedCount.toString()} />
          <StatusPanel detail="Projected/approved" label="Prize Pools" tone="success" value={formatMinorMoney("NGN", totalPrize)} />
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel>
            <TournamentBoardClient initialFilter={activeFilter} rows={tournamentBoardRows} />
          </Panel>

          <div className="grid gap-6">
            <Panel>
              <PanelHeader eyebrow="Formats" title="Competition lanes" />
              <div className="grid gap-2 p-4">
                {formatGroups.map((group) => (
                  <div className="rounded-2xl border border-line bg-surfaceWarm p-3" key={group.label}>
                    <p className="text-sm font-black text-ink">{group.label}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-muted">
                      {group.formats.map(displayEnumLabel).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Money" title="Prize models" />
              <div className="grid gap-3 p-4 text-sm leading-6 text-muted">
                <p className="rounded-2xl border border-line bg-surfaceWarm p-3">
                  Events can be free, paid entry, sponsored, or hybrid, with manual settlement until provider automation is approved.
                </p>
                <p className="rounded-2xl border border-line bg-surfaceWarm p-3">
                  Prize pools can come from participant entries, sponsors, platform bonuses, and approved manual adjustments.
                </p>
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                eyebrow="Completed Activity"
                title="Public-safe finished events"
                description="Approved tournament outcomes stay visible here without exposing contribution, evidence, or ops-only records."
              />
              {highlights.length ? (
                <div className="grid gap-3 p-4">
                  {highlights.slice(0, 4).map((item) => (
                    <PendingLink
                      className="rounded-md border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh"
                      href={`/community/winners/tournaments/${encodeURIComponent(item.tournament_id)}`}
                      key={item.tournament_id}
                      pendingLabel="Opening winner page..."
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="success">Completed</Badge>
                        <Badge tone="cyan">{item.game_name}</Badge>
                      </div>
                      <h2 className="mt-3 text-sm font-black text-ink">{item.title}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {item.champion_entry_name ?? "Winner retained in public history"}
                      </p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                        {displayEnumLabel(item.format)} / {item.completed_match_count} completed matches
                      </p>
                    </PendingLink>
                  ))}
                  <PendingLink
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
                    href="/community/highlights"
                    pendingLabel="Opening highlights..."
                  >
                    Open highlights
                  </PendingLink>
                </div>
              ) : (
                <div className="p-4">
                  <EmptyState
                    description="Approved tournament finishes will appear here once events reach a public-safe completed state."
                    title="No finished-event highlights yet"
                  />
                </div>
              )}
            </Panel>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
