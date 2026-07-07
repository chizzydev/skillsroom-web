import { redirect } from "next/navigation";
import { ManualPaymentPanel } from "@/components/payments/ManualPaymentPanel";
import { MotionSection, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth-bridge";
import { formatMinorMoney, getWalletOverview, type WalletPayoutRequest, type WalletTopup } from "@/lib/match-room-api";
import { requestWalletPayoutAction, submitWalletTopupAction } from "./actions";

export const dynamic = "force-dynamic";

function statusTone(status: WalletTopup["status"]) {
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

function pendingTotal(topups: WalletTopup[]) {
  return topups
    .filter((topup) => topup.status === "submitted")
    .reduce((sum, topup) => sum + topup.amount_minor, 0);
}

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/wallet");
  const { error, success } = await searchParams;

  let wallet = null as Awaited<ReturnType<typeof getWalletOverview>> | null;
  let loadError: string | null = null;
  try {
    wallet = await getWalletOverview();
  } catch {
    loadError = "Unable to load your wallet right now. Please try again.";
  }

  const account = wallet?.account;
  const topups = wallet?.topups ?? [];
  const payouts = wallet?.payout_requests ?? [];
  const currency = account?.currency ?? "NGN";

  return (
    <AppShell active="wallet">
      <MotionSection className="grid gap-5" variant="page">
        <MotionSection className="motion-atmosphere motion-state-card overflow-hidden rounded-[1.6rem] border border-line bg-navy-900 p-5 text-white shadow-[0_24px_70px_rgba(3,10,20,0.22)] sm:p-7" variant="hero">
          <p className="inline-flex rounded-full bg-cyanSoft px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.16em] text-cyan">Skillsroom Balance</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">Fund once. Join more rooms faster.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
            Add money to your Skillsroom balance, wait for review, then use approved funds when wallet entry opens for rooms and tournaments.
          </p>
        </MotionSection>

        {error ? <TransientStatusBanner clearKeys={["error"]} durationMs={12000} message={error} /> : null}
        {success ? <TransientStatusBanner clearKeys={["success"]} durationMs={12000} message={success} tone="success" /> : null}
        {loadError ? <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal staggerIndex={0}><StatusPanel detail="Ready to use later" label="Available" tone="success" value={formatMinorMoney(currency, account?.available_balance_minor ?? 0)} /></Reveal>
          <Reveal className="motion-wallet-lock" staggerIndex={1}><StatusPanel detail="Reserved for active play" label="Locked" tone="warning" value={formatMinorMoney(currency, account?.locked_balance_minor ?? 0)} /></Reveal>
          <Reveal staggerIndex={2}><StatusPanel detail="Won but not paid out" label="Winnings" tone="cyan" value={formatMinorMoney(currency, account?.winnings_balance_minor ?? 0)} /></Reveal>
          <Reveal staggerIndex={3}><StatusPanel detail="Waiting for admin review" label="Pending top-ups" tone="danger" value={formatMinorMoney(currency, pendingTotal(topups))} /></Reveal>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Reveal>
          <Panel>
            <PanelHeader
              eyebrow="Fund my balance"
              title="Send payment, then upload proof"
              description="Pending top-ups are not spendable. Your balance changes only after an operator approves the proof."
            />
            <div className="grid gap-4 p-4 sm:p-5">
              <ManualPaymentPanel referenceHint="Use your username, email, or WALLET in the transfer narration if your bank app allows it." />
              <form action={submitWalletTopupAction} className="motion-flow-card grid gap-3 rounded-lg border border-line bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Amount sent (NGN)
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" inputMode="decimal" min="100" name="amount_naira" placeholder="5000" required type="number" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Transfer reference
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="transfer_reference" placeholder="Receipt or narration reference" />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Sender account name
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="sender_account_name" placeholder="Name on your bank transfer" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Sender bank
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="sender_bank_name" placeholder="OPay, GTBank, Moniepoint..." />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Payment screenshot
                  <input accept="image/png,image/jpeg,image/webp" className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-sm file:font-black file:text-white focus:border-action" name="proof_file" required type="file" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Note for review
                  <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="proof_note" placeholder="Anything that helps us match the transfer." />
                </label>
                <FormActionButton idleLabel="Submit top-up" pendingLabel="Submitting top-up..." />
              </form>
              <form action={requestWalletPayoutAction} className="motion-atmosphere motion-state-card motion-flow-card grid gap-3 rounded-lg border border-line bg-navy-900 p-4 text-white">
                <div>
                  <p className="font-mono text-xs font-black uppercase tracking-[0.16em] text-cyan">Withdraw winnings</p>
                  <h2 className="mt-2 text-2xl font-black">Request cash-out</h2>
                  <p className="mt-1 text-sm font-bold leading-6 text-slate-300">
                    This uses your winnings balance only. Once submitted, that amount is removed from winnings so it cannot be requested twice.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-white">
                    Amount to withdraw (NGN)
                    <input className="min-h-11 rounded-md border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan" inputMode="decimal" min="100" name="payout_amount_naira" placeholder="5000" required type="number" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-white">
                    Account name
                    <input className="min-h-11 rounded-md border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan" name="payout_recipient_name" placeholder="Name on bank account" required />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-white">
                    Bank
                    <input className="min-h-11 rounded-md border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan" name="payout_bank_name" placeholder="OPay, GTBank, Moniepoint..." required />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-white">
                    Account number
                    <input className="min-h-11 rounded-md border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan" inputMode="numeric" name="payout_account_number" placeholder="10 digit account number" required />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-bold text-white">
                  Note
                  <textarea className="min-h-20 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan" name="payout_note" placeholder="Optional note for payout review." />
                </label>
                <FormActionButton idleLabel="Request payout" pendingLabel="Submitting payout..." />
              </form>
            </div>
          </Panel>
          </Reveal>

          <Reveal staggerIndex={1}>
          <Panel className="h-fit xl:sticky xl:top-24">
            <PanelHeader eyebrow="History" title="Recent wallet activity" description="Top-ups and payout requests stay visible here." />
            <div className="grid gap-3 p-4">
              {payouts.length ? (
                <div className="grid gap-3">
                  <h2 className="font-mono text-xs font-black uppercase tracking-[0.16em] text-cyan">Payout requests</h2>
                  {payouts.map((payout) => (
                    <article className="rounded-md border border-line bg-white p-4" key={payout.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge tone={payoutStatusTone(payout.status)}>{payout.status}</Badge>
                          <h3 className="mt-3 text-lg font-black text-ink">{formatMinorMoney(payout.currency, payout.amount_minor)}</h3>
                        </div>
                        <span className="font-mono text-[0.68rem] font-bold text-dim">{new Date(payout.requested_at ?? payout.created_at).toLocaleString("en-NG")}</span>
                      </div>
                      <p className="mt-3 text-sm font-bold text-ink">
                        {payout.payout_bank_name} {payout.payout_account_number_masked}
                      </p>
                      {payout.payment_reference ? <p className="mt-2 break-all text-xs font-bold text-muted">Paid ref: {payout.payment_reference}</p> : null}
                      {payout.review_note ? <p className="mt-2 rounded-md bg-surfaceWarm p-3 text-sm font-bold leading-6 text-ink">{payout.review_note}</p> : null}
                    </article>
                  ))}
                </div>
              ) : null}
              {topups.length ? (
                <div className="grid gap-3">
                  <h2 className="font-mono text-xs font-black uppercase tracking-[0.16em] text-cyan">Top-ups</h2>
                  {topups.map((topup) => (
                    <article className="rounded-md border border-line bg-white p-4" key={topup.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge tone={statusTone(topup.status)}>{topup.status}</Badge>
                          <h3 className="mt-3 text-lg font-black text-ink">{formatMinorMoney(topup.currency, topup.amount_minor)}</h3>
                        </div>
                        <span className="font-mono text-[0.68rem] font-bold text-dim">{new Date(topup.submitted_at).toLocaleString("en-NG")}</span>
                      </div>
                      <p className="mt-3 break-all text-xs font-bold text-muted">Reference: {topup.transfer_reference ?? "Not provided"}</p>
                      {topup.review_note ? <p className="mt-2 rounded-md bg-surfaceWarm p-3 text-sm font-bold leading-6 text-ink">{topup.review_note}</p> : null}
                    </article>
                  ))}
                </div>
              ) : !payouts.length ? (
                <div className="rounded-md border border-dashed border-line bg-white p-5 text-sm font-bold leading-6 text-muted">
                  No wallet activity yet. Your first top-up or payout request will appear here.
                </div>
              ) : null}
            </div>
          </Panel>
          </Reveal>
        </div>
      </MotionSection>
    </AppShell>
  );
}
