import type { Metadata } from "next";
import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { PublicSharePanel } from "@/components/community/PublicSharePanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { getCommunitySocialProof, type CommunitySocialProofMetrics } from "@/lib/match-room-api";
import { shareMetadata, shareUrl } from "@/lib/share-cards";

export const metadata: Metadata = shareMetadata({
  title: "Skillsroom Social Proof",
  description: "Honest public platform metrics for completed matches, hosted tournaments, winners, and payout queues on Skillsroom.",
  path: "/community/proof"
});

function formatMinor(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value / 100);
}

function MetricBand({ metrics }: { metrics: CommunitySocialProofMetrics }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusPanel detail="Created across the platform" label="Rooms" tone="cyan" value={metrics.rooms_created.toString()} />
        <StatusPanel detail="Finished and retained for audit" label="Matches" tone="success" value={metrics.matches_completed.toString()} />
        <StatusPanel detail="Published or completed events" label="Tournaments" tone="warning" value={metrics.tournaments_hosted.toString()} />
        <StatusPanel detail="Approved winners across rooms and tournaments" label="Winners" tone="success" value={metrics.winners_crowned.toString()} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusPanel detail="Operator-reviewed outcomes" label="Disputes Resolved" tone="warning" value={metrics.disputes_resolved.toString()} />
        <StatusPanel detail="Active Skillsroom accounts" label="Players" tone="cyan" value={metrics.players_registered.toString()} />
        <StatusPanel detail="Public teams and communities" label="Clans" tone="success" value={metrics.clans_created.toString()} />
        <StatusPanel detail="Event and match confirmations" label="Check-ins" tone="warning" value={metrics.entries_checked_in.toString()} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusPanel detail="Reserved before payout completion" label="Prize Reservations" tone="success" value={metrics.prize_reservations_count.toString()} />
        <StatusPanel detail="Value attached to reserved prize obligations" label="Reserved Value" tone="success" value={formatMinor(metrics.prize_reservations_minor)} />
        <StatusPanel detail="Pending manual or queued payout actions" label="Payout Queue" tone="warning" value={metrics.payout_queue_count.toString()} />
        <StatusPanel detail="Pending refund operations" label="Refund Queue" tone="danger" value={metrics.refund_queue_count.toString()} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusPanel detail="Value attached to queued payout operations" label="Queued Payout Value" tone="warning" value={formatMinor(metrics.payout_queue_minor)} />
        <StatusPanel detail="Value attached to queued refund operations" label="Queued Refund Value" tone="danger" value={formatMinor(metrics.refund_queue_minor)} />
        <StatusPanel
          detail={metrics.verified_payout_metrics_enabled ? "Provider-verified payout completion totals" : "Hidden until Kora-approved reconciliation exists"}
          label="Verified Payout Totals"
          tone="cyan"
          value={metrics.verified_payout_metrics_enabled && metrics.verified_payouts_completed_minor !== null ? formatMinor(metrics.verified_payouts_completed_minor) : "Locked"}
        />
        <StatusPanel
          detail={metrics.verified_payout_metrics_enabled ? "Provider-verified completed payout count" : "Count stays unavailable before provider verification"}
          label="Verified Payout Count"
          tone="cyan"
          value={metrics.verified_payout_metrics_enabled && metrics.verified_payouts_completed_count !== null ? metrics.verified_payouts_completed_count.toString() : "Locked"}
        />
      </div>
    </>
  );
}

export default async function CommunityProofPage() {
  let metrics: CommunitySocialProofMetrics | null = null;

  try {
    const result = await getCommunitySocialProof();
    metrics = result.metrics;
  } catch {
    metrics = null;
  }

  return (
    <AppShell active="community">
      <section className="grid gap-6">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(320px,38%)]">
            <div className="relative p-5 md:p-7 lg:p-9">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(33,170,255,0.18),transparent_36%)]" />
              <div className="relative">
                <Badge tone="cyan">Platform numbers</Badge>
                <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">Public platform metrics</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  These numbers come from real platform activity. Finished payout totals stay hidden until full payment verification is in place.
                </p>
                <div className="mt-8 grid gap-3 xl:max-w-2xl xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Real numbers</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Only actual platform counts belong here. Nothing added just to look bigger.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">What we can show now</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Reserved and queued amounts are shown because they can already be checked properly.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Why people check this</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">It helps people see that the platform is active and being used.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative min-h-[300px] border-t border-white/10 xl:min-h-full xl:border-l xl:border-t-0">
              <Image alt="Premium Skillsroom proof metrics artwork" className="object-cover" fill priority sizes="(min-width: 1280px) 38vw, 100vw" src="/marketing/skillsroom-premium/hero-premium.png" />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#08131f]/80" />
              <div className="absolute inset-x-4 bottom-4 md:inset-x-6">
                <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Numbers at a glance</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">See what the platform can honestly show right now.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {metrics ? (
          <>
            <MetricBand metrics={metrics} />
            <Panel>
              <PanelHeader
                eyebrow="Money Language"
                title="What these payout numbers mean"
                description="Skillsroom can truthfully show reserved and queued obligations before provider automation goes live."
              />
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div className="rounded-[1.25rem] border border-line bg-white p-4">
                  <h2 className="text-base font-black text-ink">Allowed now</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Prize reservations, payout queues, and refund queues are based on actual settlement and queue rows in the platform ledger.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-line bg-white p-4">
                  <h2 className="text-base font-black text-ink">Blocked until Kora</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Completed payout totals stay intentionally unavailable until payment-provider approval and reconciliation are fully verified.
                  </p>
                </div>
              </div>
            </Panel>
            <Panel>
              <PublicSharePanel
                eyebrow="Share"
                panelTitle="Share the proof dashboard"
                panelDescription="Useful when you want to show real platform traction without making premature payout-completion claims."
                summary="Honest public platform metrics for completed matches, hosted tournaments, winners, and payout queues on Skillsroom."
                title="Skillsroom Social Proof"
                url={shareUrl("/community/proof")}
              />
            </Panel>
          </>
        ) : (
          <Panel>
            <div className="p-4">
              <EmptyState title="Social proof unavailable" description="The public metrics snapshot could not be loaded right now." />
            </div>
          </Panel>
        )}
      </section>
    </AppShell>
  );
}
