import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminStepUpPanel } from "@/components/admin/AdminStepUpPanel";
import { TournamentResultReviewPanelClient } from "@/components/admin/TournamentResultReviewPanelClient";
import { CatalogRulesetFields } from "@/components/catalog/CatalogRulesetFields";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminShell } from "@/components/layout/AdminShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { CopyTextButton } from "@/components/ui/CopyTextButton";
import { DataTable } from "@/components/ui/DataTable";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PendingLink } from "@/components/ui/PendingLink";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import {
  displayEnumLabel,
  formatMinorMoney,
  getTournamentDetail,
  listTournamentContributions,
  listGameCatalog,
  listTournaments,
  type Game,
  type MatchRuleset,
  type Tournament,
  type TournamentDetail,
  type TournamentFormat,
  type TournamentMatch,
  type TournamentPrizeContribution,
  type TournamentStanding,
  type TournamentStateEvent
} from "@/lib/match-room-api";
import {
  applyTournamentCumulativeScoresAction,
  createTournamentAction,
  generateTournamentStructureAction,
  grantTournamentHostAction,
  linkTournamentMatchRoomsAction,
  reserveTournamentRefundsAction,
  reserveTournamentSettlementAction,
  reviewTournamentMatchResultAction,
  reviewTournamentContributionAction,
  seedTournamentAction,
  updateTournamentHostEventAction
} from "./actions";

export const dynamic = "force-dynamic";

const formatOptions: Array<{ value: TournamentFormat; label: string; note: string }> = [
  { value: "single_elimination", label: "Single elimination", note: "Knockout bracket" },
  { value: "double_elimination", label: "Double elimination", note: "Winners and losers brackets" },
  { value: "round_robin", label: "Round robin", note: "Everyone plays everyone" },
  { value: "swiss", label: "Swiss", note: "Record-based pairings" },
  { value: "group_stage_playoffs", label: "Groups + playoffs", note: "Groups feed finals" },
  { value: "league", label: "League", note: "Scheduled table" },
  { value: "season", label: "Season", note: "Long-running campaign" },
  { value: "free_for_all", label: "Free-for-all", note: "Multi-player match scoring" },
  { value: "leaderboard", label: "Leaderboard", note: "Ranked score table" },
  { value: "race", label: "Race", note: "Race placement" },
  { value: "time_trial", label: "Time trial", note: "Best-time ranking" },
  { value: "grand_prix", label: "Grand prix", note: "Multi-race points" }
];

function statusTone(status: string): BadgeTone {
  if (["completed"].includes(status)) return "success";
  if (["cancelled", "voided", "disputed"].includes(status)) return "danger";
  if (["in_progress", "registration_open", "seeding"].includes(status)) return "cyan";
  return "warning";
}

function formatWindow(value: string | null) {
  return value ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Not set";
}

function prizePool(tournament: Tournament) {
  const approved = tournament.approved_prize_contribution_minor ?? 0;
  const projected = tournament.sponsored_prize_pool_minor + tournament.guaranteed_prize_pool_minor;
  return formatMinorMoney(tournament.currency, Math.max(approved, projected));
}

function entryName(detail: TournamentDetail, entryId: string | null) {
  if (!entryId) return "TBD";
  const entry = detail.entries.find((item) => item.id === entryId);
  return entry?.team_name || entry?.display_name || entryId;
}

function matchEntrants(detail: TournamentDetail, match: TournamentMatch) {
  const sides = detail.match_sides
    .filter((side) => side.tournament_match_id === match.id)
    .sort((left, right) => left.side_index - right.side_index);
  return sides.length ? sides.map((side) => entryName(detail, side.entry_id)).join(" vs ") : "No entrants assigned";
}

function standingEntryLabel(detail: TournamentDetail, standing: TournamentStanding) {
  return entryName(detail, standing.entry_id);
}

function standingStageLabel(detail: TournamentDetail, standing: TournamentStanding) {
  const stage = standing.stage_id ? detail.stages.find((item) => item.id === standing.stage_id) : null;
  return stage?.name ?? "Overall";
}

