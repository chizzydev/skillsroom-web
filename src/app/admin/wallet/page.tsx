import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStepUpPanel } from "@/components/admin/AdminStepUpPanel";
import { AdminShell } from "@/components/layout/AdminShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge } from "@/components/ui/Badge";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { adminErrorMessageFromQuery } from "@/lib/admin-action-errors";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import {
  formatMinorMoney,
  getAdminWalletDashboard,
  listWalletPayoutRequests,
  listWalletTopups,
  type AdminWalletDashboard,
  type SuspiciousWalletTopupGroup,
  type WalletFinancialTimelineItem,
  type WalletHold,
  type WalletPayoutRequest,
  type WalletTopup
} from "@/lib/match-room-api";
import { reviewWalletPayoutAction, reviewWalletTopupAction } from "./actions";
import { AdminWalletLiveQueues, type AdminWalletSnapshot } from "./AdminWalletLiveQueues";

export const dynamic = "force-dynamic";

function countStatus(rows: WalletTopup[], status: WalletTopup["status"]) {
  return rows.filter((row) => row.status === status).length.toString();
}

function totalAmount(rows: WalletTopup[]) {
  return rows.reduce((sum, row) => sum + row.amount_minor, 0);
}

function totalPayoutAmount(rows: WalletPayoutRequest[]) {
  return rows.reduce((sum, row) => sum + row.amount_minor, 0);
}

function totalHoldAmount(rows: WalletHold[]) {
  return rows.reduce((sum, row) => sum + row.amount_minor, 0);
}

function duplicateLabel(row: SuspiciousWalletTopupGroup) {
  return row.duplicate_type === "proof_url" ? "Same proof file" : "Same transfer reference";
}

function timelineAmount(row: WalletFinancialTimelineItem) {
  return row.currency ? formatMinorMoney(row.currency, row.amount_minor) : "No amount";
}

function timelineRows(dashboard: AdminWalletDashboard) {
  return [...dashboard.room_financial_timeline, ...dashboard.tournament_financial_timeline];
}

