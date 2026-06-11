import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth-bridge";
import {
  displayEnumLabel,
  formatMinorMoney,
  listTournaments,
  type Tournament,
  type TournamentFormat,
  type TournamentStatus
} from "@/lib/match-room-api";

type TournamentFilter = "all" | "registration_open" | "in_progress" | "completed";

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

function filterByTab(tournaments: Tournament[], filter: TournamentFilter) {
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

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const entries = tournament.registered_entry_count ?? 0;
  const prize = projectedPrize(tournament);

  return (
    <article className="grid gap-4 border-b border-line p-4 last:border-b-0 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(tournament.status)}>{displayEnumLabel(tournament.status)}</Badge>
          <Badge tone={feeTone(tournament.fee_mode)}>{displayEnumLabel(tournament.fee_mode)}</Badge>
          <span className="rounded-md bg-surfaceHigh px-2 py-1 font-mono text-xs font-black text-ink">
            {displayEnumLabel(tournament.format)}
          </span>
        </div>
        <Link
          className="mt-3 block break-words text-xl font-black leading-tight text-ink [overflow-wrap:anywhere] hover:text-action"
          href={`/tournaments/${tournament.id}`}
        >
          {tournament.title}
        </Link>
        {tournament.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{tournament.description}</p>
        ) : null}
        <div className="mt-4 grid gap-2 text-sm font-bold text-muted sm:grid-cols-2 lg:grid-cols-4">
          <span>{tournament.game_name ?? "Game"} lane</span>
          <span>{displayEnumLabel(tournament.scoring_mode)} scoring</span>
          <span>{entries}/{tournament.max_entries} entries</span>
          <span>{formatDate(tournament.starts_at)}</span>
        </div>
      </div>
      <div className="grid gap-3 rounded-md border border-line bg-surfaceWarm p-3">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Prize pool</p>
          <strong className="mt-1 block text-xl font-black text-ink">
            {formatMinorMoney(tournament.currency, prize)}
          </strong>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-muted">
          <span>Entry: {formatMinorMoney(tournament.currency, tournament.entry_fee_amount_minor)}</span>
          <span>Split: {displayEnumLabel(tournament.prize_distribution_mode)}</span>
          <span>Type: {displayEnumLabel(tournament.entry_type)}</span>
          <span>Team: {tournament.team_size_min}-{tournament.team_size_max}</span>
        </div>
      </div>
    </article>
  );
}

export default async function TournamentsPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: TournamentFilter }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/tournaments");
  const { filter = "all" } = await searchParams;
  const activeFilter: TournamentFilter = ["all", "registration_open", "in_progress", "completed"].includes(filter)
    ? filter
    : "all";

  let tournaments: Tournament[] = [];
  let loadError: string | null = null;

  try {
    const result = await listTournaments({ limit: 100 });
    tournaments = sortTournaments(result.tournaments.filter((tournament) => visibleStatuses.includes(tournament.status)));
  } catch {
    loadError = "Unable to load tournaments right now. Check your session and try again.";
  }

  const visibleTournaments = filterByTab(tournaments, activeFilter);
  const openCount = tournaments.filter((tournament) => tournament.status === "registration_open").length;
  const liveCount = filterByTab(tournaments, "in_progress").length;
  const completedCount = tournaments.filter((tournament) => tournament.status === "completed").length;
  const totalPrize = tournaments.reduce((sum, tournament) => sum + projectedPrize(tournament), 0);

  return (
    <AppShell active="tournaments">
      <section className="grid min-w-0 gap-6">
        <section className="min-w-0 rounded-lg border border-line bg-white p-5 shadow-panel md:p-7">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0">
              <Badge tone="cyan">Tournaments</Badge>
              <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight text-ink sm:text-4xl lg:text-5xl">
                Find serious Skillsroom events.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:text-base">
                Browse brackets, groups, Swiss events, leagues, and cumulative-score tournaments across supported games.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canAccessAdmin(user) ? (
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
                  href="/admin/tournaments"
                >
                  Manage events
                </Link>
              ) : null}
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
            <PanelHeader
              action={
                <SegmentedControl
                  segments={[
                    { label: "All", active: activeFilter === "all", href: "/tournaments?filter=all" },
                    { label: "Open", active: activeFilter === "registration_open", href: "/tournaments?filter=registration_open" },
                    { label: "Live", active: activeFilter === "in_progress", href: "/tournaments?filter=in_progress" },
                    { label: "Done", active: activeFilter === "completed", href: "/tournaments?filter=completed" }
                  ]}
                />
              }
              description="Only published or active tournament records appear here. Drafts stay in admin operations."
              eyebrow="Events"
              title="Tournament board"
            />
            {visibleTournaments.length ? (
              <div>
                {visibleTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState
                  description="When operators publish tournaments, they will appear here with live entry, prize, format, and schedule data."
                  title="No tournaments in this view"
                />
              </div>
            )}
          </Panel>

          <div className="grid gap-6">
            <Panel>
              <PanelHeader eyebrow="Formats" title="Competition lanes" />
              <div className="grid gap-2 p-4">
                {formatGroups.map((group) => (
                  <div className="rounded-md border border-line bg-white p-3" key={group.label}>
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
                <p className="rounded-md border border-line bg-surfaceWarm p-3">
                  Events can be free, paid entry, sponsored, or hybrid, with manual settlement until provider automation is approved.
                </p>
                <p className="rounded-md border border-line bg-surfaceWarm p-3">
                  Prize pools can come from participant entries, sponsors, platform bonuses, and approved manual adjustments.
                </p>
              </div>
            </Panel>
          </div>
        </div>

        {visibleTournaments.length ? (
          <Panel>
            <PanelHeader
              description="Compact table view for comparing schedule, capacity, status, and prize exposure."
              eyebrow="Compare"
              title="Tournament table"
            />
            <DataTable
              columns={[
                {
                  key: "title",
                  label: "Tournament",
                  render: (row) => (
                    <Link className="font-black text-ink hover:text-action" href={`/tournaments/${row.id}`}>
                      {row.title}
                    </Link>
                  )
                },
                { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{displayEnumLabel(row.status)}</Badge> },
                { key: "format", label: "Format", render: (row) => <span className="font-bold text-muted">{displayEnumLabel(row.format)}</span> },
                { key: "entries", label: "Entries", render: (row) => <span className="font-mono text-xs font-bold text-ink">{row.registered_entry_count ?? 0}/{row.max_entries}</span> },
                { key: "starts_at", label: "Starts", render: (row) => <span className="text-muted">{formatDate(row.starts_at)}</span> },
                { key: "prize", label: "Prize", render: (row) => <span className="font-bold text-ink">{formatMinorMoney(row.currency, projectedPrize(row))}</span> }
              ]}
              rows={visibleTournaments}
            />
          </Panel>
        ) : null}
      </section>
    </AppShell>
  );
}