function prizeAllocationForStanding(detail: TournamentDetail, standing: TournamentStanding) {
  return detail.prize_allocations.find((allocation) => allocation.entry_id === standing.entry_id)
    ?? detail.prize_allocations.find((allocation) => allocation.rank !== null && allocation.rank === standing.rank)
    ?? null;
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

function topStandings(detail: TournamentDetail) {
  return orderedStandings(detail).slice(0, 5);
}

function commandCenterCandidates(tournaments: Tournament[]) {
  const liveStatuses = new Set(["registration_open", "registration_locked", "seeding", "in_progress", "awaiting_results", "under_review", "disputed", "settlement_pending"]);
  return tournaments
    .filter((tournament) => liveStatuses.has(tournament.status));
}

function commandSummary(detail: TournamentDetail) {
  const linkedMatches = detail.matches.filter((match) => match.match_room_id);
  const reviewMatches = detail.matches.filter((match) => ["awaiting_results", "under_review", "disputed"].includes(match.status));
  const openRounds = detail.rounds.filter((round) => ["ready", "in_progress"].includes(round.status));
  const checkedEntries = detail.entries.filter((entry) => entry.checked_in_at || ["checked_in", "seeded", "active", "eliminated"].includes(entry.status));
  const seededEntries = detail.entries.filter((entry) => typeof entry.seed === "number");
  const prizeEligibleStandings = detail.standings.filter((standing) => Boolean(prizeAllocationForStanding(detail, standing)));

  return {
    linkedMatches,
    reviewMatches,
    openRounds,
    checkedEntries,
    seededEntries,
    prizeEligibleStandings,
    matchCheckIns: detail.match_check_ins ?? []
  };
}

function sponsorSummary(detail: TournamentDetail) {
  const sponsorContributions = detail.prize_contributions.filter((contribution) => contribution.source === "sponsor_contribution");
  const totals = sponsorContributions.reduce(
    (sum, contribution) => {
      const key = contribution.status === "approved" ? "approved" : contribution.status === "rejected" ? "rejected" : "pending";
      return { ...sum, [key]: sum[key] + contribution.amount_minor };
    },
    { approved: 0, pending: 0, rejected: 0 }
  );

  return {
    sponsorContributions,
    activeHosts: detail.hosts.filter((host) => host.status === "active"),
    sponsorHosts: detail.hosts.filter((host) => host.role === "sponsor" && host.status === "active"),
    totals
  };
}

function oversightMatches(detail: TournamentDetail) {
  return [...detail.matches]
    .sort((left, right) => {
      const statusWeight = (status: string) => status === "disputed" ? 0 : status === "under_review" ? 1 : status === "awaiting_results" ? 2 : status === "active" ? 3 : 4;
      const byStatus = statusWeight(left.status) - statusWeight(right.status);
      if (byStatus !== 0) return byStatus;
      return Date.parse(right.updated_at ?? right.created_at) - Date.parse(left.updated_at ?? left.created_at);
    })
    .slice(0, 6);
}

function auditSummary(events: TournamentStateEvent[]) {
  return [...events]
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .slice(0, 6);
}

function eventMetadataSummary(event: TournamentStateEvent) {
  const keys = Object.keys(event.metadata ?? {});
  if (!keys.length) return "No metadata";
  return keys
    .slice(0, 3)
    .map((key) => `${displayEnumLabel(key)}: ${String(event.metadata[key])}`)
    .join(" / ");
}

function TournamentIdRow({ tournamentId }: { tournamentId: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs font-bold text-muted [overflow-wrap:anywhere]">{tournamentId}</span>
      <CopyTextButton label="tournament ID" value={tournamentId} />
    </div>
  );
}

export default async function AdminTournamentsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; created?: string; seeded?: string; structured?: string; linked?: string; scored?: string; result_reviewed?: string; settlement_reserved?: string; refunds_reserved?: string; host_granted?: string; event_updated?: string }>;
}) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/tournaments");
  if (!canUseAdminSection(user, "tournaments")) redirect("/admin");
  const { error, created, seeded, structured, linked, scored, result_reviewed: resultReviewed, settlement_reserved: settlementReserved, refunds_reserved: refundsReserved, host_granted: hostGranted, event_updated: eventUpdated } = await searchParams;

  let games: Game[] = [];
  let rulesets: MatchRuleset[] = [];
  let tournaments: Tournament[] = [];
  let contributions: TournamentPrizeContribution[] = [];
  let commandDetails: TournamentDetail[] = [];
  let commandEvents: Record<string, TournamentStateEvent[]> = {};
  let loadError: string | null = null;

  try {
    const [catalog, tournamentResult, contributionResult] = await Promise.all([
      listGameCatalog(),
      listTournaments({ limit: 40 }),
      listTournamentContributions("submitted")
    ]);
    games = catalog.games;
    rulesets = catalog.rulesets;
    tournaments = tournamentResult.tournaments;
    contributions = contributionResult.contributions;
  } catch {
    loadError = "Unable to load tournament admin data.";
  }

  if (tournaments.length) {
    try {
      const detailResults = await Promise.all(
        commandCenterCandidates(tournaments).map((tournament) => getTournamentDetail(tournament.id))
      );
      commandDetails = detailResults.map((result) => result.tournament);
      commandEvents = Object.fromEntries(detailResults.map((result) => [result.tournament.id, result.events]));
    } catch {
      loadError = loadError ?? "Unable to load active tournament details.";
    }
  }

  const selectedGame = games[0] ?? null;
  const createdTournament = created ? tournaments.find((tournament) => tournament.id === created) : null;
  const seededTournament = seeded ? tournaments.find((tournament) => tournament.id === seeded) : null;
  const structuredTournament = structured ? tournaments.find((tournament) => tournament.id === structured) : null;
  const linkedTournament = linked ? tournaments.find((tournament) => tournament.id === linked) : null;
  const scoredTournament = scored ? tournaments.find((tournament) => tournament.id === scored) : null;
  const resultReviewedTournament = resultReviewed ? tournaments.find((tournament) => tournament.id === resultReviewed) : null;
  const settlementReservedTournament = settlementReserved ? tournaments.find((tournament) => tournament.id === settlementReserved) : null;
  const refundsReservedTournament = refundsReserved ? tournaments.find((tournament) => tournament.id === refundsReserved) : null;
  const hostGrantedTournament = hostGranted ? tournaments.find((tournament) => tournament.id === hostGranted) : null;
  const eventUpdatedTournament = eventUpdated ? tournaments.find((tournament) => tournament.id === eventUpdated) : null;
  const openCount = tournaments.filter((tournament) => tournament.status === "registration_open").length;
  const draftCount = tournaments.filter((tournament) => tournament.status === "draft").length;
  const liveCount = tournaments.filter((tournament) => ["seeding", "in_progress", "under_review", "disputed"].includes(tournament.status)).length;
  const commandTotals = commandDetails.reduce(
    (totals, detail) => {
      const summary = commandSummary(detail);
      return {
        entrants: totals.entrants + detail.entries.length,
        entryCheckIns: totals.entryCheckIns + summary.checkedEntries.length,
        matchCheckIns: totals.matchCheckIns + summary.matchCheckIns.length,
        reviewMatches: totals.reviewMatches + summary.reviewMatches.length
      };
    },
    { entrants: 0, entryCheckIns: 0, matchCheckIns: 0, reviewMatches: 0 }
  );
  const prizeExposure = tournaments.reduce(
    (total, tournament) =>
      total +
      Math.max(
        tournament.approved_prize_contribution_minor ?? 0,
        tournament.sponsored_prize_pool_minor + tournament.guaranteed_prize_pool_minor
      ),
    0
  );

  return (
    <AdminShell active="tournaments">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Create tournaments, review entries, arrange players, record results, and prepare payouts."
          eyebrow="Tournaments"
          title="Tournament admin"
          tone="cyan"
        />

        <LiveUpdateStream eventTypePrefixes={["tournament.", "admin.queue.tournament_"]} label="Tournament updates" />

        {(error || loadError || createdTournament || seededTournament || structuredTournament || linkedTournament || scoredTournament || resultReviewedTournament || settlementReservedTournament || refundsReservedTournament || hostGrantedTournament || eventUpdatedTournament) && (
          <div
            className={[
              "rounded-md border p-4 text-sm font-bold",
              error || loadError ? "border-danger bg-red-50 text-danger" : "border-success bg-emerald-50 text-success"
            ].join(" ")}
          >
            {error ??
              loadError ??
              (createdTournament
                ? `Created ${createdTournament.title}.`
                : seededTournament
                  ? `Player order saved for ${seededTournament.title}.`
                  : structuredTournament
                    ? `Generated structure for ${structuredTournament.title}.`
                    : linkedTournament
                      ? `Linked match rooms for ${linkedTournament.title}.`
                      : scoredTournament
                        ? `Applied cumulative scores for ${scoredTournament.title}.`
                        : resultReviewedTournament
                          ? `Reviewed tournament result for ${resultReviewedTournament.title}.`
                          : settlementReservedTournament
                            ? `Reserved tournament settlement for ${settlementReservedTournament.title}.`
                            : refundsReservedTournament
                              ? `Reserved tournament refunds for ${refundsReservedTournament.title}.`
                              : hostGrantedTournament
                                ? `Granted host access for ${hostGrantedTournament.title}.`
                                : `Updated host controls for ${eventUpdatedTournament?.title}.`)}
          </div>
        )}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Registration open" label="Open" tone="cyan" value={openCount.toString()} />
          <StatusPanel detail="Needs publishing" label="Drafts" tone="warning" value={draftCount.toString()} />
          <StatusPanel detail="Setup, live, review" label="Active" tone="danger" value={liveCount.toString()} />
          <StatusPanel detail="Approved/projected" label="Prize Exposure" tone="success" value={formatMinorMoney("NGN", prizeExposure)} />
        </div>

        <AdminStepUpPanel returnTo="/admin/tournaments" description="Confirm your current Skillsroom password once before approving contributions, linking rooms, applying result decisions, or reserving tournament money actions." />

        <Panel>
          <PanelHeader
            description="See active tournaments, checked-in players, rounds, linked match rooms, disputes, and results that need attention."
            eyebrow="Active Events"
            title="Tournament dashboard"
          />
          {commandDetails.length ? (
            <div className="grid gap-4 p-4">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatusPanel detail="Loaded active events" label="Events" tone="cyan" value={commandDetails.length.toString()} />
                <StatusPanel detail={`${commandTotals.entryCheckIns} event check-ins`} label="Entrants" tone="success" value={commandTotals.entrants.toString()} />
                <StatusPanel detail="Player match confirmations" label="Match Check-ins" tone="warning" value={commandTotals.matchCheckIns.toString()} />
                <StatusPanel detail="Awaiting, review, dispute" label="Match Oversight" tone={commandTotals.reviewMatches ? "danger" : "success"} value={commandTotals.reviewMatches.toString()} />
              </div>

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {commandDetails.map((detail) => {
                  const summary = commandSummary(detail);
                  return (
                    <section className="rounded-md border border-line bg-white" key={detail.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={statusTone(detail.status)}>{displayEnumLabel(detail.status)}</Badge>
                            <Badge tone="cyan">{displayEnumLabel(detail.format)}</Badge>
                          </div>
                          <h2 className="mt-3 text-lg font-black text-ink">{detail.title}</h2>
                          <p className="mt-1 font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Tournament ID</p>
                          <TournamentIdRow tournamentId={detail.id} />
                        </div>
                        <PendingLink className="rounded-md border border-line bg-white px-3 py-2 text-sm font-black text-ink hover:bg-surfaceHigh" href={`/tournaments/${detail.id}`} pendingLabel="Opening event...">
                          Open event
                        </PendingLink>
                      </div>
                      <div className="grid gap-3 p-4 md:grid-cols-4">
                        <div className="rounded-md border border-line bg-surfaceWarm p-3">
                          <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Entrants</p>
                          <p className="mt-2 text-xl font-black text-ink">{detail.entries.length}/{detail.max_entries}</p>
                          <p className="mt-1 text-xs font-bold text-muted">{summary.seededEntries.length} arranged</p>
                        </div>
                        <div className="rounded-md border border-line bg-surfaceWarm p-3">
                          <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Check-ins</p>
                          <p className="mt-2 text-xl font-black text-ink">{summary.checkedEntries.length}</p>
                          <p className="mt-1 text-xs font-bold text-muted">{summary.matchCheckIns.length} match confirmations</p>
                        </div>
                        <div className="rounded-md border border-line bg-surfaceWarm p-3">
                          <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Rounds</p>
                          <p className="mt-2 text-xl font-black text-ink">{summary.openRounds.length}/{detail.rounds.length}</p>
                          <p className="mt-1 text-xs font-bold text-muted">{summary.linkedMatches.length} linked rooms</p>
                        </div>
                        <div className="rounded-md border border-line bg-surfaceWarm p-3">
                          <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Prize eligibility</p>
                          <p className="mt-2 text-xl font-black text-success">{summary.prizeEligibleStandings.length}</p>
                          <p className="mt-1 text-xs font-bold text-muted">{detail.standings.length} ranked entries</p>
                        </div>
                      </div>
                      <div className="grid gap-4 border-t border-line p-4">
                        {topStandings(detail).length ? (
                          <div className="grid gap-2">
                            <div>
                              <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Leaderboard</p>
                              <p className="mt-1 text-sm font-bold text-muted">Top placements, points, stage, and prize eligibility.</p>
                            </div>
                            <DataTable
                              columns={[
                                { key: "rank", label: "Place", render: (row) => <span className="font-mono text-xs font-black text-ink">#{row.rank ?? "-"}</span> },
                                { key: "entry", label: "Entry", render: (row) => <span className="text-sm font-bold text-ink">{standingEntryLabel(detail, row)}</span> },
                                { key: "stage", label: "Stage", render: (row) => <span className="text-sm font-bold text-muted">{standingStageLabel(detail, row)}</span> },
                                { key: "points", label: "Pts", render: (row) => <span className="font-mono text-xs font-black text-ink">{row.points}</span> },
                                {
                                  key: "prize",
                                  label: "Prize",
                                  render: (row) => {
                                    const allocation = prizeAllocationForStanding(detail, row);
                                    return allocation ? (
                                      <span className="font-bold text-success">{formatMinorMoney(allocation.currency, allocation.amount_minor)}</span>
                                    ) : (
                                      <span className="text-muted">Outside payout</span>
                                    );
                                  }
                                }
                              ]}
                              rows={topStandings(detail)}
                            />
                          </div>
                        ) : null}
                        <div className="grid gap-2">
                          <div>
                            <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Match oversight</p>
                            <p className="mt-1 text-sm font-bold text-muted">Highest-risk or most recently updated tournament matches.</p>
                          </div>
                          <DataTable
                            columns={[
                              { key: "match", label: "Match", render: (row) => <span className="font-mono text-xs font-bold text-ink">#{row.match_number}</span> },
                              { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{displayEnumLabel(row.status)}</Badge> },
                              { key: "entrants", label: "Entrants", render: (row) => <span className="text-sm font-bold text-ink">{matchEntrants(detail, row)}</span> },
                              {
                                key: "room",
                                label: "Room",
                                render: (row) =>
                                  row.match_room_id ? (
                                    <PendingLink className="font-black text-cyan hover:text-action" href={`/matches/${row.match_room_id}`} pendingLabel="Opening room...">
                                      Open room
                                    </PendingLink>
                                  ) : (
                                    <span className="text-muted">Not linked</span>
                                  )
                              }
                            ]}
                            rows={oversightMatches(detail)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <div>
                            <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Recent activity</p>
                            <p className="mt-1 text-sm font-bold text-muted">Recent changes, result decisions, and payment actions for this tournament.</p>
                          </div>
                          {commandEvents[detail.id]?.length ? (
                            <DataTable
                              columns={[
                                { key: "created_at", label: "When", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                                { key: "to_status", label: "State", render: (row) => <Badge tone={statusTone(row.to_status)}>{displayEnumLabel(row.to_status)}</Badge> },
                                { key: "reason", label: "Reason", render: (row) => <span className="font-bold text-ink">{row.reason.replaceAll("_", " ")}</span> },
                                { key: "actor_user_id", label: "Actor", render: (row) => <span className="font-mono text-xs font-bold text-muted [overflow-wrap:anywhere]">{row.actor_user_id ?? "System"}</span> },
                                { key: "metadata", label: "Metadata", render: (row) => <span className="text-sm font-bold text-muted">{eventMetadataSummary(row)}</span> }
                              ]}
                              rows={auditSummary(commandEvents[detail.id] ?? [])}
                            />
                          ) : (
                            <AdminEmptyState description="Updates will appear here after the tournament is opened, arranged, reviewed, or paid out." title="No recent activity" />
                          )}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <AdminEmptyState description="Open registration, arrange players, create matches, or start a tournament to see it here." title="No active tournaments loaded" />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            description="Give trusted hosts access to one tournament, track sponsor money, and update the public event details."
            eyebrow="Hosts"
            title="Sponsor and creator tools"
          />
          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="grid gap-4">
              <form action={grantTournamentHostAction} className="grid gap-3 rounded-md border border-line bg-white p-4">
                <div>
                  <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Access grant</p>
                  <h2 className="mt-1 text-lg font-black text-ink">Trusted host</h2>
                </div>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Tournament
                  <select className="min-h-11 rounded-md border border-line bg-white px-3 outline-none focus:border-action" name="tournament_id" required>
                    {tournaments.map((tournament) => (
                      <option key={tournament.id} value={tournament.id}>{tournament.title}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Username or user ID
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 outline-none focus:border-action" name="target" placeholder="creator_handle or user id" required />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Role
                  <select className="min-h-11 rounded-md border border-line bg-white px-3 outline-none focus:border-action" name="role" defaultValue="co_host">
                    <option value="creator">Creator</option>
                    <option value="co_host">Co-host</option>
                    <option value="sponsor">Sponsor</option>
                  </select>
                </label>
                <div className="grid gap-2 rounded-md border border-line bg-surfaceWarm p-3 text-sm font-bold text-ink">
                  <label className="flex items-center gap-2"><input name="manage_event" type="checkbox" defaultChecked /> Manage event</label>
                  <label className="flex items-center gap-2"><input name="manage_sponsors" type="checkbox" defaultChecked /> Manage sponsors</label>
                  <label className="flex items-center gap-2"><input name="view_finances" type="checkbox" defaultChecked /> View finances</label>
                </div>
                <textarea className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="notes" placeholder="Internal approval note" />
                <SubmitButton idleLabel="Grant access" pendingLabel="Granting access..." />
              </form>

              <form action={updateTournamentHostEventAction} className="grid gap-3 rounded-md border border-line bg-white p-4">
                <div>
                  <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Event details</p>
                  <h2 className="mt-1 text-lg font-black text-ink">Update public tournament info</h2>
                </div>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Tournament
                  <select className="min-h-11 rounded-md border border-line bg-white px-3 outline-none focus:border-action" name="tournament_id" required>
                    {tournaments.map((tournament) => (
                      <option key={tournament.id} value={tournament.id}>{tournament.title}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Tournament title
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 outline-none focus:border-action" name="title" placeholder="Leave empty to keep the current title" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Tournament description
                  <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="description" placeholder="Leave empty to keep the current description" />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Registration opens
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="registration_opens_at" type="datetime-local" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Registration closes
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="registration_closes_at" type="datetime-local" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Tournament starts
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="starts_at" type="datetime-local" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Tournament ends
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="ends_at" type="datetime-local" />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Sponsor name
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 outline-none focus:border-action" name="sponsor_label" placeholder="Optional" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Sponsor link
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 outline-none focus:border-action" name="sponsor_url" placeholder="https://sponsor.example" />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Public note
                  <textarea className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="creator_notes" placeholder="Optional note from the host or sponsor" />
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-ink"><input name="featured" type="checkbox" /> Feature this event</label>
                <SubmitButton idleLabel="Update event" pendingLabel="Updating event..." />
              </form>
            </div>

            <div className="grid gap-4">
              {commandDetails.length ? commandDetails.map((detail) => {
                const sponsors = sponsorSummary(detail);
                return (
                  <section className="rounded-md border border-line bg-white p-4" key={detail.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Sponsor tracking</p>
                        <h2 className="mt-1 text-lg font-black text-ink">{detail.title}</h2>
                        <p className="mt-1 text-sm font-bold text-muted">{sponsors.activeHosts.length} active hosts, {sponsors.sponsorHosts.length} sponsors</p>
                      </div>
                      <Badge tone="success">{formatMinorMoney(detail.currency, sponsors.totals.approved)} approved</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <StatusPanel detail="Approved sponsor money" label="Approved" tone="success" value={formatMinorMoney(detail.currency, sponsors.totals.approved)} />
                      <StatusPanel detail="Awaiting review" label="Pending" tone="warning" value={formatMinorMoney(detail.currency, sponsors.totals.pending)} />
                      <StatusPanel detail="Rejected sponsor money" label="Rejected" tone="danger" value={formatMinorMoney(detail.currency, sponsors.totals.rejected)} />
                    </div>
                    <div className="mt-4">
                      <DataTable
                        columns={[
                          { key: "role", label: "Role", render: (row) => <Badge tone={row.role === "sponsor" ? "success" : "cyan"}>{displayEnumLabel(row.role)}</Badge> },
                          { key: "name", label: "User", render: (row) => <span className="font-bold text-ink">{row.display_name || row.username || row.email || row.user_id}</span> },
                          { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{displayEnumLabel(row.status)}</Badge> },
                          { key: "permissions", label: "Permissions", render: (row) => <span className="font-mono text-[0.7rem] font-bold text-muted">{Object.keys(row.permissions ?? {}).filter((key) => row.permissions[key]).join(", ") || "none"}</span> }
                        ]}
                        rows={sponsors.activeHosts}
                      />
                    </div>
                  </section>
                );
              }) : (
                <AdminEmptyState description="Open or active tournaments will show sponsor totals and assigned host permissions here." title="No host tracking loaded" />
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            description="Review participant entry payments, sponsor contributions, platform bonuses, and manual adjustments before they count toward tournament funding."
            eyebrow="Money"
            title="Contribution review queue"
          />
          {contributions.length ? (
            <DataTable
              columns={[
                { key: "created_at", label: "Created", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                { key: "tournament_title", label: "Tournament", render: (row) => <strong className="text-ink">{row.tournament_title ?? row.tournament_id}</strong> },
                { key: "source", label: "Source", render: (row) => <Badge tone="cyan">{displayEnumLabel(row.source)}</Badge> },
                { key: "amount_minor", label: "Amount", render: (row) => <span className="font-bold text-ink">{formatMinorMoney(row.currency, row.amount_minor)}</span> },
                {
                  key: "proof_url",
                  label: "Proof",
                  render: (row) => row.proof_url ? <a className="font-black text-cyan hover:text-action" href={row.proof_url} rel="noreferrer" target="_blank">Open proof</a> : <span className="text-muted">No proof</span>
                },
                {
                  key: "review",
                  label: "Review",
                  render: (row) => (
                    <form action={reviewTournamentContributionAction} className="grid min-w-56 gap-2">
                      <input name="contribution_id" type="hidden" value={row.id} />
                      <input className="min-h-9 rounded-md border border-line bg-white px-2 text-xs outline-none focus:border-action" name="note" placeholder="Review note" />
                      <div className="grid grid-cols-2 gap-2">
                        <FormActionButton className="border-0 bg-success text-xs text-white hover:bg-success/90" idleLabel="Approve" name="decision" pendingLabel="Approving..." size="sm" value="approve" />
                        <FormActionButton className="border-0 bg-danger text-xs text-white hover:bg-red-700" idleLabel="Reject" name="decision" pendingLabel="Rejecting..." size="sm" value="reject" />
                      </div>
                    </form>
                  )
                }
              ]}
              rows={contributions}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState description="No tournament prize or entry contribution is waiting for review." title="Contribution queue is clear" />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            description="Arrange checked-in players before creating the bracket, groups, rounds, or match list."
            eyebrow="Player Setup"
            title="Arrange tournament players"
          />
          <form action={seedTournamentAction} className="grid gap-4 p-4">
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_220px_minmax(0,1fr)]">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Tournament
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="tournament_id" required>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.title} · {displayEnumLabel(tournament.status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                How should players be arranged?
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="mode">
                  <option value="registration_order">By registration order</option>
                  <option value="random">Shuffle randomly</option>
                  <option value="reputation">By player record</option>
                  <option value="manual">I will choose the order</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Note
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="Players arranged for tournament start" name="reason" />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Manual player order
              <textarea
                className="min-h-24 rounded-md border border-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-action"
                name="entry_ids"
                placeholder="Paste checked-in entry IDs in the order you want them, separated by lines, spaces, or commas."
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton idleLabel="Save player order" pendingLabel="Saving player order..." />
              <p className="text-xs font-bold text-muted">
                Manual order must include every checked-in player exactly once.
              </p>
            </div>
          </form>
        </Panel>

        <Panel>
          <PanelHeader
            description="Create the bracket, groups, rounds, or match list after players have been arranged."
            eyebrow="Structure"
            title="Create tournament matches"
          />
          <form action={generateTournamentStructureAction} className="grid gap-4 p-4">
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Tournament
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="tournament_id" required>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.title} · {displayEnumLabel(tournament.format)} · {displayEnumLabel(tournament.status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Reason
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="tournament_structure_generated" name="reason" />
              </label>
            </div>
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink">
              <input name="force" type="checkbox" />
              Regenerate existing structure
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton idleLabel="Generate stages" pendingLabel="Generating stages..." />
              <p className="text-xs font-bold text-muted">
                Use this after the tournament has enough checked-in players.
              </p>
            </div>
          </form>
        </Panel>

        <Panel>
          <PanelHeader
            description="Create Skillsroom match rooms for generated tournament matches that have exactly two resolved entrants. Multi-entrant heats remain tournament-native."
            eyebrow="Rooms"
            title="Match room linker"
          />
          <form action={linkTournamentMatchRoomsAction} className="grid gap-4 p-4">
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Tournament
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="tournament_id" required>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.title} · {displayEnumLabel(tournament.status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Reason
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="tournament_match_rooms_linked" name="reason" />
              </label>
            </div>
            <div className="grid min-w-0 gap-4 lg:grid-cols-3">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Round ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-xs outline-none focus:border-action" name="round_id" placeholder="Optional: link one round" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Match ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-xs outline-none focus:border-action" name="match_id" placeholder="Optional: link one match" />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton idleLabel="Link match rooms" pendingLabel="Linking match rooms..." />
              <p className="text-xs font-bold text-muted">
                Linked rooms open as active zero-fee tournament rooms with entrants already attached. Specific match retries safely return existing links.
              </p>
            </div>
          </form>
        </Panel>

        <Panel>
          <PanelHeader
            description="Confirm tournament match outcomes or route operational penalties with readable match labels, linked-room claim awareness, visible review history, and format-safe decision lanes."
            eyebrow="Result Review"
            title="Tournament result decisions"
          />
          <TournamentResultReviewPanelClient action={reviewTournamentMatchResultAction} tournaments={commandDetails} />
        </Panel>
        <Panel>
          <PanelHeader
            description="Prepare prize payouts after results are approved, or prepare refunds when a tournament needs to return entry money."
            eyebrow="Payments"
            title="Tournament payouts and refunds"
          />
          <div className="grid gap-5 p-4 xl:grid-cols-2">
            <form action={reserveTournamentSettlementAction} className="grid gap-3 rounded-md border border-line bg-white p-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Tournament
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="tournament_id" required>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.title} · {displayEnumLabel(tournament.status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Notes
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="notes" placeholder="Prize allocation, commission, or payout note" />
              </label>
              <SubmitButton idleLabel="Reserve prize payouts" pendingLabel="Reserving prize payouts..." />
            </form>
            <form action={reserveTournamentRefundsAction} className="grid gap-3 rounded-md border border-line bg-white p-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Tournament
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="tournament_id" required>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.title} · {displayEnumLabel(tournament.status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Refund reason
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" defaultValue="tournament_refund_reserved" name="reason" required />
              </label>
              <SubmitButton idleLabel="Reserve entry refunds" pendingLabel="Reserving entry refunds..." variant="danger" />
            </form>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            description="Add approved scores for formats that use points, placements, kills, time, or leaderboard totals."
            eyebrow="Scoring"
            title="Add tournament scores"
          />
          <form action={applyTournamentCumulativeScoresAction} className="grid gap-4 p-4">
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Tournament
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="tournament_id" required>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.title} · {displayEnumLabel(tournament.format)} · {displayEnumLabel(tournament.status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Match ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-xs outline-none focus:border-action" name="match_id" placeholder="Generated tournament match ID" required />
              </label>
            </div>
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Reason
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="cumulative_scores_applied" name="reason" />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Results
              <textarea
                className="min-h-36 rounded-md border border-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-action"
                name="results"
                placeholder="entry-id, placement, score, kills, time_ms, bonus, penalty"
                required
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton idleLabel="Apply scores" pendingLabel="Applying scores..." />
              <p className="text-xs font-bold text-muted">
                Include every player or team in the match. Duplicate, missing, or already-scored entries will be rejected.
              </p>
            </div>
          </form>
        </Panel>

        <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_440px]">
          <Panel>
            <PanelHeader
              description="Set the game, format, entry fee, prize details, registration window, and rules for a new tournament."
              eyebrow="Create"
              title="New tournament"
            />
            {selectedGame ? (
              <form action={createTournamentAction} className="grid gap-5 p-4">
                <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Title
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="title" placeholder="Friday Night Masters" required />
                  </label>
                  <CatalogRulesetFields
                    flexibleLabel="No fixed ruleset"
                    games={games}
                    includeFlexibleOption
                    initialGameSlug={selectedGame.slug}
                    initialRulesetSlug=""
                    rulesets={rulesets}
                  />
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Format
                    <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="format">
                      {formatOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} · {option.note}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-2 text-sm font-bold text-ink">
                  Description
                  <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="description" placeholder="Rules summary, contact path, device/platform expectations, and event notes." />
                </label>

                <div className="grid min-w-0 gap-4 lg:grid-cols-4">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Entry type
                    <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="entry_type">
                      <option value="solo">Solo</option>
                      <option value="team">Team</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Fee mode
                    <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="fee_mode">
                      <option value="free">Free</option>
                      <option value="paid">Paid entry</option>
                      <option value="sponsored">Sponsored</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Scoring
                    <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="scoring_mode">
                      <option value="match_win_loss">Match win/loss</option>
                      <option value="cumulative_score">Cumulative score</option>
                      <option value="points">Points</option>
                      <option value="placement">Placement</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Prize split
                    <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="prize_distribution_mode">
                      <option value="winner_take_all">Winner takes all</option>
                      <option value="top_2_split">Top 2 split</option>
                      <option value="top_3_split">Top 3 split</option>
                      <option value="custom_fixed">Custom fixed</option>
                      <option value="custom_percentage">Custom percentage</option>
                    </select>
                  </label>
                </div>

                <div className="grid min-w-0 gap-4 lg:grid-cols-4">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Currency
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm uppercase outline-none focus:border-action" defaultValue="NGN" maxLength={3} minLength={3} name="currency" required />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Entry fee
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="0" min="0" name="entry_fee_amount_naira" step="100" type="number" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Sponsor pool
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="0" min="0" name="sponsored_prize_pool_naira" step="100" type="number" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Guaranteed pool
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="0" min="0" name="guaranteed_prize_pool_naira" step="100" type="number" />
                  </label>
                </div>

                <div className="grid min-w-0 gap-4 lg:grid-cols-5">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Commission bps
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="1000" max="3000" min="0" name="commission_bps" type="number" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Min entries
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="2" min="2" name="min_entries" type="number" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Max entries
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="16" min="2" name="max_entries" required type="number" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Team min
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="1" min="1" name="team_size_min" type="number" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Team max
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="1" min="1" name="team_size_max" type="number" />
                  </label>
                </div>

                <div className="grid min-w-0 gap-4 lg:grid-cols-4">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Registration opens
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="registration_opens_at" type="datetime-local" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Registration closes
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="registration_closes_at" type="datetime-local" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Starts
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="starts_at" type="datetime-local" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Ends
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="ends_at" type="datetime-local" />
                  </label>
                </div>

                <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_1fr_1fr]">
                  <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink">
                    <input defaultChecked name="evidence_required" type="checkbox" />
                    Evidence required
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink">
                    <input name="match_check_in_required" type="checkbox" />
                    Match check-in
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink">
                    <input name="allow_waitlist" type="checkbox" />
                    Waitlist
                  </label>
                </div>

                <label className="grid gap-2 text-sm font-bold text-ink">
                  Tie-breakers
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="tiebreakers" placeholder="buchholz, head_to_head, score_difference" />
                </label>

                <div className="flex flex-wrap gap-2">
                  <SubmitButton idleLabel="Create draft tournament" pendingLabel="Creating draft tournament..." />
                </div>
              </form>
            ) : (
              <div className="p-4">
                <AdminEmptyState
                  description="Add at least one active game before creating tournaments."
                  title="No active games available"
                />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Formats" title="Enabled event types" />
            <div className="grid gap-2 p-4">
              {formatOptions.map((option) => (
                <div className="rounded-md border border-line bg-white p-3" key={option.value}>
                  <p className="text-sm font-black text-ink">{option.label}</p>
                  <p className="mt-1 text-xs font-bold text-muted">{option.note}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            description="Tournament drafts and live events appear here as they move from registration to play and payout."
            eyebrow="Events"
            title="Tournament queue"
          />
          {tournaments.length ? (
            <DataTable
              columns={[
                {
                  key: "title",
                  label: "Tournament",
                  render: (row) => (
                    <div className="min-w-56">
                      <strong className="text-sm font-black text-ink">{row.title}</strong>
                      <p className="mt-1 font-mono text-xs font-bold text-muted">{row.slug}</p>
                      <p className="mt-1 break-all font-mono text-[11px] font-bold text-muted">{row.id}</p>
                    </div>
                  )
                },
                { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{displayEnumLabel(row.status)}</Badge> },
                { key: "format", label: "Format", render: (row) => <span className="text-sm font-bold text-ink">{displayEnumLabel(row.format)}</span> },
                { key: "game_name", label: "Game", render: (row) => <span className="text-sm font-bold text-muted">{row.game_name ?? row.game_id}</span> },
                { key: "registered_entry_count", label: "Entries", render: (row) => <span className="font-mono text-xs font-bold text-ink">{row.registered_entry_count ?? 0}/{row.max_entries}</span> },
                { key: "starts_at", label: "Start", render: (row) => <span className="text-sm text-muted">{formatWindow(row.starts_at)}</span> },
                { key: "prize", label: "Prize", render: (row) => <span className="font-bold text-ink">{prizePool(row)}</span> }
              ]}
              rows={tournaments}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState
                description="Create the first tournament draft from the form above."
                title="No tournaments created yet"
              />
            </div>
          )}
        </Panel>
      </section>
    </AdminShell>
  );
}


