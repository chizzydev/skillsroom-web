"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { Badge } from "@/components/ui/Badge";
import { CopyTextButton } from "@/components/ui/CopyTextButton";
import { DataTable } from "@/components/ui/DataTable";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { formatEntryAmount } from "@/lib/display-format";
import type { MatchPayout, MatchRefund, MatchSettlement, TournamentPayout, TournamentRefund, TournamentSettlement } from "@/lib/match-room-api";

export type AdminSettlementsSnapshot = {
  settlements: MatchSettlement[];
  payouts: MatchPayout[];
  refunds: MatchRefund[];
  tournament_settlements: TournamentSettlement[];
  tournament_payouts: TournamentPayout[];
  tournament_refunds: TournamentRefund[];
  loaded_at: string;
};

function money(currency: string, amountMinor: number) {
  return formatEntryAmount({ currency, entry_amount_minor: amountMinor });
}

function playerLabel(row: {
  display_name?: string | null;
  username?: string | null;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
  user_id: string;
}) {
  return row.display_name || row.username || row.primary_game_handle || row.primary_game_external_uid || row.user_id;
}

function tournamentWinnerLabel(row: TournamentPayout) {
  return row.entry_display_name || row.display_name || row.username || row.primary_game_handle || row.primary_game_external_uid || row.user_id;
}

function tournamentRefundLabel(row: TournamentRefund) {
  return row.entry_display_name || row.display_name || row.username || row.primary_game_handle || row.primary_game_external_uid || row.user_id;
}

function IdentifierLabel({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[11px] font-black uppercase tracking-[0.12em] text-dim">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-muted [overflow-wrap:anywhere]">{value}</span>
        <CopyTextButton label={label} value={value} />
      </div>
    </div>
  );
}

function RoomIdentity({ roomCode, matchRoomId }: { roomCode?: string | null; matchRoomId?: string | null }) {
  return (
    <div className="grid gap-1">
      {roomCode ? <span className="font-mono text-xs font-bold text-muted">{roomCode}</span> : null}
      <IdentifierLabel label="Match room ID" value={matchRoomId} />
    </div>
  );
}

function Instructions({
  recipient,
  bank,
  account
}: {
  recipient?: string | null;
  bank?: string | null;
  account?: string | null;
}) {
  return (
    <div className="grid gap-1 text-xs text-muted">
      <span className="font-bold text-ink">{recipient || "Instructions missing"}</span>
      <span>{bank || "Bank not set"}</span>
      <span className="font-mono">{account || "No account number"}</span>
    </div>
  );
}

