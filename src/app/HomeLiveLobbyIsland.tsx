"use client";

import { useQuery } from "@tanstack/react-query";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { displayEnumLabel, formatEntryAmount, formatMinorMoney, matchStatusLabel } from "@/lib/display-format";
import type { MatchRoomStatus, PlayerHomeRoomPreview, PlayerHomeSummary, Tournament } from "@/lib/match-room-api";

function statusTone(status: MatchRoomStatus) {
  if (status === "open") return "cyan" as const;
  if (["awaiting_funding", "funding_review", "funded"].includes(status)) return "warning" as const;
  if (["under_review", "disputed"].includes(status)) return "danger" as const;
  if (["active", "awaiting_results", "settlement_pending"].includes(status)) return "success" as const;
  return "cyan" as const;
}

function playerRoomStatusLabel(status: MatchRoomStatus) {
  const labels: Partial<Record<MatchRoomStatus, string>> = {
    draft: "Draft",
    open: "Open",
    awaiting_funding: "Waiting for payment",
    funding_review: "Payment under review",
    funded: "Ready to start",
    active: "In play",
    awaiting_results: "Result needed",
    under_review: "Result under review",
    disputed: "Dispute open",
    settlement_pending: "Prize review ready",
    completed: "Completed",
    cancelled: "Cancelled",
    refunded: "Refunded",
    voided: "Voided"
  };

  return labels[status] ?? matchStatusLabel(status);
}

function compactDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Date not set";
}

function projectedTournamentPrize(tournament: Tournament) {
  return Math.max(
    tournament.approved_prize_contribution_minor ?? 0,
    tournament.sponsored_prize_pool_minor + tournament.guaranteed_prize_pool_minor
  );
}

function HomeRoomCard({ room, actionLabel = "Open room" }: { room: PlayerHomeRoomPreview; actionLabel?: string }) {
  const playerCount = room.participant_count ?? 0;
  return (
    <article className="grid gap-4 border-b border-line p-4 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(room.status)}>{playerRoomStatusLabel(room.status)}</Badge>
          <span className="rounded-md bg-surfaceHigh px-2 py-1 font-mono text-xs font-black text-ink">{room.room_code}</span>
          {room.game_name ? <Badge tone="neutral">{room.game_name}</Badge> : null}
        </div>
        <PendingLink className="mt-3 block text-base font-black text-ink hover:text-action md:text-lg" href={`/matches/${room.id}`} pendingLabel="Opening room...">
          {room.title ?? "Private match room"}
        </PendingLink>
        <div className="mt-3 grid gap-2 text-sm font-bold text-muted sm:grid-cols-3">
          <span>{formatEntryAmount(room)} entry</span>
          <span>{playerCount}/{room.max_participants} players</span>
          <span>{room.ruleset_title ?? "Rules ready"}</span>
        </div>
      </div>
      <PendingLink
        className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover"
        href={`/matches/${room.id}`}
        pendingLabel="Opening room..."
      >
        {actionLabel}
      </PendingLink>
    </article>
  );
}

function TournamentHomeCard({ tournament }: { tournament: Tournament }) {
  return (
    <article className="grid gap-4 border-b border-line p-4 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="cyan">Open tournament</Badge>
          <Badge tone="neutral">{displayEnumLabel(tournament.format)}</Badge>
          {tournament.game_name ? <Badge tone="neutral">{tournament.game_name}</Badge> : null}
        </div>
        <PendingLink className="mt-3 block text-base font-black text-ink hover:text-action md:text-lg" href={`/tournaments/${tournament.id}`} pendingLabel="Opening tournament...">
          {tournament.title}
        </PendingLink>
        <div className="mt-3 grid gap-2 text-sm font-bold text-muted sm:grid-cols-3">
          <span>{formatMinorMoney(tournament.currency, tournament.entry_fee_amount_minor)} entry</span>
          <span>{tournament.registered_entry_count}/{tournament.max_entries} entries</span>
          <span>{compactDate(tournament.starts_at)}</span>
        </div>
      </div>
      <PendingLink
        className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
        href={`/tournaments/${tournament.id}`}
        pendingLabel="Opening tournament..."
      >
        View event
      </PendingLink>
    </article>
  );
}