export default async function AdminWalletPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; user_id?: string; match_room_id?: string; tournament_id?: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/wallet");
  if (!canUseAdminSection(user, "wallet")) redirect("/admin");
  const { error, success, user_id: userId, match_room_id: matchRoomId, tournament_id: tournamentId } = await searchParams;

  let topups: WalletTopup[] = [];
  let payoutRequests: WalletPayoutRequest[] = [];
  let dashboard: AdminWalletDashboard | null = null;
  let loadError: string | null = null;
  try {
    const [topupResult, payoutResult, dashboardResult] = await Promise.all([
      listWalletTopups("submitted"),
      listWalletPayoutRequests("requested"),
      getAdminWalletDashboard({ userId, matchRoomId, tournamentId, limit: 100 })
    ]);
    topups = topupResult.topups;
    payoutRequests = payoutResult.payout_requests;
    dashboard = dashboardResult;
  } catch {
    loadError = "Unable to load wallet queues.";
  }

  const activeHolds = dashboard?.active_holds ?? [];
  const suspiciousDuplicates = dashboard?.suspicious_duplicates ?? [];
  const ledgerEntries = dashboard?.recent_ledger_entries ?? [];
  const financeTimeline = dashboard ? timelineRows(dashboard) : [];
  const walletSnapshot: AdminWalletSnapshot = {
    topups,
    payout_requests: payoutRequests,
    dashboard,
    loaded_at: new Date().toISOString()
  };

  return (
    <AdminShell active="wallet">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Approve only after matching the bank alert, sender details, amount, and proof. Approval credits the user's spendable balance."
          eyebrow="Wallet"
          title="Wallet review"
          tone="cyan"
        />

        <LiveUpdateStream eventTypePrefixes={["admin.queue.wallet.", "wallet.", "admin.wallet."]} label="Wallet updates" />

        {error ? <TransientStatusBanner clearKeys={["error"]} durationMs={12000} message={adminErrorMessageFromQuery(error)} /> : null}
        {success ? <TransientStatusBanner clearKeys={["success"]} durationMs={12000} message={success} tone="success" /> : null}
        {loadError ? <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div> : null}

        <div className="hidden min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Needs bank check" label="Submitted" tone="warning" value={countStatus(topups, "submitted")} />
          <StatusPanel detail="Visible in this queue" label="Queue total" tone="cyan" value={formatMinorMoney("NGN", totalAmount(topups))} />
          <StatusPanel detail="Manual bank payout" label="Cash-outs" tone="danger" value={formatMinorMoney("NGN", totalPayoutAmount(payoutRequests))} />
          <StatusPanel detail={`${activeHolds.length} active locks`} label="Locked funds" tone="success" value={formatMinorMoney("NGN", totalHoldAmount(activeHolds))} />
        </div>

        <Panel>
          <PanelHeader
            eyebrow="Search"
            title="Find a user, room, or tournament payment history"
            description="This is read-only. It helps you see what happened without changing anyone's money."
          />
          <form className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" defaultValue={userId ?? ""} name="user_id" placeholder="User ID for wallet history" />
            <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" defaultValue={matchRoomId ?? ""} name="match_room_id" placeholder="Match room ID" />
            <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" defaultValue={tournamentId ?? ""} name="tournament_id" placeholder="Tournament ID" />
            <button className="min-h-11 rounded-md bg-navy-900 px-4 text-sm font-black text-white transition hover:bg-ink" type="submit">
              Load history
            </button>
          </form>
        </Panel>

        <AdminWalletLiveQueues
          initialSnapshot={walletSnapshot}
          search={{ userId, matchRoomId, tournamentId }}
        />

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="hidden xl:block" />
          <div className="grid h-fit gap-4 xl:sticky xl:top-24">
            <AdminStepUpPanel returnTo="/admin/wallet" />
            <Panel>
              <PanelHeader eyebrow="Decision" title="Approve or reject top-up" description="Approval records the payment and credits the player's spendable balance. Rejection leaves the balance unchanged." />
              <form action={reviewWalletTopupAction} className="grid gap-3 p-4">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Top-up ID
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="topup_id" required />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Review note
                  <textarea className="min-h-28 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" placeholder="Required for rejection. Helpful for approvals too." />
                </label>
                <div className="grid gap-2">
                  <FormActionButton idleLabel="Approve and credit wallet" name="decision" pendingLabel="Crediting wallet..." value="approve" />
                  <FormActionButton idleLabel="Reject top-up" name="decision" pendingLabel="Rejecting top-up..." value="reject" variant="danger" />
                </div>
              </form>
            </Panel>
            <Panel>
              <PanelHeader eyebrow="Payout" title="Mark payout paid" description="This confirms the manual bank payment is done. Rejection returns the reserved winnings." />
              <form action={reviewWalletPayoutAction} className="grid gap-3 p-4">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Payout request ID
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="payout_request_id" required />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Bank transfer reference
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="payment_reference" placeholder="Required when marking paid" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Review note
                  <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" placeholder="Required for rejection. Optional for paid payout." />
                </label>
                <div className="grid gap-2">
                  <FormActionButton idleLabel="Mark payout paid" name="decision" pendingLabel="Marking paid..." value="mark_paid" />
                  <FormActionButton idleLabel="Reject and return winnings" name="decision" pendingLabel="Rejecting payout..." value="reject" variant="danger" />
                </div>
              </form>
            </Panel>
          </div>
        </div>

        <div className="hidden min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid min-w-0 gap-6">
            <Panel>
              <PanelHeader eyebrow="Warnings" title="Suspicious duplicates" description="Same proof files or transfer references across active top-ups should be checked before approval." />
              <div className="grid gap-3 p-4">
                {suspiciousDuplicates.length ? (
                  suspiciousDuplicates.map((row) => (
                    <article className="rounded-md border border-danger/40 bg-red-50 p-4" key={`${row.duplicate_type}:${row.group_key}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Badge tone="danger">{duplicateLabel(row)}</Badge>
                          <h2 className="mt-3 break-all text-base font-black text-ink">{row.group_key}</h2>
                        </div>
                        <strong className="text-lg font-black text-danger">{row.occurrence_count} hits</strong>
                      </div>
                      <p className="mt-3 text-sm font-bold text-ink">
                        {row.user_count} user(s), {formatMinorMoney("NGN", row.amount_minor_total)} total.
                      </p>
                      <p className="mt-2 break-all font-mono text-xs font-bold text-muted">Samples: {row.sample_topup_ids.slice(0, 4).join(", ")}</p>
                    </article>
                  ))
                ) : (
                  <AdminEmptyState description="No repeated active proof files or transfer references were found." title="No duplicate warning" />
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Locks" title="Active locked funds" description="These are balance-funded entries currently reserved for rooms or tournaments." />
              <div className="grid gap-3 p-4">
                {activeHolds.length ? (
                  activeHolds.map((hold) => (
                    <article className="rounded-md border border-line bg-white p-4" key={hold.id}>
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
                  ))
                ) : (
                  <AdminEmptyState description="No active balance locks match this view." title="No active locks" />
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Review" title="Submitted wallet top-ups" description="Copy the top-up ID into the decision panel after checking the payment records." />
              <div className="grid gap-3 p-4">
                {topups.length ? (
                  topups.map((topup) => (
                  <article className="rounded-md border border-line bg-white p-4" key={topup.id}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="warning">{topup.status}</Badge>
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
                      <div>
                        <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Reference</dt>
                        <dd className="mt-1 break-all font-bold text-ink">{topup.transfer_reference ?? "Not provided"}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Sender</dt>
                        <dd className="mt-1 font-bold text-ink">{topup.sender_account_name ?? "Not provided"}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Bank</dt>
                        <dd className="mt-1 font-bold text-ink">{topup.sender_bank_name ?? "Not provided"}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <a className="inline-flex text-sm font-black text-cyan hover:text-action" href={topup.proof_url} rel="noreferrer" target="_blank">
                        Open proof
                      </a>
                      <span className="text-xs font-bold text-muted">
                        Official account: {topup.collection_bank_name} {topup.collection_account_number}
                      </span>
                    </div>
                  </article>
                  ))
                ) : (
                  <AdminEmptyState description="No wallet top-ups are waiting for approval." title="Top-up queue is clear" />
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Cash-out" title="Requested wallet payouts" description="Pay the bank account manually, then mark the request paid with the transfer reference." />
              <div className="grid gap-3 p-4">
                {payoutRequests.length ? (
                  payoutRequests.map((payout) => (
                    <article className="rounded-md border border-line bg-white p-4" key={payout.id}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="warning">{payout.status}</Badge>
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
                        <div>
                          <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Account name</dt>
                          <dd className="mt-1 font-bold text-ink">{payout.payout_recipient_name}</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Bank</dt>
                          <dd className="mt-1 font-bold text-ink">{payout.payout_bank_name}</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Account</dt>
                          <dd className="mt-1 font-bold text-ink">{payout.payout_account_number_masked}</dd>
                        </div>
                      </dl>
                      {payout.payout_note ? <p className="mt-3 rounded-md bg-surfaceWarm p-3 text-sm font-bold leading-6 text-ink">{payout.payout_note}</p> : null}
                    </article>
                  ))
                ) : (
                  <AdminEmptyState description="No wallet cash-outs are waiting for payment." title="Payout queue is clear" />
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="History" title="User wallet history" description={userId ? "Showing recent wallet changes for the selected user." : "Add a user ID above to narrow this to one player."} />
              <div className="grid gap-3 p-4">
                {ledgerEntries.length ? (
                  ledgerEntries.map((entry) => (
                    <article className="rounded-md border border-line bg-white p-4" key={entry.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Badge tone={entry.direction === "credit" ? "success" : "warning"}>{entry.direction}</Badge>
                          <h2 className="mt-3 text-lg font-black text-ink">{formatMinorMoney(entry.currency, entry.amount_minor)}</h2>
                        </div>
                        <span className="font-mono text-xs font-bold text-dim">{new Date(entry.created_at).toLocaleString("en-NG")}</span>
                      </div>
                      <p className="mt-3 break-all text-sm font-bold text-ink">{entry.entry_type} / {entry.bucket}</p>
                      <p className="mt-1 break-all font-mono text-xs font-bold text-muted">{entry.source_type}: {entry.source_id ?? "none"}</p>
                    </article>
                  ))
                ) : (
                  <AdminEmptyState description="No wallet history matches this view yet." title="No wallet history" />
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="History" title="Room or tournament payment history" description="Load a room or tournament ID above to see funding, locked money, refunds, and payouts in order." />
              <div className="grid gap-3 p-4">
                {financeTimeline.length ? (
                  financeTimeline.map((row) => (
                    <article className="rounded-md border border-line bg-white p-4" key={`${row.source_table}:${row.id}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Badge tone="cyan">{row.source_table}</Badge>
                          <h2 className="mt-3 text-base font-black text-ink">{row.event_type}</h2>
                        </div>
                        <strong className="text-sm font-black text-ink">{timelineAmount(row)}</strong>
                      </div>
                      <p className="mt-3 text-sm font-bold text-muted">{row.status ?? "recorded"} {row.detail ? `- ${row.detail}` : ""}</p>
                      <p className="mt-1 break-all font-mono text-xs font-bold text-dim">{row.user_id ?? "platform"} / {new Date(row.created_at).toLocaleString("en-NG")}</p>
                    </article>
                  ))
                ) : (
                  <AdminEmptyState description="No room or tournament payment history is loaded." title="Load payment history" />
                )}
              </div>
            </Panel>
          </div>

          <div className="grid h-fit gap-4 xl:sticky xl:top-24">
            <AdminStepUpPanel returnTo="/admin/wallet" />
            <Panel>
              <PanelHeader eyebrow="Decision" title="Approve or reject top-up" description="Approval writes wallet ledger entries. Rejection leaves the balance unchanged." />
              <form action={reviewWalletTopupAction} className="grid gap-3 p-4">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Top-up ID
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="topup_id" required />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Review note
                  <textarea className="min-h-28 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" placeholder="Required for rejection. Helpful for approvals too." />
                </label>
                <div className="grid gap-2">
                  <FormActionButton idleLabel="Approve and credit wallet" name="decision" pendingLabel="Crediting wallet..." value="approve" />
                  <FormActionButton idleLabel="Reject top-up" name="decision" pendingLabel="Rejecting top-up..." value="reject" variant="danger" />
                </div>
              </form>
            </Panel>
            <Panel>
              <PanelHeader eyebrow="Payout" title="Mark payout paid" description="This does not credit the user again. It only confirms the manual bank payment is done." />
              <form action={reviewWalletPayoutAction} className="grid gap-3 p-4">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Payout request ID
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="payout_request_id" required />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Bank transfer reference
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="payment_reference" placeholder="Required when marking paid" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Review note
                  <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" placeholder="Required for rejection. Optional for paid payout." />
                </label>
                <div className="grid gap-2">
                  <FormActionButton idleLabel="Mark payout paid" name="decision" pendingLabel="Marking paid..." value="mark_paid" />
                  <FormActionButton idleLabel="Reject and return winnings" name="decision" pendingLabel="Rejecting payout..." value="reject" variant="danger" />
                </div>
              </form>
            </Panel>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
