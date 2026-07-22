"use client";

import { useQuery } from "@tanstack/react-query";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PendingLink } from "@/components/ui/PendingLink";
import { StatusPanel } from "@/components/ui/StatusPanel";
import {
  displayEnumLabel,
  formatMinorMoney,
  type TournamentActivityPayload,
  type TournamentDetail,
  type TournamentFundingPayload,
  type TournamentMatch,
  type TournamentResultReviewsPayload,
  type WalletOverview
} from "@/lib/match-room-api";

export type TournamentLiveSnapshot = {
  detail: TournamentDetail;
  events: TournamentActivityPayload["events"];
  funding: TournamentFundingPayload | null;
  result_reviews: TournamentResultReviewsPayload["result_reviews"];
  wallet: WalletOverview | null;
  current_user_id: string;
  current_user_role: string;
  viewer_entry_ids: string[];
  viewer_is_host: boolean;
  can_view_sensitive: boolean;
  loaded_at: string;
};

function statusTone(status: string): BadgeTone {
  if (["completed", "paid", "approved", "ready", "checked_in"].includes(status)) return "success";
  if (["cancelled", "voided", "disputed", "rejected", "failed"].includes(status)) return "danger";
  if (["registration_open", "in_progress", "seeding", "under_review", "submitted"].includes(status)) return "cyan";
  return "warning";
}

function projectedPrize(tournament: TournamentDetail) {
  return Math.max(
    tournament.approved_prize_contribution_minor ?? 0,
    tournament.sponsored_prize_pool_minor + tournament.guaranteed_prize_pool_minor
  );
}

function entryLabel(detail: TournamentDetail, entryId: string | null) {
  if (!entryId) return "Slot pending";
  const entry = detail.entries.find((item) => item.id === entryId);
  return entry?.team_name || entry?.display_name || entryId;
}

function matchEntrants(detail: TournamentDetail, match: TournamentMatch) {
  const sides = detail.match_sides
    .filter((side) => side.tournament_match_id === match.id)
    .sort((left, right) => left.side_index - right.side_index);
  return sides.length ? sides.map((side) => entryLabel(detail, side.entry_id)).join(" vs ") : "Entrants pending";
}

function relevantMatches(detail: TournamentDetail) {
  return [...detail.matches]
    .sort((left, right) => {
      const weight = (status: string) => status === "disputed" ? 0 : status === "under_review" ? 1 : status === "awaiting_results" ? 2 : status === "active" ? 3 : 4;
      const byStatus = weight(left.status) - weight(right.status);
      if (byStatus !== 0) return byStatus;
      return left.match_number - right.match_number;
    })
    .slice(0, 6);
}

