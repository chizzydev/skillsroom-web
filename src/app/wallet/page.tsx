import { redirect } from "next/navigation";
import Link from "next/link";
import { ManualPaymentPanel } from "@/components/payments/ManualPaymentPanel";
import { MotionSection, Reveal } from "@/components/motion";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { RealtimePatchStatus } from "@/components/realtime/RealtimePatchStatus";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth-bridge";
import {
  getWalletOverview,
  listWalletLedger,
  listMyWalletPayoutRequests,
  listMyWalletTopups
} from "@/lib/match-room-api";
import { requestWalletPayoutAction, submitWalletTopupAction } from "./actions";
import { WalletLiveIsland, type WalletLiveSnapshot } from "./WalletLiveIsland";

export const dynamic = "force-dynamic";

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; activity?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/wallet");
  const { error, success, activity } = await searchParams;

  let wallet = null as Awaited<ReturnType<typeof getWalletOverview>> | null;
  let walletActivity: Omit<WalletLiveSnapshot, "wallet" | "loaded_at"> = {
    topups: [],
    payout_requests: [],
    ledger_entries: []
  };
  let loadError: string | null = null;
  try {
    const [walletResult, topupResult, payoutResult, ledgerResult] = await Promise.all([
      getWalletOverview("summary"),
      listMyWalletTopups({ limit: 8 }),
      listMyWalletPayoutRequests({ limit: 8 }),
      listWalletLedger({ limit: 8 })
    ]);
    wallet = walletResult;
    walletActivity = {
      topups: topupResult.topups,
      payout_requests: payoutResult.payout_requests,
      ledger_entries: ledgerResult.ledger_entries
    };
  } catch {
    loadError = "Unable to load your wallet right now. Please try again.";
  }

  const walletSnapshot: WalletLiveSnapshot = {
    wallet,
    ...walletActivity,
    loaded_at: new Date().toISOString()
  };

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
        <LiveUpdateStream
          autoConnect={false}
          eventTypePrefixes={["wallet.", "match.payout.", "match.refund.", "tournament.payout.", "tournament.refund."]}
          label="Wallet live"
          refreshTargetLabel="wallet"
        />
        <RealtimePatchStatus label="Wallet" targets={["wallet"]} />

        <WalletLiveIsland initialSnapshot={walletSnapshot} showActivity={activity === "full"} />

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
                    Sender account name
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="sender_account_name" placeholder="Name on your bank transfer" />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Sender bank
                    <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="sender_bank_name" placeholder="OPay, GTBank, Moniepoint..." />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Payment screenshot
                  <input accept="image/png,image/jpeg,image/webp" className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-sm file:font-black file:text-white focus:border-action" name="proof_file" required type="file" />
                </label>
                <details className="rounded-md border border-line bg-surfaceWarm">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-black text-ink">Optional transfer details</summary>
                  <div className="grid gap-3 border-t border-line p-3">
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      Transfer reference
                      <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="transfer_reference" placeholder="Receipt or narration reference" />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      Note for review
                      <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="proof_note" placeholder="Anything that helps us match the transfer." />
                    </label>
                  </div>
                </details>
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
                <details className="rounded-md border border-white/15 bg-white/5">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-black text-white">Optional payout note</summary>
                  <div className="border-t border-white/10 p-3">
                    <label className="grid gap-2 text-sm font-bold text-white">
                      Note
                      <textarea className="min-h-20 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan" name="payout_note" placeholder="Anything that helps the team review this payout." />
                    </label>
                  </div>
                </details>
                <FormActionButton idleLabel="Request payout" pendingLabel="Submitting payout..." />
              </form>
            </div>
          </Panel>
          </Reveal>

          <Reveal staggerIndex={1}>
          {activity === "full" ? null : (
            <Panel className="h-fit xl:sticky xl:top-24">
              <PanelHeader eyebrow="History" title="Wallet activity" description="Top-ups, payouts, and balance changes refresh automatically when you open the full activity view." />
              <div className="grid gap-3 p-4">
                <div className="rounded-md border border-line bg-white p-4">
                  <p className="text-sm font-bold leading-6 text-muted">Open history when you need receipts, payout status, or balance changes.</p>
                  <Link className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/wallet?activity=full">
                    Show wallet activity
                  </Link>
                </div>
              </div>
            </Panel>
          )}
          </Reveal>
        </div>
      </MotionSection>
    </AppShell>
  );
}