async function fetchHomeSummary() {
  const response = await fetch("/api/home/live", {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("HOME_SUMMARY_UNAVAILABLE");
  const payload = await response.json() as { ok?: boolean; data?: PlayerHomeSummary };
  if (!payload.ok || !payload.data) throw new Error("HOME_SUMMARY_UNAVAILABLE");
  return payload.data;
}

export function HomeLiveLobbyIsland({ initialSummary }: { initialSummary: PlayerHomeSummary }) {
  const { data: summary = initialSummary, isFetching, isError } = useQuery({
    queryKey: webQueryKeys.home,
    queryFn: fetchHomeSummary,
    initialData: initialSummary,
    refetchOnMount: false,
    staleTime: 10_000
  });

  const recommendedRooms = summary.recommended_room_previews ?? [];
  const actionRooms = summary.active_room_previews ?? [];
  const openTournaments = summary.open_tournament_previews ?? [];
  const walletMiniBalance = summary.wallet_mini_balance;
  const walletBalanceLabel = walletMiniBalance
    ? formatMinorMoney(walletMiniBalance.currency, walletMiniBalance.available_balance_minor + walletMiniBalance.winnings_balance_minor)
    : formatMinorMoney("NGN", 0);
  const playNowTotal = (summary.play_now_counts?.recommended_matches ?? recommendedRooms.length) + (summary.play_now_counts?.open_tournaments ?? openTournaments.length);
  const topOpenTournamentPrize = openTournaments.reduce((max, tournament) => Math.max(max, projectedTournamentPrize(tournament)), 0);

  return (
    <section className="grid min-w-0 gap-4" id="live-lobby">
      {isError ? (
        <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Live lobby could not refresh. Your current home view is still available.
        </div>
      ) : null}

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusPanel detail={isFetching ? "Refreshing..." : "Rooms and tournaments"} label="Play Now" tone="cyan" value={playNowTotal.toString()} />
        <StatusPanel detail="Rooms that fit your balance" label="Recommended" tone="success" value={(summary.play_now_counts?.recommended_matches ?? recommendedRooms.length).toString()} />
        <StatusPanel detail="Your rooms needing review" label="Reviews" tone={(summary.active_review_previews ?? []).length ? "danger" : "success"} value={(summary.active_review_previews ?? []).length.toString()} />
        <StatusPanel detail="Available for entry" label="Balance" tone="warning" value={walletBalanceLabel} />
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusPanel detail="Can be joined" label="Open Rooms" tone="cyan" value={(summary.play_now_counts?.open_rooms ?? (summary.open_room_previews ?? []).length).toString()} />
        <StatusPanel detail="Taking entries" label="Open Events" tone="warning" value={(summary.play_now_counts?.open_tournaments ?? openTournaments.length).toString()} />
        <StatusPanel detail="Prize pool to chase" label="Event Prize" tone="success" value={formatMinorMoney("NGN", topOpenTournamentPrize)} />
        <StatusPanel detail="Messages and updates" label="Unread" tone="danger" value={(summary.unread_notification_count ?? 0).toString()} />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-3">
        <Panel>
          <PanelHeader eyebrow="Play Now" title="Recommended matches" description="Rooms here are open and fit your current balance." />
          {recommendedRooms.length ? (
            <div>{recommendedRooms.slice(0, 4).map((room) => <HomeRoomCard actionLabel="Join room" key={room.id} room={room} />)}</div>
          ) : (
            <div className="p-4">
              <EmptyState description="Add funds, finish your profile, or create a challenge and share the room code." title="No recommended rooms yet" />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Your Action" title="Rooms needing you" description="Rooms waiting for payment, play, proof, result, or review." />
          {actionRooms.length ? (
            <div>{actionRooms.slice(0, 4).map((room) => <HomeRoomCard key={room.id} room={room} />)}</div>
          ) : (
            <div className="p-4">
              <EmptyState description="You are clear. Join an open room or create a new challenge." title="No room needs you right now" tone="cyan" />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Events" title="Open tournaments" description="Events taking entries right now." />
          {openTournaments.length ? (
            <div>{openTournaments.slice(0, 4).map((tournament) => <TournamentHomeCard key={tournament.id} tournament={tournament} />)}</div>
          ) : (
            <div className="p-4">
              <EmptyState description="Check the community page for recent winners and upcoming news." title="No open tournaments right now" />
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}
