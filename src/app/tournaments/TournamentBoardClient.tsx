"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PendingLink } from "@/components/ui/PendingLink";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

export type TournamentBoardFilter = "all" | "registration_open" | "in_progress" | "completed";

export type TournamentBoardRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  status_label: string;
  status_tone: BadgeTone;
  fee_mode_label: string;
  fee_mode_tone: BadgeTone;
  format_label: string;
  scoring_label: string;
  game_name: string | null;
  registered_entry_count: number;
  max_entries: number;
  starts_at_label: string;
  prize_label: string;
  entry_fee_label: string;
  prize_distribution_label: string;
  entry_type_label: string;
  team_size_label: string;
};

const filterSwitchDelayMs = 140;
const activeStatuses = ["seeding", "in_progress", "awaiting_results", "under_review", "disputed", "settlement_pending"];

function filterRows(rows: TournamentBoardRow[], filter: TournamentBoardFilter) {
  if (filter === "all") return rows;
  if (filter === "in_progress") return rows.filter((row) => activeStatuses.includes(row.status));
  return rows.filter((row) => row.status === filter);
}

function syncFilterInUrl(filter: TournamentBoardFilter) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (filter === "all") {
    url.searchParams.delete("filter");
  } else {
    url.searchParams.set("filter", filter);
  }
  window.history.replaceState(window.history.state, "", url);
}

function BoardSkeleton() {
  return (
    <div className="grid gap-3 p-4">
      {Array.from({ length: 2 }).map((_, index) => (
        <div className="grid gap-3 rounded-md border border-line bg-white p-4" key={index}>
          <div className="h-5 w-36 rounded bg-surfaceHigh" />
          <div className="h-8 w-3/4 rounded bg-surfaceHigh" />
          <div className="h-4 w-full rounded bg-surfaceHigh" />
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="h-4 rounded bg-surfaceHigh" />
            <div className="h-4 rounded bg-surfaceHigh" />
            <div className="h-4 rounded bg-surfaceHigh" />
            <div className="h-4 rounded bg-surfaceHigh" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TournamentCard({ tournament }: { tournament: TournamentBoardRow }) {
  return (
    <article className="grid gap-4 border-b border-line p-4 last:border-b-0 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tournament.status_tone}>{tournament.status_label}</Badge>
          <Badge tone={tournament.fee_mode_tone}>{tournament.fee_mode_label}</Badge>
          <span className="rounded-md bg-surfaceHigh px-2 py-1 font-mono text-xs font-black text-ink">
            {tournament.format_label}
          </span>
        </div>
        <PendingLink
          className="mt-3 block break-words text-xl font-black leading-tight text-ink [overflow-wrap:anywhere] hover:text-action"
          href={`/tournaments/${tournament.id}`}
          pendingLabel="Opening tournament..."
        >
          {tournament.title}
        </PendingLink>
        {tournament.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{tournament.description}</p>
        ) : null}
        <div className="mt-4 grid gap-2 text-sm font-bold text-muted sm:grid-cols-2 lg:grid-cols-4">
          <span>{tournament.game_name ?? "Game"} lane</span>
          <span>{tournament.scoring_label} scoring</span>
          <span>{tournament.registered_entry_count}/{tournament.max_entries} entries</span>
          <span>{tournament.starts_at_label}</span>
        </div>
      </div>
      <div className="grid gap-3 rounded-md border border-line bg-surfaceWarm p-3">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Prize pool</p>
          <strong className="mt-1 block text-xl font-black text-ink">{tournament.prize_label}</strong>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-muted">
          <span>Entry: {tournament.entry_fee_label}</span>
          <span>Split: {tournament.prize_distribution_label}</span>
          <span>Type: {tournament.entry_type_label}</span>
          <span>Team: {tournament.team_size_label}</span>
        </div>
      </div>
    </article>
  );
}

export function TournamentBoardClient({
  initialFilter,
  rows
}: {
  initialFilter: TournamentBoardFilter;
  rows: TournamentBoardRow[];
}) {
  const [selectedFilter, setSelectedFilter] = useState<TournamentBoardFilter>(initialFilter);
  const [switchingTo, setSwitchingTo] = useState<TournamentBoardFilter | null>(null);
  const switchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setSelectedFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    return () => {
      if (switchTimerRef.current !== null) {
        window.clearTimeout(switchTimerRef.current);
      }
    };
  }, []);

  const visibleRows = useMemo(() => filterRows(rows, selectedFilter), [rows, selectedFilter]);
  const visibleFilter = switchingTo ?? selectedFilter;

  const handleFilterChange = (value: string) => {
    const nextFilter = value as TournamentBoardFilter;
    if (!["all", "registration_open", "in_progress", "completed"].includes(nextFilter)) return;
    if (nextFilter === selectedFilter && !switchingTo) return;

    if (switchTimerRef.current !== null) {
      window.clearTimeout(switchTimerRef.current);
    }

    setSwitchingTo(nextFilter);
    switchTimerRef.current = window.setTimeout(() => {
      setSelectedFilter(nextFilter);
      setSwitchingTo(null);
      syncFilterInUrl(nextFilter);
      switchTimerRef.current = null;
    }, filterSwitchDelayMs);
  };

  return (
    <>
      <div className="border-b border-line bg-white p-4">
        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Events</p>
            <h2 className="mt-1 text-lg font-black leading-tight text-ink">Tournament board</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Only published or active tournament records appear here. Drafts stay in admin operations.
            </p>
          </div>
          <div className="flex max-w-full shrink-0 flex-wrap gap-2 overflow-x-auto">
            <SegmentedControl
              onSelect={handleFilterChange}
              pendingValue={switchingTo ?? undefined}
              segments={[
                { label: "All", active: visibleFilter === "all", value: "all" },
                { label: "Open", active: visibleFilter === "registration_open", value: "registration_open" },
                { label: "Live", active: visibleFilter === "in_progress", value: "in_progress" },
                { label: "Done", active: visibleFilter === "completed", value: "completed" }
              ]}
            />
          </div>
        </div>
      </div>

      {switchingTo ? (
        <BoardSkeleton />
      ) : visibleRows.length ? (
        <div>
          {visibleRows.map((tournament) => (
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

      {visibleRows.length ? (
        <div className="border-t border-line">
          <div className="border-b border-line bg-white p-4">
            <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Compare</p>
            <h2 className="mt-1 text-lg font-black leading-tight text-ink">Tournament table</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Compact table view for comparing schedule, capacity, status, and prize exposure.
            </p>
          </div>
          <DataTable
            columns={[
              {
                key: "title",
                label: "Tournament",
                render: (row) => (
                  <PendingLink className="font-black text-ink hover:text-action" href={`/tournaments/${row.id}`} pendingLabel="Opening tournament...">
                    {row.title}
                  </PendingLink>
                )
              },
              { key: "status", label: "Status", render: (row) => <Badge tone={row.status_tone}>{row.status_label}</Badge> },
              { key: "format_label", label: "Format", render: (row) => <span className="font-bold text-muted">{row.format_label}</span> },
              { key: "entries", label: "Entries", render: (row) => <span className="font-mono text-xs font-bold text-ink">{row.registered_entry_count}/{row.max_entries}</span> },
              { key: "starts_at_label", label: "Starts", render: (row) => <span className="text-muted">{row.starts_at_label}</span> },
              { key: "prize_label", label: "Prize", render: (row) => <span className="font-bold text-ink">{row.prize_label}</span> }
            ]}
            rows={visibleRows}
          />
        </div>
      ) : null}
    </>
  );
}
