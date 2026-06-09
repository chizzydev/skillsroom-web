import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStepUpPanel } from "@/components/admin/AdminStepUpPanel";
import { AdminShell } from "@/components/layout/AdminShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth-bridge";
import {
  formatEntryAmount,
  listPayouts,
  listRefunds,
  listSettlements,
  type MatchPayout,
  type MatchRefund,
  type MatchSettlement
} from "@/lib/match-room-api";
import {
  completePayoutAction,
  completeRefundAction,
  reserveRefundsAction,
  reserveSettlementAction
} from "./actions";

function money(currency: string, amountMinor: number) {
  return formatEntryAmount({ currency, entry_amount_minor: amountMinor });
}

function countStatus<T extends { status: string }>(rows: T[], status: string) {
  return rows.filter((row) => row.status === status).length.toString();
}

export default async function AdminSettlementsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user) || !["admin", "owner"].includes(user.role)) redirect("/sign-in?redirect=/admin/settlements");
  const { error } = await searchParams;

  let settlements: MatchSettlement[] = [];
  let payouts: MatchPayout[] = [];
  let refunds: MatchRefund[] = [];
  let loadError: string | null = null;
  try {
    const [settlementResult, payoutResult, refundResult] = await Promise.all([
      listSettlements("payout_pending"),
      listPayouts("queued"),
      listRefunds("queued")
    ]);
    settlements = settlementResult.settlements;
    payouts = payoutResult.payouts;
    refunds = refundResult.refunds;
  } catch {
    loadError = "Unable to load settlement queues.";
  }

  return (
    <AdminShell active="settlements">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Reserve commissions, queue winner payouts, complete manual bank transfers, and refund voided or disputed rooms."
          eyebrow="Settlement Ops"
          title="Payouts and Refunds"
          tone="success"
        />

        <LiveUpdateStream eventTypePrefixes={["admin.queue.settlements.", "admin.queue.refunds.", "admin.queue.tournament_settlements.", "admin.queue.tournament_refunds.", "match.settlement.", "match.payout.", "match.refund.", "tournament.settlement.", "tournament.refunds."]} label="Money ops live" />

        {(error || loadError) && (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {error ?? loadError}
          </div>
        )}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Reserved" label="Settlements" tone="success" value={countStatus(settlements, "payout_pending")} />
          <StatusPanel detail="Manual transfer" label="Payout Queue" tone="warning" value={countStatus(payouts, "queued")} />
          <StatusPanel detail="Manual return" label="Refund Queue" tone="danger" value={countStatus(refunds, "queued")} />
          <StatusPanel detail="Step-up required" label="Money Actions" tone="cyan" value={(payouts.length + refunds.length).toString()} />
        </div>

        <AdminStepUpPanel returnTo="/admin/settlements" />

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Payouts" title="Queued winner payouts" description="Complete only after the bank transfer has actually been sent." />
            {payouts.length ? (
              <DataTable
                columns={[
                  { key: "created_at", label: "Queued", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                  { key: "user_id", label: "Winner", render: (row) => <span className="font-bold text-ink">{row.user_id}</span> },
                  { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.amount_minor)}</span> },
                  { key: "status", label: "Status", render: (row) => <Badge tone="warning">{row.status}</Badge> },
                  { key: "id", label: "Payout ID", render: (row) => <span className="font-mono text-xs text-muted">{row.id}</span> }
                ]}
                rows={payouts}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState description="No winner payout is waiting for manual transfer confirmation." title="Payout queue is clear" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Complete Payout" title="Manual payout confirmation" />
            <form action={completePayoutAction} className="grid gap-3 p-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="payout_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank payout reference
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="payout_reference" required />
              </label>
              <Button type="submit">Complete payout</Button>
            </form>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Refunds" title="Queued refunds" description="Refunds return approved entry funding when a room should not settle to a winner." />
            {refunds.length ? (
              <DataTable
                columns={[
                  { key: "created_at", label: "Queued", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                  { key: "user_id", label: "Player", render: (row) => <span className="font-bold text-ink">{row.user_id}</span> },
                  { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.amount_minor)}</span> },
                  { key: "reason", label: "Reason", render: (row) => <span className="text-muted">{row.reason}</span> },
                  { key: "id", label: "Refund ID", render: (row) => <span className="font-mono text-xs text-muted">{row.id}</span> }
                ]}
                rows={refunds}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState description="No player refund is waiting for manual return confirmation." title="Refund queue is clear" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Complete Refund" title="Manual refund confirmation" />
            <form action={completeRefundAction} className="grid gap-3 p-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Refund ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="refund_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank refund reference
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="refund_reference" required />
              </label>
              <Button type="submit" variant="secondary">Complete refund</Button>
            </form>
          </Panel>
        </div>

        <Panel>
          <PanelHeader eyebrow="Reserve" title="Create payout or refund queues" description="Settlement reservation consumes admin-approved result claims. Refund reservation consumes approved funding." />
          <div className="grid gap-6 p-4 xl:grid-cols-2">
            <form action={reserveSettlementAction} className="grid gap-3">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Match room ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="match_room_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Notes
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="notes" />
              </label>
              <Button type="submit">Reserve settlement</Button>
            </form>

            <form action={reserveRefundsAction} className="grid gap-3">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Match room ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="match_room_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Refund reason
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="reason" required />
              </label>
              <Button type="submit" variant="danger">Reserve refunds</Button>
            </form>
          </div>
        </Panel>
      </section>
    </AdminShell>
  );
}
