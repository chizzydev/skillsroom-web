"use client";

import { useQuery } from "@tanstack/react-query";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { Badge } from "@/components/ui/Badge";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import {
  formatMinorMoney,
  type WalletLedgerEntry,
  type WalletOverview,
  type WalletPayoutRequest,
  type WalletTopup
} from "@/lib/match-room-api";

export type WalletLiveSnapshot = {
  wallet: WalletOverview | null;
  topups: WalletTopup[];
  payout_requests: WalletPayoutRequest[];
  ledger_entries: WalletLedgerEntry[];
  loaded_at: string;
};

function topupStatusTone(status: WalletTopup["status"]) {
  if (status === "approved") return "success" as const;
  if (status === "rejected") return "danger" as const;
  if (status === "submitted") return "warning" as const;
  return "neutral" as const;
}

function payoutStatusTone(status: WalletPayoutRequest["status"]) {
  if (status === "paid") return "success" as const;
  if (status === "rejected" || status === "failed") return "danger" as const;
  if (status === "requested" || status === "approved") return "warning" as const;
  return "neutral" as const;
}

function topupStatusLabel(status: WalletTopup["status"]) {
  if (status === "submitted") return "Under review";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

function payoutStatusLabel(status: WalletPayoutRequest["status"]) {
  if (status === "requested") return "Requested";
  if (status === "approved") return "Queued";
  if (status === "paid") return "Paid";
  if (status === "rejected") return "Rejected";
  if (status === "failed") return "Failed";
  return "Pending";
}

function activityLabel(entryType: string) {
  return entryType.replaceAll("_", " ");
}

async function fetchWalletSnapshot() {
  const response = await fetch("/api/wallet/live", {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("WALLET_UNAVAILABLE");
  const payload = await response.json() as { ok?: boolean; data?: WalletLiveSnapshot };
  if (!payload.ok || !payload.data) throw new Error("WALLET_UNAVAILABLE");
  return payload.data;
}

export function WalletLiveIsland({ initialSnapshot, showActivity }: { initialSnapshot: WalletLiveSnapshot; showActivity: boolean }) {
  const { data: snapshot = initialSnapshot, isFetching, isError } = useQuery({
    queryKey: webQueryKeys.wallet,
    queryFn: fetchWalletSnapshot,
    initialData: initialSnapshot,
    refetchOnMount: false,
    staleTime: 8_000
  });

  const account = snapshot.wallet?.account;
  const currency = account?.currency ?? "NGN";
  const pendingTopups = snapshot.wallet?.pending_topups?.pending_amount_minor ?? 0;

  return (
    <section className="grid gap-5">
      {isError ? (
        <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Wallet could not refresh. Your current wallet view is still available.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusPanel detail={isFetching ? "Refreshing..." : "Ready to use later"} label="Available" tone="success" value={formatMinorMoney(currency, account?.available_balance_minor ?? 0)} />
        <StatusPanel detail="Reserved for active play" label="Locked" tone="warning" value={formatMinorMoney(currency, account?.locked_balance_minor ?? 0)} />
        <StatusPanel detail="Won but not paid out" label="Winnings" tone="cyan" value={formatMinorMoney(currency, account?.winnings_balance_minor ?? 0)} />
        <StatusPanel detail="Waiting for admin review" label="Pending top-ups" tone="danger" value={formatMinorMoney(currency, pendingTopups)} />
      </div>

      {showActivity ? (
        <Panel className="h-fit xl:sticky xl:top-24">
          <PanelHeader eyebrow="History" title="Recent wallet activity" description="Top-ups, payouts, and balance changes refresh automatically while you are signed in." />
          <div className="grid gap-3 p-4">
            {snapshot.payout_requests.length ? (
              <div className="grid gap-3">
                <h2 className="font-mono text-xs font-black uppercase tracking-[0.16em] text-cyan">Payout requests</h2>
                {snapshot.payout_requests.map((payout) => (
                  <article className="rounded-md border border-line bg-white p-4" key={payout.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge tone={payoutStatusTone(payout.status)}>{payoutStatusLabel(payout.status)}</Badge>
                        <h3 className="mt-3 text-lg font-black text-ink">{formatMinorMoney(payout.currency, payout.amount_minor)}</h3>
                      </div>
                      <span className="font-mono text-[0.68rem] font-bold text-dim">{new Date(payout.requested_at ?? payout.created_at).toLocaleString("en-NG")}</span>
                    </div>
                    <p className="mt-3 text-sm font-bold text-ink">
                      {payout.payout_bank_name} {payout.payout_account_number_masked}
                    </p>
                    {payout.payment_reference ? <p className="mt-2 break-all text-xs font-bold text-muted">Payment reference: {payout.payment_reference}</p> : null}
                    {payout.review_note ? <p className="mt-2 rounded-md bg-surfaceWarm p-3 text-sm font-bold leading-6 text-ink">{payout.review_note}</p> : null}
                  </article>
                ))}
              </div>
            ) : null}

            {snapshot.topups.length ? (
              <div className="grid gap-3">
                <h2 className="font-mono text-xs font-black uppercase tracking-[0.16em] text-cyan">Top-ups</h2>
                {snapshot.topups.map((topup) => (
                  <article className="rounded-md border border-line bg-white p-4" key={topup.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge tone={topupStatusTone(topup.status)}>{topupStatusLabel(topup.status)}</Badge>
                        <h3 className="mt-3 text-lg font-black text-ink">{formatMinorMoney(topup.currency, topup.amount_minor)}</h3>
                      </div>
                      <span className="font-mono text-[0.68rem] font-bold text-dim">{new Date(topup.submitted_at).toLocaleString("en-NG")}</span>
                    </div>
                    <p className="mt-3 break-all text-xs font-bold text-muted">Reference: {topup.transfer_reference ?? "Not provided"}</p>
                    {topup.review_note ? <p className="mt-2 rounded-md bg-surfaceWarm p-3 text-sm font-bold leading-6 text-ink">{topup.review_note}</p> : null}
                  </article>
                ))}
              </div>
            ) : null}

            {snapshot.ledger_entries.length ? (
              <div className="grid gap-3">
                <h2 className="font-mono text-xs font-black uppercase tracking-[0.16em] text-cyan">Balance changes</h2>
                {snapshot.ledger_entries.map((entry) => (
                  <article className="rounded-md border border-line bg-white p-4" key={entry.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge tone={entry.direction === "credit" ? "success" : "warning"}>{entry.direction === "credit" ? "Added" : "Used"}</Badge>
                        <h3 className="mt-3 text-lg font-black text-ink">{formatMinorMoney(entry.currency, entry.amount_minor)}</h3>
                      </div>
                      <span className="font-mono text-[0.68rem] font-bold text-dim">{new Date(entry.created_at).toLocaleString("en-NG")}</span>
                    </div>
                    <p className="mt-3 text-xs font-bold text-muted">{activityLabel(entry.entry_type)}</p>
                  </article>
                ))}
              </div>
            ) : !snapshot.payout_requests.length && !snapshot.topups.length ? (
              <div className="rounded-md border border-dashed border-line bg-white p-5 text-sm font-bold leading-6 text-muted">
                No wallet activity yet. Your first top-up or payout request will appear here.
              </div>
            ) : null}
          </div>
        </Panel>
      ) : null}
    </section>
  );
}