async function fetchSettlementsSnapshot() {
  const response = await fetch("/api/admin/settlements/live", {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("PAYMENT_QUEUES_UNAVAILABLE");
  const payload = await response.json() as { ok?: boolean; data?: AdminSettlementsSnapshot };
  if (!payload.ok || !payload.data) throw new Error("PAYMENT_QUEUES_UNAVAILABLE");
  return payload.data;
}

export function AdminSettlementsLiveQueues({ initialSnapshot }: { initialSnapshot: AdminSettlementsSnapshot }) {
  const { data: snapshot = initialSnapshot, isFetching, isError } = useQuery({
    queryKey: [...webQueryKeys.admin, "settlements"],
    queryFn: fetchSettlementsSnapshot,
    initialData: initialSnapshot,
    refetchOnMount: false,
    staleTime: 6_000
  });

  const queuedSettlements = snapshot.settlements.filter((row) => row.status === "payout_pending");
  const queuedPayouts = snapshot.payouts.filter((row) => row.status === "queued");
  const queuedRefunds = snapshot.refunds.filter((row) => row.status === "queued");
  const queuedTournamentSettlements = snapshot.tournament_settlements.filter((row) => row.status === "payout_pending");
  const queuedTournamentPayouts = snapshot.tournament_payouts.filter((row) => row.status === "queued");
  const queuedTournamentRefunds = snapshot.tournament_refunds.filter((row) => row.status === "queued");
  const completedPayouts = snapshot.payouts.filter((row) => row.status === "completed").slice(0, 12);
  const completedRefunds = snapshot.refunds.filter((row) => row.status === "completed").slice(0, 12);
  const completedTournamentPayouts = snapshot.tournament_payouts.filter((row) => row.status === "completed").slice(0, 12);
  const completedTournamentRefunds = snapshot.tournament_refunds.filter((row) => row.status === "completed").slice(0, 12);

  return (
    <section className="grid gap-5">
      {isError ? <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold text-amber-800">Payment queues could not refresh. The current queues are still available.</div> : null}

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusPanel detail={isFetching ? "Refreshing..." : "Match + tournament"} label="Settlements" tone="success" value={(queuedSettlements.length + queuedTournamentSettlements.length).toString()} />
        <StatusPanel detail="Manual transfer" label="Payout Queue" tone="warning" value={(queuedPayouts.length + queuedTournamentPayouts.length).toString()} />
        <StatusPanel detail="Manual return" label="Refund Queue" tone="danger" value={(queuedRefunds.length + queuedTournamentRefunds.length).toString()} />
        <StatusPanel detail="Step-up required" label="Money Actions" tone="cyan" value={(queuedPayouts.length + queuedRefunds.length + queuedTournamentPayouts.length + queuedTournamentRefunds.length).toString()} />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="Payouts" title="Queued winner payouts" description="Complete only after the bank transfer has actually been sent." />
          {queuedPayouts.length ? (
            <DataTable
              columns={[
                { key: "created_at", label: "Queued", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                { key: "winner", label: "Winner", render: (row) => <div className="grid gap-1"><span className="font-bold text-ink">{playerLabel(row)}</span><RoomIdentity matchRoomId={row.match_room_id} roomCode={row.room_code} /></div> },
                { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.amount_minor)}</span> },
                { key: "instructions", label: "Instructions", render: (row) => <Instructions account={row.account_number || row.account_number_masked} bank={row.bank_name} recipient={row.recipient_name} /> },
                { key: "status", label: "Status", render: (row) => <Badge tone={row.instruction_status === "ready" ? "warning" : "danger"}>{row.instruction_status === "ready" ? row.status : "needs instructions"}</Badge> },
                { key: "id", label: "Payout ID", render: (row) => <IdentifierLabel label="Payout ID" value={row.id} /> }
              ]}
              rows={queuedPayouts}
            />
          ) : <div className="p-4"><AdminEmptyState description="No winner payout is waiting for manual transfer confirmation." title="Payout queue is clear" /></div>}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Refunds" title="Queued refunds" description="Refunds return approved entry funding when a room should not settle to a winner." />
          {queuedRefunds.length ? (
            <DataTable
              columns={[
                { key: "created_at", label: "Queued", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                { key: "user_id", label: "Player", render: (row) => <div className="grid gap-1"><span className="font-bold text-ink">{playerLabel(row)}</span><RoomIdentity matchRoomId={row.match_room_id} roomCode={row.room_code} /></div> },
                { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.amount_minor)}</span> },
                { key: "instructions", label: "Instructions", render: (row) => <Instructions account={row.account_number || row.account_number_masked} bank={row.bank_name} recipient={row.recipient_name} /> },
                { key: "reason", label: "Reason", render: (row) => <span className="text-muted">{row.reason}</span> },
                { key: "id", label: "Refund ID", render: (row) => <IdentifierLabel label="Refund ID" value={row.id} /> }
              ]}
              rows={queuedRefunds}
            />
          ) : <div className="p-4"><AdminEmptyState description="No player refund is waiting for manual return confirmation." title="Refund queue is clear" /></div>}
        </Panel>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="Tournament Payouts" title="Queued tournament winner payouts" description="Tournament prize rows use the same careful payout flow as match rooms." />
          {queuedTournamentPayouts.length ? (
            <DataTable
              columns={[
                { key: "created_at", label: "Queued", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                { key: "winner", label: "Winner", render: (row) => <div className="grid gap-1"><span className="font-bold text-ink">{tournamentWinnerLabel(row)}</span><IdentifierLabel label="Tournament ID" value={row.tournament_id} /><IdentifierLabel label="Entry ID" value={row.entry_id} /></div> },
                { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.amount_minor)}</span> },
                { key: "instructions", label: "Instructions", render: (row) => <Instructions account={row.account_number || row.account_number_masked} bank={row.bank_name} recipient={row.recipient_name} /> },
                { key: "status", label: "Status", render: (row) => <Badge tone={row.instruction_status === "ready" ? "warning" : "danger"}>{row.instruction_status === "ready" ? row.status : "needs instructions"}</Badge> },
                { key: "id", label: "Payout ID", render: (row) => <IdentifierLabel label="Payout ID" value={row.id} /> }
              ]}
              rows={queuedTournamentPayouts}
            />
          ) : <div className="p-4"><AdminEmptyState description="No tournament payout is waiting for manual transfer confirmation." title="Tournament payout queue is clear" /></div>}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Tournament Refunds" title="Queued tournament refunds" description="Refund tournament contributions with clear proof and review history." />
          {queuedTournamentRefunds.length ? (
            <DataTable
              columns={[
                { key: "created_at", label: "Queued", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                { key: "user_id", label: "Recipient", render: (row) => <div className="grid gap-1"><span className="font-bold text-ink">{tournamentRefundLabel(row)}</span><IdentifierLabel label="Tournament ID" value={row.tournament_id} /><IdentifierLabel label="Entry ID" value={row.entry_id} /></div> },
                { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.amount_minor)}</span> },
                { key: "instructions", label: "Instructions", render: (row) => <Instructions account={row.account_number || row.account_number_masked} bank={row.bank_name} recipient={row.recipient_name} /> },
                { key: "reason", label: "Reason", render: (row) => <span className="text-muted">{row.reason}</span> },
                { key: "id", label: "Refund ID", render: (row) => <IdentifierLabel label="Refund ID" value={row.id} /> }
              ]}
              rows={queuedTournamentRefunds}
            />
          ) : <div className="p-4"><AdminEmptyState description="No tournament refund is waiting for manual return confirmation." title="Tournament refund queue is clear" /></div>}
        </Panel>
      </div>

      <Panel>
        <PanelHeader eyebrow="Completed" title="Recent manual closes" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-line bg-white p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Completed payouts</p><p className="mt-2 text-2xl font-black text-ink">{completedPayouts.length}</p></div>
          <div className="rounded-md border border-line bg-white p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Completed refunds</p><p className="mt-2 text-2xl font-black text-ink">{completedRefunds.length}</p></div>
          <div className="rounded-md border border-line bg-white p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Tournament payouts</p><p className="mt-2 text-2xl font-black text-ink">{completedTournamentPayouts.length}</p></div>
          <div className="rounded-md border border-line bg-white p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Tournament refunds</p><p className="mt-2 text-2xl font-black text-ink">{completedTournamentRefunds.length}</p></div>
        </div>
      </Panel>
    </section>
  );
}
