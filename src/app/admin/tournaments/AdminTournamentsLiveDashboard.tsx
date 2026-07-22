"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PendingLink } from "@/components/ui/PendingLink";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { displayEnumLabel, formatMinorMoney } from "@/lib/display-format";
import type { Tournament, TournamentDetail, TournamentMatch, TournamentPrizeContribution, TournamentStateEvent } from "@/lib/match-room-api";

export type AdminTournamentsSnapshot = {
  tournaments: Tournament[];
  contributions: TournamentPrizeContribution[];
  command_details: TournamentDetail[];
  command_events: Record<string, TournamentStateEvent[]>;
  loaded_at: string;
};

function statusTone(status: string): BadgeTone {
  if (["completed", "approved"].includes(status)) return "success";
  if (["cancelled", "voided", "disputed", "rejected"].includes(status)) return "danger";
  if (["in_progress", "registration_open", "seeding", "submitted"].includes(status)) return "cyan";
  return "warning";
}

function prizePool(tournament: Tournament) {
  const approved = tournament.approved_prize_contribution_minor ?? 0;
  const projected = tournament.sponsored_prize_pool_minor + tournament.guaranteed_prize_pool_minor;
  return Math.max(approved, projected);
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

function commandSummary(detail: TournamentDetail) {
  const linkedMatches = detail.matches.filter((match) => match.match_room_id);
  const reviewMatches = detail.matches.filter((match) => ["awaiting_results", "under_review", "disputed"].includes(match.status));
  const checkedEntries = detail.entries.filter((entry) => entry.checked_in_at || ["checked_in", "seeded", "active", "eliminated"].includes(entry.status));
  const seededEntries = detail.entries.filter((entry) => typeof entry.seed === "number");
  return { linkedMatches, reviewMatches, checkedEntries, seededEntries, matchCheckIns: detail.match_check_ins ?? [] };
}

function oversightMatches(detail: TournamentDetail) {
  return [...detail.matches]
    .sort((left, right) => {
      const statusWeight = (status: string) => status === "disputed" ? 0 : status === "under_review" ? 1 : status === "awaiting_results" ? 2 : status === "active" ? 3 : 4;
      const byStatus = statusWeight(left.status) - statusWeight(right.status);
      if (byStatus !== 0) return byStatus;
      return Date.parse(right.updated_at ?? right.created_at) - Date.parse(left.updated_at ?? left.created_at);
    })
    .slice(0, 5);
}

async function fetchAdminTournamentsSnapshot() {
  const response = await fetch("/api/admin/tournaments/live", {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("ADMIN_TOURNAMENTS_UNAVAILABLE");
  const payload = await response.json() as { ok?: boolean; data?: AdminTournamentsSnapshot };
  if (!payload.ok || !payload.data) throw new Error("ADMIN_TOURNAMENTS_UNAVAILABLE");
  return payload.data;
}

export function AdminTournamentsLiveDashboard({ initialSnapshot }: { initialSnapshot: AdminTournamentsSnapshot }) {
  const { data: snapshot = initialSnapshot, isFetching, isError } = useQuery({
    queryKey: [...webQueryKeys.admin, "tournaments"],
    queryFn: fetchAdminTournamentsSnapshot,
    initialData: initialSnapshot,
    refetchOnMount: false,
    staleTime: 6_000
  });

  const openCount = snapshot.tournaments.filter((tournament) => tournament.status === "registration_open").length;
  const draftCount = snapshot.tournaments.filter((tournament) => tournament.status === "draft").length;
  const liveCount = snapshot.tournaments.filter((tournament) => ["seeding", "in_progress", "under_review", "disputed"].includes(tournament.status)).length;
  const prizeExposure = snapshot.tournaments.reduce((total, tournament) => total + prizePool(tournament), 0);
  const commandTotals = snapshot.command_details.reduce(
    (totals, detail) => {
      const summary = commandSummary(detail);
      return {
        entrants: totals.entrants + detail.entries.length,
        checkIns: totals.checkIns + summary.checkedEntries.length,
        matchCheckIns: totals.matchCheckIns + summary.matchCheckIns.length,
        reviewMatches: totals.reviewMatches + summary.reviewMatches.length
      };
    },
    { entrants: 0, checkIns: 0, matchCheckIns: 0, reviewMatches: 0 }
  );

  return (
    <section className="grid gap-5">
      {isError ? <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold text-amber-800">Tournament admin data could not refresh. The current dashboard is still available.</div> : null}

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusPanel detail={isFetching ? "Refreshing..." : "Registration open"} label="Open" tone="cyan" value={openCount.toString()} />
        <StatusPanel detail="Needs publishing" label="Drafts" tone="warning" value={draftCount.toString()} />
        <StatusPanel detail="Setup, live, review" label="Active" tone="danger" value={liveCount.toString()} />
        <StatusPanel detail="Approved/projected" label="Prize Exposure" tone="success" value={formatMinorMoney("NGN", prizeExposure)} />
      </div>

      <Panel>
        <PanelHeader description="See active tournaments, checked-in players, linked match rooms, disputes, and results that need attention." eyebrow="Active Events" title="Tournament dashboard" />
        {snapshot.command_details.length ? (
          <div className="grid gap-4 p-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatusPanel detail="Loaded active events" label="Events" tone="cyan" value={snapshot.command_details.length.toString()} />
              <StatusPanel detail={`${commandTotals.checkIns} checked in`} label="Entrants" tone="success" value={commandTotals.entrants.toString()} />
              <StatusPanel detail="Player match confirmations" label="Match Check-ins" tone="warning" value={commandTotals.matchCheckIns.toString()} />
              <StatusPanel detail="Awaiting, review, dispute" label="Match Oversight" tone={commandTotals.reviewMatches ? "danger" : "success"} value={commandTotals.reviewMatches.toString()} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {snapshot.command_details.map((detail) => {
                const summary = commandSummary(detail);
                return (
                  <article className="rounded-md border border-line bg-white" key={detail.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={statusTone(detail.status)}>{displayEnumLabel(detail.status)}</Badge>
                          <Badge tone="cyan">{displayEnumLabel(detail.format)}</Badge>
                        </div>
                        <h2 className="mt-3 text-lg font-black text-ink">{detail.title}</h2>
                        <p className="mt-1 break-all font-mono text-xs font-bold text-muted">{detail.id}</p>
                      </div>
                      <PendingLink className="rounded-md border border-line bg-white px-3 py-2 text-sm font-black text-ink hover:bg-surfaceHigh" href={`/tournaments/${detail.id}`} pendingLabel="Opening event...">Open event</PendingLink>
                    </div>
                    <div className="grid gap-3 p-4 sm:grid-cols-4">
                      <div className="rounded-md border border-line bg-surfaceWarm p-3"><p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Entrants</p><p className="mt-2 text-xl font-black text-ink">{detail.entries.length}/{detail.max_entries}</p><p className="mt-1 text-xs font-bold text-muted">{summary.seededEntries.length} arranged</p></div>
                      <div className="rounded-md border border-line bg-surfaceWarm p-3"><p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Check-ins</p><p className="mt-2 text-xl font-black text-ink">{summary.checkedEntries.length}</p><p className="mt-1 text-xs font-bold text-muted">{summary.matchCheckIns.length} match confirmations</p></div>
                      <div className="rounded-md border border-line bg-surfaceWarm p-3"><p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Rooms</p><p className="mt-2 text-xl font-black text-ink">{summary.linkedMatches.length}</p><p className="mt-1 text-xs font-bold text-muted">{detail.matches.length} matches</p></div>
                      <div className="rounded-md border border-line bg-surfaceWarm p-3"><p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Reviews</p><p className="mt-2 text-xl font-black text-danger">{summary.reviewMatches.length}</p><p className="mt-1 text-xs font-bold text-muted">Needs attention</p></div>
                    </div>
                    <div className="border-t border-line p-4">
                      <DataTable
                        columns={[
                          { key: "match_number", label: "Match", render: (row) => <span className="font-mono text-xs font-bold text-ink">#{row.match_number}</span> },
                          { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{displayEnumLabel(row.status)}</Badge> },
                          { key: "entrants", label: "Entrants", render: (row) => <span className="text-sm font-bold text-ink">{matchEntrants(detail, row)}</span> },
                          { key: "match_room_id", label: "Room", render: (row) => row.match_room_id ? <PendingLink className="font-black text-cyan hover:text-action" href={`/matches/${row.match_room_id}`} pendingLabel="Opening room...">Open room</PendingLink> : <span className="text-muted">Not linked</span> }
                        ]}
                        rows={oversightMatches(detail)}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : <div className="p-4"><AdminEmptyState description="Open registration, arrange players, create matches, or start a tournament to see it here." title="No active tournaments loaded" /></div>}
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Funding Review" title="Submitted tournament contributions" description="Sponsor, entry, and prize contributions waiting for review." />
        {snapshot.contributions.length ? (
          <DataTable
            columns={[
              { key: "created_at", label: "Submitted", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
              { key: "tournament_title", label: "Tournament", render: (row) => <strong className="text-ink">{row.tournament_title ?? row.tournament_id}</strong> },
              { key: "source", label: "Source", render: (row) => <Badge tone="cyan">{displayEnumLabel(row.source)}</Badge> },
              { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{formatMinorMoney(row.currency, row.amount_minor)}</span> },
              { key: "id", label: "Contribution ID", render: (row) => <span className="break-all font-mono text-xs font-bold text-muted">{row.id}</span> }
            ]}
            rows={snapshot.contributions}
          />
        ) : <div className="p-4"><AdminEmptyState description="No tournament prize or entry contribution is waiting for review." title="Contribution queue is clear" /></div>}
      </Panel>
    </section>
  );
}