async function fetchTournamentLiveSnapshot(tournamentId: string) {
  const response = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/live`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("TOURNAMENT_LIVE_UNAVAILABLE");
  const payload = await response.json() as { ok?: boolean; data?: TournamentLiveSnapshot };
  if (!payload.ok || !payload.data) throw new Error("TOURNAMENT_LIVE_UNAVAILABLE");
  return payload.data;
}

export function TournamentLiveIsland({ initialSnapshot }: { initialSnapshot: TournamentLiveSnapshot }) {
  const { data: snapshot = initialSnapshot, isFetching, isError } = useQuery({
    queryKey: webQueryKeys.tournament(initialSnapshot.detail.id),
    queryFn: () => fetchTournamentLiveSnapshot(initialSnapshot.detail.id),
    initialData: initialSnapshot,
    refetchOnMount: false,
    staleTime: 8_000
  });

  const detail = snapshot.detail;
  const viewerEntries = detail.entries.filter((entry) => snapshot.viewer_entry_ids.includes(entry.id));
  const checkedIn = detail.checked_in_entry_count ?? detail.entries.filter((entry) => entry.checked_in_at).length;
  const approvedFunding = snapshot.funding?.summary?.approved_contribution_minor ?? detail.approved_prize_contribution_minor ?? 0;
  const pendingFunding = (snapshot.funding?.prize_contributions ?? [])
    .filter((contribution) => contribution.status === "submitted")
    .reduce((total, contribution) => total + contribution.amount_minor, 0);
  const activeMatches = detail.matches.filter((match) => ["active", "awaiting_results", "under_review", "disputed"].includes(match.status));

  return (
    <section className="grid gap-5">
      {isError ? (
        <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Tournament could not refresh. The current event view is still available.
        </div>
      ) : null}

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusPanel detail={isFetching ? "Refreshing..." : "Current event status"} label="Status" tone={statusTone(detail.status)} value={displayEnumLabel(detail.status)} />
        <StatusPanel detail={`${checkedIn} checked in`} label="Entries" tone="success" value={`${detail.registered_entry_count ?? detail.entries.length}/${detail.max_entries}`} />
        <StatusPanel detail={`${formatMinorMoney(detail.currency, pendingFunding)} under review`} label="Funding" tone="warning" value={formatMinorMoney(detail.currency, approvedFunding)} />
        <StatusPanel detail={`${activeMatches.length} need attention`} label="Matches" tone={activeMatches.length ? "danger" : "cyan"} value={detail.matches.length.toString()} />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel>
          <PanelHeader eyebrow="Live Tournament" title="What needs attention now" description="Registration, check-in, funding, matches, and review status refresh while this page is open." />
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-line bg-surfaceWarm p-4">
              <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Prize pool</p>
              <p className="mt-2 text-xl font-black text-success">{formatMinorMoney(detail.currency, projectedPrize(detail))}</p>
              <p className="mt-1 text-xs font-bold text-muted">{displayEnumLabel(detail.prize_distribution_mode)}</p>
            </div>
            <div className="rounded-md border border-line bg-surfaceWarm p-4">
              <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Your entry</p>
              <p className="mt-2 text-xl font-black text-ink">{viewerEntries[0] ? displayEnumLabel(viewerEntries[0].status) : "Not entered"}</p>
              <p className="mt-1 text-xs font-bold text-muted">{viewerEntries[0] ? displayEnumLabel(viewerEntries[0].funding_status) : "Register while entries are open"}</p>
            </div>
            <div className="rounded-md border border-line bg-surfaceWarm p-4">
              <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Result reviews</p>
              <p className="mt-2 text-xl font-black text-ink">{snapshot.result_reviews.length}</p>
              <p className="mt-1 text-xs font-bold text-muted">{snapshot.can_view_sensitive ? "Visible to your role" : "Private review details hidden"}</p>
            </div>
            <div className="rounded-md border border-line bg-surfaceWarm p-4">
              <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Host tools</p>
              <p className="mt-2 text-xl font-black text-ink">{snapshot.viewer_is_host ? "Available" : "View only"}</p>
              <p className="mt-1 text-xs font-bold text-muted">{detail.hosts.filter((host) => host.status === "active").length} active host(s)</p>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Quick links" title="Tournament sections" />
          <div className="grid gap-2 p-4">
            <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="#registration" pendingLabel="Opening registration...">Registration and check-in</PendingLink>
            <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="#competition" pendingLabel="Opening matches...">Bracket and matches</PendingLink>
            <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="#prizes" pendingLabel="Opening prizes...">Funding and prizes</PendingLink>
            {snapshot.can_view_sensitive ? <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="#result-reviews" pendingLabel="Opening reviews...">Result review history</PendingLink> : null}
            {snapshot.viewer_is_host ? <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="#host-controls" pendingLabel="Opening host tools...">Organizer tools</PendingLink> : null}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader eyebrow="Matches" title="Bracket and match room activity" description="Open, active, disputed, and review-heavy tournament matches stay visible here." />
        <div className="grid gap-3 p-4">
          {relevantMatches(detail).length ? relevantMatches(detail).map((match) => (
            <article className="grid gap-3 rounded-md border border-line bg-white p-4 md:grid-cols-[1fr_auto] md:items-center" key={match.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={statusTone(match.status)}>{displayEnumLabel(match.status)}</Badge>
                  <Badge tone="neutral">Match #{match.match_number}</Badge>
                </div>
                <h3 className="mt-3 text-base font-black text-ink">{matchEntrants(detail, match)}</h3>
                <p className="mt-1 break-all font-mono text-xs font-bold text-muted">{match.id}</p>
              </div>
              {match.match_room_id ? (
                <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href={`/matches/${match.match_room_id}`} pendingLabel="Opening room...">
                  Open room
                </PendingLink>
              ) : <span className="text-sm font-bold text-muted">Room not linked</span>}
            </article>
          )) : <EmptyState description="Tournament match cards will appear after brackets, groups, or rounds are created." title="No match cards yet" />}
        </div>
      </Panel>
    </section>
  );
}
