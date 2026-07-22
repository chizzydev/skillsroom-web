"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { Badge } from "@/components/ui/Badge";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { formatMinorMoney } from "@/lib/display-format";
import type {
  AdminWalletDashboard,
  SuspiciousWalletTopupGroup,
  WalletFinancialTimelineItem,
  WalletHold,
  WalletPayoutRequest,
  WalletTopup
} from "@/lib/match-room-api";

export type AdminWalletSnapshot = {
  topups: WalletTopup[];
  payout_requests: WalletPayoutRequest[];
  dashboard: AdminWalletDashboard | null;
  loaded_at: string;
};

function countStatus(rows: WalletTopup[], status: WalletTopup["status"]) {
  return rows.filter((row) => row.status === status).length.toString();
}

function totalAmount(rows: Array<{ amount_minor: number }>) {
  return rows.reduce((sum, row) => sum + row.amount_minor, 0);
}

function duplicateLabel(row: SuspiciousWalletTopupGroup) {
  return row.duplicate_type === "proof_url" ? "Same proof file" : "Same transfer reference";
}

function timelineAmount(row: WalletFinancialTimelineItem) {
  return row.currency ? formatMinorMoney(row.currency, row.amount_minor) : "No amount";
}

function timelineRows(dashboard: AdminWalletDashboard | null) {
  return dashboard ? [...dashboard.room_financial_timeline, ...dashboard.tournament_financial_timeline] : [];
}

async function fetchAdminWalletSnapshot(params: URLSearchParams) {
  const response = await fetch(`/api/admin/wallet/live?${params.toString()}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("ADMIN_WALLET_QUEUE_UNAVAILABLE");
  const payload = await response.json() as { ok?: boolean; data?: AdminWalletSnapshot };
  if (!payload.ok || !payload.data) throw new Error("ADMIN_WALLET_QUEUE_UNAVAILABLE");
  return payload.data;
}

function TopupCard({ topup }: { topup: WalletTopup }) {
  return (
    <article className="rounded-md border border-line bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">Submitted</Badge>
            <span className="font-mono text-xs font-bold text-dim">{new Date(topup.submitted_at).toLocaleString("en-NG")}</span>
          </div>
          <h2 className="mt-3 text-lg font-black text-ink">{formatMinorMoney(topup.currency, topup.amount_minor)}</h2>
          <p className="mt-1 break-all font-mono text-xs font-bold text-muted">Player {topup.user_id}</p>
        </div>
        <div className="rounded-md border border-line bg-surfaceWarm p-3">
          <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Top-up ID</span>
          <strong className="mt-1 block break-all font-mono text-xs text-ink">{topup.id}</strong>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div><dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Reference</dt><dd className="mt-1 break-all font-bold text-ink">{topup.transfer_reference ?? "Not provided"}</dd></div>
        <div><dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Sender</dt><dd className="mt-1 font-bold text-ink">{topup.sender_account_name ?? "Not provided"}</dd></div>
        <div><dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Bank</dt><dd className="mt-1 font-bold text-ink">{topup.sender_bank_name ?? "Not provided"}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-3">
        <a className="inline-flex text-sm font-black text-cyan hover:text-action" href={topup.proof_url} rel="noreferrer" target="_blank">Open proof</a>
        <span className="text-xs font-bold text-muted">Official account: {topup.collection_bank_name} {topup.collection_account_number}</span>
      </div>
    </article>
  );
}

function PayoutCard({ payout }: { payout: WalletPayoutRequest }) {
  return (
    <article className="rounded-md border border-line bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">Requested</Badge>
            <span className="font-mono text-xs font-bold text-dim">{new Date(payout.requested_at).toLocaleString("en-NG")}</span>
          </div>
          <h2 className="mt-3 text-lg font-black text-ink">{formatMinorMoney(payout.currency, payout.amount_minor)}</h2>
          <p className="mt-1 break-all font-mono text-xs font-bold text-muted">Player {payout.user_id}</p>
        </div>
        <div className="rounded-md border border-line bg-surfaceWarm p-3">
          <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Payout ID</span>
          <strong className="mt-1 block break-all font-mono text-xs text-ink">{payout.id}</strong>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div><dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Account name</dt><dd className="mt-1 font-bold text-ink">{payout.payout_recipient_name}</dd></div>
        <div><dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Bank</dt><dd className="mt-1 font-bold text-ink">{payout.payout_bank_name}</dd></div>
        <div><dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Account</dt><dd className="mt-1 font-bold text-ink">{payout.payout_account_number_masked}</dd></div>
      </dl>
      {payout.payout_note ? <p className="mt-3 rounded-md bg-surfaceWarm p-3 text-sm font-bold leading-6 text-ink">{payout.payout_note}</p> : null}
    </article>
  );
}

function HoldCard({ hold }: { hold: WalletHold }) {
  return (
    <article className="rounded-md border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="success">{hold.status}</Badge>
          <h2 className="mt-3 text-lg font-black text-ink">{formatMinorMoney(hold.currency, hold.amount_minor)}</h2>
        </div>
        <span className="font-mono text-xs font-bold text-dim">{new Date(hold.created_at).toLocaleString("en-NG")}</span>
      </div>
      <p className="mt-3 break-all text-sm font-bold text-ink">{hold.source_type}: {hold.source_id}</p>
      <p className="mt-1 text-sm font-bold text-muted">{hold.reason}</p>
    </article>
  );
}

export function AdminWalletLiveQueues({
  initialSnapshot,
  search
}: {
  initialSnapshot: AdminWalletSnapshot;
  search: { userId?: string; matchRoomId?: string; tournamentId?: string };
}) {
  const params = useMemo(() => {
    const next = new URLSearchParams();
    if (search.userId) next.set("user_id", search.userId);
    if (search.matchRoomId) next.set("match_room_id", search.matchRoomId);
    if (search.tournamentId) next.set("tournament_id", search.tournamentId);
    return next;
  }, [search.matchRoomId, search.tournamentId, search.userId]);

  const { data: snapshot = initialSnapshot, isFetching, isError } = useQuery({
    queryKey: [...webQueryKeys.admin, "wallet", params.toString()],
    queryFn: () => fetchAdminWalletSnapshot(params),
    initialData: initialSnapshot,
    refetchOnMount: false,
    staleTime: 6_000
  });

  const activeHolds = snapshot.dashboard?.active_holds ?? [];
  const suspiciousDuplicates = snapshot.dashboard?.suspicious_duplicates ?? [];
  const ledgerEntries = snapshot.dashboard?.recent_ledger_entries ?? [];
  const financeTimeline = timelineRows(snapshot.dashboard);

  return (
    <section className="grid gap-5">
      {isError ? <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold text-amber-800">Wallet queues could not refresh. The current queues are still available.</div> : null}

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusPanel detail={isFetching ? "Refreshing..." : "Needs bank check"} label="Submitted" tone="warning" value={countStatus(snapshot.topups, "submitted")} />
        <StatusPanel detail="Visible in this queue" label="Queue total" tone="cyan" value={formatMinorMoney("NGN", totalAmount(snapshot.topups))} />
        <StatusPanel detail="Manual bank payout" label="Cash-outs" tone="danger" value={formatMinorMoney("NGN", totalAmount(snapshot.payout_requests))} />
        <StatusPanel detail={`${activeHolds.length} active holds`} label="Locked funds" tone="success" value={formatMinorMoney("NGN", totalAmount(activeHolds))} />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="Warnings" title="Suspicious duplicates" description="Same proof files or transfer references across active top-ups should be checked before approval." />
          <div className="grid gap-3 p-4">
            {suspiciousDuplicates.length ? suspiciousDuplicates.map((row) => (
              <article className="rounded-md border border-danger/40 bg-red-50 p-4" key={`${row.duplicate_type}:${row.group_key}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><Badge tone="danger">{duplicateLabel(row)}</Badge><h2 className="mt-3 break-all text-base font-black text-ink">{row.group_key}</h2></div>
                  <strong className="text-lg font-black text-danger">{row.occurrence_count} hits</strong>
                </div>
                <p className="mt-3 text-sm font-bold text-ink">{row.user_count} user(s), {formatMinorMoney("NGN", row.amount_minor_total)} total.</p>
                <p className="mt-2 break-all font-mono text-xs font-bold text-muted">Samples: {row.sample_topup_ids.slice(0, 4).join(", ")}</p>
              </article>
            )) : <AdminEmptyState description="No repeated active proof files or transfer references were found." title="No duplicate warning" />}
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Locks" title="Active locked funds" description="These are balance-funded entries currently reserved for rooms or tournaments." />
          <div className="grid gap-3 p-4">
            {activeHolds.length ? activeHolds.map((hold) => <HoldCard hold={hold} key={hold.id} />) : <AdminEmptyState description="No active balance locks match this view." title="No active locks" />}
          </div>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="Review" title="Submitted wallet top-ups" description="Copy the top-up ID into the decision panel after checking the payment records." />
          <div className="grid gap-3 p-4">
            {snapshot.topups.length ? snapshot.topups.map((topup) => <TopupCard key={topup.id} topup={topup} />) : <AdminEmptyState description="No wallet top-ups are waiting for approval." title="Top-up queue is clear" />}
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Cash-out" title="Requested wallet payouts" description="Pay the bank account manually, then mark the request paid with the transfer reference." />
          <div className="grid gap-3 p-4">
            {snapshot.payout_requests.length ? snapshot.payout_requests.map((payout) => <PayoutCard key={payout.id} payout={payout} />) : <AdminEmptyState description="No wallet cash-outs are waiting for payment." title="Payout queue is clear" />}
          </div>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="History" title="User wallet history" description={search.userId ? "Showing recent wallet changes for the selected user." : "Add a user ID above to narrow this to one player."} />
          <div className="grid gap-3 p-4">
            {ledgerEntries.length ? ledgerEntries.map((entry) => (
              <article className="rounded-md border border-line bg-white p-4" key={entry.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><Badge tone={entry.direction === "credit" ? "success" : "warning"}>{entry.direction}</Badge><h2 className="mt-3 text-lg font-black text-ink">{formatMinorMoney(entry.currency, entry.amount_minor)}</h2></div>
                  <span className="font-mono text-xs font-bold text-dim">{new Date(entry.created_at).toLocaleString("en-NG")}</span>
                </div>
                <p className="mt-3 break-all text-sm font-bold text-ink">{entry.entry_type} / {entry.bucket}</p>
                <p className="mt-1 break-all font-mono text-xs font-bold text-muted">{entry.source_type}: {entry.source_id ?? "none"}</p>
              </article>
            )) : <AdminEmptyState description="No wallet history matches this view yet." title="No wallet history" />}
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="History" title="Room or tournament payment history" description="Load a room or tournament ID above to see funding, locked money, refunds, and payouts in order." />
          <div className="grid gap-3 p-4">
            {financeTimeline.length ? financeTimeline.map((row) => (
              <article className="rounded-md border border-line bg-white p-4" key={`${row.source_table}:${row.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><Badge tone="cyan">{row.source_table}</Badge><h2 className="mt-3 text-base font-black text-ink">{row.event_type}</h2></div>
                  <strong className="text-sm font-black text-ink">{timelineAmount(row)}</strong>
                </div>
                <p className="mt-3 text-sm font-bold text-muted">{row.status ?? "recorded"} {row.detail ? `- ${row.detail}` : ""}</p>
                <p className="mt-1 break-all font-mono text-xs font-bold text-dim">{row.user_id ?? "platform"} / {new Date(row.created_at).toLocaleString("en-NG")}</p>
              </article>
            )) : <AdminEmptyState description="No room or tournament payment history is loaded." title="Load payment history" />}
          </div>
        </Panel>
      </div>
    </section>
  );
}
