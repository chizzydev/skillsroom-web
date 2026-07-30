import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminShell } from "@/components/layout/AdminShell";
import { CountUp } from "@/components/motion";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PendingLink } from "@/components/ui/PendingLink";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { adminErrorMessageFromQuery } from "@/lib/admin-action-errors";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import {
  formatMinorMoney,
  getAdminAnalyticsSummary,
  type AdminAnalyticsSummary
} from "@/lib/match-room-api";
import {
  excludeAnalyticsUserAction,
  removeAnalyticsExcludedUserAction,
  updateAnalyticsSettingsAction
} from "./actions";

export const dynamic = "force-dynamic";

const rangeOptions = [7, 28, 90] as const;

type MetricTone = "cyan" | "green" | "amber" | "navy";

const metricToneClass: Record<MetricTone, { border: string; text: string; fill: string; soft: string }> = {
  cyan: { border: "border-cyan/45", text: "text-cyan", fill: "bg-cyan", soft: "bg-cyan/10" },
  green: { border: "border-success/45", text: "text-success", fill: "bg-success", soft: "bg-success/10" },
  amber: { border: "border-warning/45", text: "text-warning", fill: "bg-warning", soft: "bg-warning/10" },
  navy: { border: "border-navy-900/25", text: "text-navy-900", fill: "bg-navy-900", soft: "bg-navy-900/5" }
};

const trendTracks = [
  { key: "active_users", label: "Players", color: "bg-cyan" },
  { key: "sessions", label: "Sessions", color: "bg-action" },
  { key: "rooms_created", label: "Rooms", color: "bg-navy-900" },
  { key: "challenges_created", label: "Challenges", color: "bg-warning" },
  { key: "tournament_entries", label: "Entries", color: "bg-success" }
] as const;

function numberLabel(value: number) {
  return value.toLocaleString("en-NG");
}

function dayLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function rateValue(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function rateTone(value: number, total: number): BadgeTone {
  if (!total) return "neutral";
  const ratio = value / total;
  if (ratio >= 0.5) return "success";
  if (ratio >= 0.2) return "warning";
  return "neutral";
}

function trustedCommission(row: AdminAnalyticsSummary["revenue"][number]) {
  return row.match_commission_reserved_minor + row.tournament_commission_reserved_minor;
}

function completedCommission(row: AdminAnalyticsSummary["revenue"][number]) {
  return row.match_commission_completed_minor + row.tournament_commission_completed_minor;
}

function totalRevenue(summary: AdminAnalyticsSummary) {
  return summary.revenue.reduce((sum, row) => sum + trustedCommission(row), 0);
}

function totalApprovedFunds(summary: AdminAnalyticsSummary) {
  return summary.revenue.reduce((sum, row) => sum + row.approved_player_funds_minor + row.provider_successful_funds_minor, 0);
}

function totalQueuedPayments(summary: AdminAnalyticsSummary) {
  return summary.revenue.reduce((sum, row) => sum + row.payout_queued_minor + row.refund_queued_minor, 0);
}

function totalDepth(summary: AdminAnalyticsSummary, key: keyof AdminAnalyticsSummary["revenue_depth"][number]) {
  return summary.revenue_depth.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function primaryCurrency(summary: AdminAnalyticsSummary) {
  return summary.revenue[0]?.currency ?? "NGN";
}

function maxDaily(summary: AdminAnalyticsSummary) {
  return Math.max(
    1,
    ...summary.daily.map((row) =>
      Math.max(row.active_users, row.sessions, row.rooms_created, row.challenges_created, row.tournament_entries)
    )
  );
}

function latestDaily(summary: AdminAnalyticsSummary) {
  return summary.daily.at(-1) ?? null;
}

function previousDaily(summary: AdminAnalyticsSummary) {
  return summary.daily.at(-2) ?? null;
}

function deltaLabel(current: number, previous?: number) {
  if (previous === undefined) return "No prior day";
  const delta = current - previous;
  if (delta === 0) return "Flat vs prior day";
  return `${delta > 0 ? "+" : ""}${numberLabel(delta)} vs prior day`;
}

function eventLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll(".", " / ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function datetimeLocalValue(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function playerLabel(row: AdminAnalyticsSummary["excluded_users"][number]) {
  return row.display_name || row.email || row.user_id;
}

function ExecutiveMetricCard({
  label,
  value,
  detail,
  tone,
  delta,
  footer
}: {
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
  delta?: string;
  footer?: string;
}) {
  const toneClass = metricToneClass[tone];
  return (
    <article className={`relative min-w-0 overflow-hidden rounded-lg border ${toneClass.border} bg-white p-5 shadow-[0_18px_45px_rgba(3,10,20,0.08)]`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${toneClass.fill}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-dim">{label}</p>
          <strong className={`mt-3 block break-words text-4xl font-black leading-none ${toneClass.text}`}>
            <CountUp value={value} />
          </strong>
        </div>
        {delta ? <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${toneClass.soft} ${toneClass.text}`}>{delta}</span> : null}
      </div>
      <p className="mt-4 text-sm font-bold leading-6 text-muted">{detail}</p>
      {footer ? <p className="mt-3 border-t border-line pt-3 font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim">{footer}</p> : null}
    </article>
  );
}

function AnalyticsHero({
  summary,
  days,
  currency
}: {
  summary: AdminAnalyticsSummary;
  days: number;
  currency: string;
}) {
  const latest = latestDaily(summary);
  const previous = previousDaily(summary);
  const activeDelta = latest ? deltaLabel(latest.active_users, previous?.active_users) : "No activity yet";
  const trustedRevenue = totalRevenue(summary);

  return (
    <section className="relative overflow-hidden rounded-lg border border-navy-900 bg-navy-900 text-white shadow-[0_24px_70px_rgba(3,10,20,0.22)]">
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:p-7">
        <div className="min-w-0">
          <p className="font-mono text-[0.7rem] font-black uppercase tracking-[0.16em] text-cyan">Production command view</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-white sm:text-4xl">
            Product and revenue health, measured from trusted Skillsroom records.
          </h1>
          <p className="mt-4 max-w-3xl text-sm font-bold leading-6 text-slate-300 sm:text-base">
            Test, admin, and pre-release activity stay out of headline numbers. Revenue comes from payment records, wallet activity, and prize records.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <PendingLink
                className={[
                  "inline-flex min-h-10 items-center rounded-md border px-4 text-sm font-black transition",
                  option === days
                    ? "border-action bg-action text-navy-950 shadow-action"
                    : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                ].join(" ")}
                href={`/admin/analytics?days=${option}`}
                key={option}
                pendingLabel="Loading..."
              >
                {option} days
              </PendingLink>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.06] p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-white/10 bg-white/10 p-4">
              <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-300">Trusted commission</p>
              <strong className="mt-2 block text-2xl font-black text-action">{formatMinorMoney(currency, trustedRevenue)}</strong>
            </div>
            <div className="rounded-md border border-white/10 bg-white/10 p-4">
              <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-300">Active players</p>
              <strong className="mt-2 block text-2xl font-black text-white">{numberLabel(summary.kpis.active_users)}</strong>
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-300">Current signal</p>
              <Badge tone={summary.kpis.events ? "success" : "neutral"}>{summary.kpis.events ? "Live" : "Waiting"}</Badge>
            </div>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-200">{activeDelta}. Reporting starts {new Date(summary.settings.production_activity_starts_at).toLocaleDateString("en-NG")}.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrendPanel({ summary }: { summary: AdminAnalyticsSummary }) {
  const max = maxDaily(summary);
  const latest = latestDaily(summary);
  const peakDay = summary.daily.reduce<AdminAnalyticsSummary["daily"][number] | null>((best, row) => {
    if (!best) return row;
    return row.active_users + row.sessions > best.active_users + best.sessions ? row : best;
  }, null);

  return (
    <Panel>
      <PanelHeader
        description="Daily production movement across active players, sessions, rooms, challenges, and tournament entries."
        eyebrow="Trend"
        title="Product movement"
      />
      {summary.daily.length ? (
        <div className="grid gap-5 p-4 lg:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-line bg-white p-4">
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim">Latest day</p>
              <strong className="mt-2 block text-2xl font-black text-ink">{latest ? dayLabel(latest.day) : "No day"}</strong>
              <p className="mt-1 text-sm font-bold text-muted">{latest ? `${numberLabel(latest.active_users)} players, ${numberLabel(latest.sessions)} sessions` : "No production activity yet"}</p>
            </div>
            <div className="rounded-md border border-line bg-white p-4">
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim">Peak movement</p>
              <strong className="mt-2 block text-2xl font-black text-cyan">{peakDay ? dayLabel(peakDay.day) : "No peak"}</strong>
              <p className="mt-1 text-sm font-bold text-muted">{peakDay ? `${numberLabel(peakDay.active_users + peakDay.sessions)} player/session signals` : "Waiting for activity"}</p>
            </div>
            <div className="rounded-md border border-line bg-white p-4">
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim">Tracked days</p>
              <strong className="mt-2 block text-2xl font-black text-success">{numberLabel(summary.daily.length)}</strong>
              <p className="mt-1 text-sm font-bold text-muted">Selected reporting window</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[780px] gap-2">
              {summary.daily.map((row) => (
                <div className="grid grid-cols-[74px_minmax(0,1fr)] items-center gap-3 rounded-md border border-line bg-white px-3 py-2" key={row.day}>
                  <span className="font-mono text-xs font-black text-muted">{dayLabel(row.day)}</span>
                  <div className="grid gap-1.5">
                    {trendTracks.map((track) => {
                      const value = Number(row[track.key]);
                      return (
                        <div className="grid grid-cols-[84px_minmax(0,1fr)_42px] items-center gap-2" key={track.key}>
                          <span className="text-xs font-bold text-muted">{track.label}</span>
                          <span className="h-2.5 overflow-hidden rounded-full bg-surfaceWarm">
                            <span
                              className={`block h-full rounded-full ${track.color}`}
                              style={{ width: `${value ? Math.max(3, (value / max) * 100) : 0}%` }}
                            />
                          </span>
                          <span className="text-right font-mono text-xs font-black text-ink">{numberLabel(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <AdminEmptyState description="No production app activity has been tracked yet." title="No activity yet" />
        </div>
      )}
    </Panel>
  );
}

function RevenuePanel({ summary }: { summary: AdminAnalyticsSummary }) {
  return (
    <Panel>
      <PanelHeader
        description="Revenue health is derived from trusted payment records, wallet activity, and prize records."
        eyebrow="Revenue"
        title="Trusted payment view"
      />
      <div className="grid gap-4 p-4 lg:p-5">
        {summary.revenue.length ? (
          summary.revenue.map((row) => {
            const commission = trustedCommission(row);
            const completed = completedCommission(row);
            const queued = row.payout_queued_minor + row.refund_queued_minor;
            const funds = row.approved_player_funds_minor + row.provider_successful_funds_minor;
            const completionRate = commission ? Math.round((completed / commission) * 100) : 0;
            return (
              <article className="overflow-hidden rounded-lg border border-line bg-white shadow-[0_18px_45px_rgba(3,10,20,0.07)]" key={row.currency}>
                <div className="border-b border-line bg-navy-900 p-5 text-white">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <Badge tone="success">{row.currency}</Badge>
                      <h2 className="mt-3 text-2xl font-black text-white">{formatMinorMoney(row.currency, commission)}</h2>
                      <p className="mt-1 text-sm font-bold text-slate-300">Reserved platform commission</p>
                    </div>
                    <div className="rounded-md border border-white/10 bg-white/10 px-4 py-3 text-right">
                      <p className="font-mono text-[0.66rem] font-black uppercase tracking-[0.12em] text-slate-300">Completion</p>
                      <strong className="mt-1 block text-xl font-black text-action">{completionRate}%</strong>
                    </div>
                  </div>
                </div>
                <dl className="grid gap-0 divide-y divide-line text-sm">
                  {[
                    ["Approved player funds", formatMinorMoney(row.currency, funds), "Payments approved from player records."],
                    ["Completed commission", formatMinorMoney(row.currency, completed), "Commission from completed prize records."],
                    ["Payouts confirmed", formatMinorMoney(row.currency, row.payout_paid_minor), "Manual bank payouts marked complete."],
                    ["Queued payouts and refunds", formatMinorMoney(row.currency, queued), "Money still waiting in payout or refund queues."]
                  ].map(([label, value, detail]) => (
                    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={label}>
                      <div>
                        <dt className="font-black text-ink">{label}</dt>
                        <dd className="mt-1 text-xs font-bold leading-5 text-muted">{detail}</dd>
                      </div>
                      <dd className="font-mono text-sm font-black text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            );
          })
        ) : (
          <AdminEmptyState description="No production payment records are inside the reporting window yet." title="No trusted revenue yet" />
        )}
      </div>
    </Panel>
  );
}

function RevenueDepthPanel({ summary, currency }: { summary: AdminAnalyticsSummary; currency: string }) {
  const topupsSubmitted = totalDepth(summary, "wallet_topups_submitted_count");
  const topupsApproved = totalDepth(summary, "wallet_topups_approved_count");
  const topupsRejected = totalDepth(summary, "wallet_topups_rejected_count");
  const topupsApprovedMinor = totalDepth(summary, "wallet_topups_approved_minor");
  const topupsRejectedMinor = totalDepth(summary, "wallet_topups_rejected_minor");
  const walletQueueMinor = totalDepth(summary, "wallet_payouts_requested_minor") + totalDepth(summary, "wallet_payouts_approved_minor");
  const roomPayoutQueueMinor = totalDepth(summary, "match_payouts_queued_minor");
  const tournamentPayoutQueueMinor = totalDepth(summary, "tournament_payouts_queued_minor");
  const matchRefundQueueMinor = totalDepth(summary, "match_refunds_queued_minor");
  const tournamentRefundQueueMinor = totalDepth(summary, "tournament_refunds_queued_minor");
  const matchCommission = totalDepth(summary, "match_commission_reserved_minor");
  const tournamentCommission = totalDepth(summary, "tournament_commission_reserved_minor");
  const totalCommission = matchCommission + tournamentCommission;

  return (
    <Panel>
      <PanelHeader
        description="Deeper money signals for wallet reviews, payout queue health, refunds, and product-line commission."
        eyebrow="Revenue depth"
        title="Payment and prize breakdown"
      />
      <div className="grid gap-5 p-4 lg:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ExecutiveMetricCard
            detail="Approved wallet top-ups from production player accounts."
            footer={`${numberLabel(topupsApproved)} approved / ${numberLabel(topupsRejected)} rejected`}
            label="Top-ups approved"
            tone="green"
            value={formatMinorMoney(currency, topupsApprovedMinor)}
          />
          <ExecutiveMetricCard
            detail="Wallet top-ups rejected after review in the reporting window."
            footer={`${pct(topupsRejected, topupsApproved + topupsRejected)} rejection rate`}
            label="Top-ups rejected"
            tone="amber"
            value={formatMinorMoney(currency, topupsRejectedMinor)}
          />
          <ExecutiveMetricCard
            detail="Wallet payouts requested or approved, waiting for payment completion."
            footer="Wallet payout queue"
            label="Wallet payout queue"
            tone="navy"
            value={formatMinorMoney(currency, walletQueueMinor)}
          />
          <ExecutiveMetricCard
            detail="Room and tournament refunds still waiting for admin completion."
            footer="Refund queue"
            label="Refunds queued"
            tone="cyan"
            value={formatMinorMoney(currency, matchRefundQueueMinor + tournamentRefundQueueMinor)}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <article className="rounded-lg border border-line bg-white p-5 shadow-[0_14px_34px_rgba(3,10,20,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Commission split</p>
                <h3 className="mt-1 text-xl font-black text-ink">Match revenue vs tournament revenue</h3>
              </div>
              <Badge tone={totalCommission ? "success" : "neutral"}>{formatMinorMoney(currency, totalCommission)}</Badge>
            </div>
            <div className="mt-5 grid gap-4">
              {[
                ["Match rooms", matchCommission, "bg-cyan"],
                ["Tournaments", tournamentCommission, "bg-success"]
              ].map(([label, amount, color]) => {
                const numericAmount = Number(amount);
                return (
                  <div key={String(label)}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-black text-ink">{label}</span>
                      <span className="font-mono text-xs font-black text-muted">{formatMinorMoney(currency, numericAmount)} · {pct(numericAmount, totalCommission)}</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surfaceWarm">
                      <span className={`block h-full rounded-full ${color}`} style={{ width: `${numericAmount ? Math.max(4, rateValue(numericAmount, totalCommission)) : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="overflow-hidden rounded-lg border border-line bg-white shadow-[0_14px_34px_rgba(3,10,20,0.06)]">
            <div className="border-b border-line bg-surfaceWarm px-5 py-4">
              <h3 className="text-xl font-black text-ink">Queue health</h3>
              <p className="mt-1 text-sm font-bold leading-6 text-muted">Payout and refund money still waiting for admin completion.</p>
            </div>
            <dl className="grid divide-y divide-line">
              {[
                ["Wallet payouts", walletQueueMinor, `${numberLabel(totalDepth(summary, "wallet_payouts_requested_count") + totalDepth(summary, "wallet_payouts_approved_count"))} requests waiting`],
                ["Room payouts", roomPayoutQueueMinor, `${numberLabel(totalDepth(summary, "match_payouts_queued_count"))} room payouts queued`],
                ["Tournament payouts", tournamentPayoutQueueMinor, `${numberLabel(totalDepth(summary, "tournament_payouts_queued_count"))} tournament payouts queued`],
                ["Room refunds", matchRefundQueueMinor, `${numberLabel(totalDepth(summary, "match_refunds_queued_count"))} room refunds queued`],
                ["Tournament refunds", tournamentRefundQueueMinor, `${numberLabel(totalDepth(summary, "tournament_refunds_queued_count"))} tournament refunds queued`]
              ].map(([label, amount, detail]) => (
                <div className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={String(label)}>
                  <div>
                    <dt className="text-sm font-black text-ink">{label}</dt>
                    <dd className="mt-1 text-xs font-bold text-muted">{detail}</dd>
                  </div>
                  <dd className="font-mono text-sm font-black text-ink">{formatMinorMoney(currency, Number(amount))}</dd>
                </div>
              ))}
            </dl>
          </article>
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <DataTable
            columns={[
              { key: "currency", label: "Currency", render: (row) => <Badge tone="success">{row.currency}</Badge> },
              { key: "wallet_topups_approved_minor", label: "Approved top-ups", render: (row) => <span className="font-mono text-xs font-black text-ink">{formatMinorMoney(row.currency, row.wallet_topups_approved_minor)}</span> },
              { key: "wallet_topups_rejected_minor", label: "Rejected top-ups", render: (row) => <span className="font-mono text-xs font-black text-muted">{formatMinorMoney(row.currency, row.wallet_topups_rejected_minor)}</span> },
              { key: "match_commission_reserved_minor", label: "Match commission", render: (row) => <span className="font-mono text-xs font-black text-ink">{formatMinorMoney(row.currency, row.match_commission_reserved_minor)}</span> },
              { key: "tournament_commission_reserved_minor", label: "Tournament commission", render: (row) => <span className="font-mono text-xs font-black text-ink">{formatMinorMoney(row.currency, row.tournament_commission_reserved_minor)}</span> },
              { key: "queue", label: "Queued money", render: (row) => <span className="font-mono text-xs font-black text-muted">{formatMinorMoney(row.currency, row.wallet_payouts_requested_minor + row.wallet_payouts_approved_minor + row.match_payouts_queued_minor + row.tournament_payouts_queued_minor + row.match_refunds_queued_minor + row.tournament_refunds_queued_minor)}</span> }
            ]}
            rows={summary.revenue_depth}
          />
          {!summary.revenue_depth.length ? (
            <div className="p-4">
              <AdminEmptyState description="No production revenue details are inside the reporting window yet." title="No revenue depth yet" />
            </div>
          ) : null}
        </div>
        <p className="text-xs font-bold leading-5 text-muted">
          Top-up submissions waiting for review: {numberLabel(topupsSubmitted)}. Tournament entry funds approved: {formatMinorMoney(currency, totalDepth(summary, "tournament_entry_funds_approved_minor"))}.
        </p>
      </div>
    </Panel>
  );
}

function FunnelStep({
  label,
  value,
  previous,
  tone = "cyan"
}: {
  label: string;
  value: number;
  previous?: number;
  tone?: MetricTone;
}) {
  const toneClass = metricToneClass[tone];
  const width = previous ? Math.min(100, Math.max(4, (value / Math.max(previous, 1)) * 100)) : 100;
  return (
    <article className={`rounded-lg border ${toneClass.border} bg-white p-4 shadow-[0_14px_34px_rgba(3,10,20,0.06)]`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-black leading-5 text-ink">{label}</p>
        {previous === undefined ? <Badge tone="neutral">Start</Badge> : <Badge tone={rateTone(value, previous)}>{pct(value, previous)}</Badge>}
      </div>
      <strong className={`mt-3 block text-3xl font-black leading-none ${toneClass.text}`}>{numberLabel(value)}</strong>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surfaceWarm">
        <span className={`block h-full rounded-full ${toneClass.fill}`} style={{ width: `${value ? width : 0}%` }} />
      </div>
      <p className="mt-2 text-xs font-bold leading-5 text-muted">{previous === undefined ? "First measurable step." : `${numberLabel(previous)} in the previous step.`}</p>
    </article>
  );
}

function FunnelPanel({ summary }: { summary: AdminAnalyticsSummary }) {
  return (
    <Panel>
      <PanelHeader
        description="Counts follow the room, challenge, tournament, result, and payment steps that matter for product health."
        eyebrow="Funnel"
        title="Room and tournament funnel"
      />
      <div className="grid gap-4 p-4 lg:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FunnelStep label="Rooms created" tone="navy" value={summary.funnel.room_created} />
          <FunnelStep label="Challenges posted" previous={summary.funnel.room_created} tone="cyan" value={summary.funnel.challenge_created} />
          <FunnelStep label="Challenges accepted" previous={summary.funnel.challenge_created} tone="green" value={summary.funnel.challenge_accepted} />
          <FunnelStep label="Players joined rooms" previous={summary.funnel.room_created} tone="amber" value={summary.funnel.room_joined} />
          <FunnelStep label="Payments submitted" previous={summary.funnel.room_joined} tone="navy" value={summary.funnel.funding_submitted} />
          <FunnelStep label="Payments approved" previous={summary.funnel.funding_submitted} tone="green" value={summary.funnel.funding_approved} />
          <FunnelStep label="Rooms started" previous={summary.funnel.room_joined} tone="cyan" value={summary.funnel.room_active} />
          <FunnelStep label="Results submitted" previous={summary.funnel.room_active} tone="amber" value={summary.funnel.result_submitted} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FunnelStep label="Prizes reserved" previous={summary.funnel.result_admin_approved} tone="green" value={summary.funnel.settlement_reserved} />
          <FunnelStep label="Tournaments created" tone="navy" value={summary.funnel.tournament_created} />
          <FunnelStep label="Tournament entries" previous={summary.funnel.tournament_created} tone="cyan" value={summary.funnel.tournament_entries} />
          <FunnelStep label="Tournament check-ins" previous={summary.funnel.tournament_entries} tone="amber" value={summary.funnel.tournament_check_ins} />
        </div>
      </div>
    </Panel>
  );
}

function ConversionCard({
  title,
  value,
  total,
  detail,
  tone
}: {
  title: string;
  value: number;
  total: number;
  detail: string;
  tone: MetricTone;
}) {
  const toneClass = metricToneClass[tone];
  const rate = rateValue(value, total);
  return (
    <article className={`rounded-lg border ${toneClass.border} bg-white p-5 shadow-[0_14px_34px_rgba(3,10,20,0.06)]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-ink">{title}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted">{detail}</p>
        </div>
        <Badge tone={rateTone(value, total)}>{pct(value, total)}</Badge>
      </div>
      <strong className={`mt-4 block text-3xl font-black leading-none ${toneClass.text}`}>{numberLabel(value)}</strong>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surfaceWarm">
        <span className={`block h-full rounded-full ${toneClass.fill}`} style={{ width: `${value ? Math.max(4, rate) : 0}%` }} />
      </div>
      <p className="mt-2 font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim">
        {numberLabel(total)} base
      </p>
    </article>
  );
}

function FunnelDepthPanel({ summary }: { summary: AdminAnalyticsSummary }) {
  const { room_entry: roomEntry, challenge_acceptance: challenge, tournament_progress: tournament } = summary.funnel_depth;

  return (
    <Panel>
      <PanelHeader
        description="Conversion depth for room entry, challenge acceptance, and tournament completion."
        eyebrow="Funnel depth"
        title="Conversion quality"
      />
      <div className="grid gap-5 p-4 lg:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ConversionCard
            detail="Joined player slots compared with available room slots."
            title="Room entry conversion"
            tone="cyan"
            total={roomEntry.possible_player_slots}
            value={roomEntry.joined_players}
          />
          <ConversionCard
            detail="Players with approved entry payment among joined players."
            title="Entry payment conversion"
            tone="green"
            total={roomEntry.joined_players}
            value={roomEntry.funded_players}
          />
          <ConversionCard
            detail="Rooms that reached live play after players joined."
            title="Room start conversion"
            tone="navy"
            total={roomEntry.rooms_created}
            value={roomEntry.active_rooms}
          />
          <ConversionCard
            detail="Accepted challenges compared with posted challenges."
            title="Challenge acceptance"
            tone="amber"
            total={challenge.challenges_created}
            value={challenge.challenges_accepted}
          />
          <ConversionCard
            detail="Checked-in entries compared with tournament registrations."
            title="Tournament check-in"
            tone="cyan"
            total={tournament.tournament_entries}
            value={tournament.tournament_checked_in_entries}
          />
          <ConversionCard
            detail="Completed tournament matches compared with created matches."
            title="Tournament result completion"
            tone="green"
            total={tournament.tournament_matches_created}
            value={tournament.tournament_matches_completed}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-lg border border-line bg-white p-5">
            <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Rooms</p>
            <dl className="mt-4 grid gap-3">
              {[
                ["Rooms created", roomEntry.rooms_created],
                ["Possible player slots", roomEntry.possible_player_slots],
                ["Joined players", roomEntry.joined_players],
                ["Funded players", roomEntry.funded_players],
                ["Completed rooms", roomEntry.completed_rooms]
              ].map(([label, value]) => (
                <div className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0" key={String(label)}>
                  <dt className="text-sm font-bold text-muted">{label}</dt>
                  <dd className="font-mono text-sm font-black text-ink">{numberLabel(Number(value))}</dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="rounded-lg border border-line bg-white p-5">
            <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Challenges</p>
            <dl className="mt-4 grid gap-3">
              {[
                ["Posted", challenge.challenges_created],
                ["Accepted", challenge.challenges_accepted],
                ["Still open", challenge.challenges_open],
                ["Expired", challenge.challenges_expired],
                ["Cancelled", challenge.challenges_cancelled]
              ].map(([label, value]) => (
                <div className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0" key={String(label)}>
                  <dt className="text-sm font-bold text-muted">{label}</dt>
                  <dd className="font-mono text-sm font-black text-ink">{numberLabel(Number(value))}</dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="rounded-lg border border-line bg-white p-5">
            <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Tournaments</p>
            <dl className="mt-4 grid gap-3">
              {[
                ["Created", tournament.tournaments_created],
                ["Published", tournament.tournaments_published],
                ["Registration open", tournament.tournaments_registration_open],
                ["Entries", tournament.tournament_entries],
                ["Active entries", tournament.tournament_active_entries],
                ["Completed", tournament.tournaments_completed]
              ].map(([label, value]) => (
                <div className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0" key={String(label)}>
                  <dt className="text-sm font-bold text-muted">{label}</dt>
                  <dd className="font-mono text-sm font-black text-ink">{numberLabel(Number(value))}</dd>
                </div>
              ))}
            </dl>
          </article>
        </div>
      </div>
    </Panel>
  );
}

function QualityControlsPanel({
  summary,
  days,
  currency
}: {
  summary: AdminAnalyticsSummary;
  days: number;
  currency: string;
}) {
  return (
    <Panel>
      <PanelHeader
        description="Keep reporting clean by setting the production cutover and excluding player accounts used for testing, staff checks, or internal release work."
        eyebrow="Quality controls"
        title="Reporting controls"
      />
      <div className="grid gap-5 p-4 lg:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ExecutiveMetricCard
            detail="Player accounts explicitly left out of production analytics."
            label="Excluded players"
            tone="navy"
            value={numberLabel(summary.quality.excluded_users_count)}
          />
          <ExecutiveMetricCard
            detail="Tracked app events removed because the player is excluded."
            label="Excluded events"
            tone="cyan"
            value={numberLabel(summary.quality.explicitly_excluded_events)}
          />
          <ExecutiveMetricCard
            detail="Tracked events before the current production activity start."
            label="Before cutover"
            tone="amber"
            value={numberLabel(summary.quality.pre_cutover_events)}
          />
          <ExecutiveMetricCard
            detail="Approved player funds before the trusted revenue start."
            label="Test funds hidden"
            tone="green"
            value={formatMinorMoney(currency, summary.quality.pre_cutover_approved_player_funds_minor)}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.75fr)]">
          <form action={updateAnalyticsSettingsAction} className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-[0_14px_34px_rgba(3,10,20,0.06)]">
            <input name="days" type="hidden" value={days} />
            <div>
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Production cutover</p>
              <h3 className="mt-1 text-lg font-black text-ink">Reporting start dates</h3>
              <p className="mt-1 text-sm font-bold leading-6 text-muted">
                Move these only when you need to include or exclude a known launch/testing period.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Activity starts
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  defaultValue={datetimeLocalValue(summary.settings.production_activity_starts_at)}
                  name="production_activity_starts_at"
                  required
                  type="datetime-local"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Trusted revenue starts
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  defaultValue={datetimeLocalValue(summary.settings.production_revenue_starts_at)}
                  name="production_revenue_starts_at"
                  required
                  type="datetime-local"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Admin note
              <textarea
                className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action"
                defaultValue={summary.settings.note}
                maxLength={240}
                name="note"
                required
              />
            </label>
            <FormActionButton idleLabel="Update reporting basis" pendingLabel="Updating reporting..." />
          </form>

          <form action={excludeAnalyticsUserAction} className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-[0_14px_34px_rgba(3,10,20,0.06)]">
            <input name="days" type="hidden" value={days} />
            <div>
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Exclude player</p>
              <h3 className="mt-1 text-lg font-black text-ink">Mark a test account</h3>
              <p className="mt-1 text-sm font-bold leading-6 text-muted">
                Use this for accounts used in internal checks, seeded activity, APK testing, or payment testing.
              </p>
            </div>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Player user ID
              <input
                className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
                name="user_id"
                placeholder="auth user id"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Reason
              <textarea
                className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action"
                maxLength={240}
                name="reason"
                placeholder="Example: Android release smoke test account."
                required
              />
            </label>
            <FormActionButton idleLabel="Exclude from analytics" pendingLabel="Saving exclusion..." variant="secondary" />
          </form>
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <div className="border-b border-line bg-surfaceWarm px-4 py-4">
            <h3 className="text-lg font-black text-ink">Excluded player accounts</h3>
            <p className="mt-1 text-sm font-bold leading-6 text-muted">
              These players are hidden from production activity and revenue metrics until restored.
            </p>
          </div>
          {summary.excluded_users.length ? (
            <DataTable
              columns={[
                {
                  key: "user_id",
                  label: "Player",
                  render: (row) => (
                    <div className="min-w-52">
                      <p className="text-sm font-black text-ink">{playerLabel(row)}</p>
                      <p className="mt-1 break-all font-mono text-xs font-bold text-muted">{row.user_id}</p>
                    </div>
                  )
                },
                { key: "role", label: "Role", render: (row) => <Badge tone={row.role === "player" ? "cyan" : "neutral"}>{row.role ?? "Unknown"}</Badge> },
                { key: "reason", label: "Reason", render: (row) => <span className="text-sm font-bold text-muted">{row.reason}</span> },
                { key: "created_at", label: "Added", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                {
                  key: "action",
                  label: "Action",
                  render: (row) => (
                    <form action={removeAnalyticsExcludedUserAction}>
                      <input name="days" type="hidden" value={days} />
                      <input name="user_id" type="hidden" value={row.user_id} />
                      <FormActionButton idleLabel="Restore" pendingLabel="Restoring..." size="sm" variant="secondary" />
                    </form>
                  )
                }
              ]}
              rows={summary.excluded_users}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState description="No player test accounts have been explicitly excluded yet. The production cutover still keeps earlier test payment records out." title="No excluded players listed" />
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default async function AdminAnalyticsPage({
  searchParams
}: {
  searchParams: Promise<{ days?: string; success?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/analytics");
  if (!canUseAdminSection(user, "analytics")) redirect("/admin");

  const { days: requestedDays, success, error } = await searchParams;
  const days = rangeOptions.includes(Number(requestedDays) as (typeof rangeOptions)[number])
    ? Number(requestedDays)
    : 28;

  let summary: AdminAnalyticsSummary | null = null;
  let loadError: string | null = null;

  try {
    summary = await getAdminAnalyticsSummary(days);
  } catch {
    loadError = "Product analytics could not be loaded.";
  }

  const currency = summary ? primaryCurrency(summary) : "NGN";
  const trustedRevenue = summary ? totalRevenue(summary) : 0;
  const approvedFunds = summary ? totalApprovedFunds(summary) : 0;
  const queuedPayments = summary ? totalQueuedPayments(summary) : 0;
  const latest = summary ? latestDaily(summary) : null;
  const previous = summary ? previousDaily(summary) : null;

  return (
    <AdminShell active="analytics">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Production analytics for app activity, room flow, tournaments, and trusted payment health."
          eyebrow="Product health"
          title="Analytics"
          tone="cyan"
        />

        {loadError ? <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div> : null}
        {error ? <TransientStatusBanner clearKeys={["error"]} durationMs={12000} message={adminErrorMessageFromQuery(error)} /> : null}
        {success ? <TransientStatusBanner clearKeys={["success"]} durationMs={12000} message={success} tone="success" /> : null}

        {summary ? (
          <>
            <AnalyticsHero summary={summary} days={days} currency={currency} />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ExecutiveMetricCard
                delta={latest ? deltaLabel(latest.active_users, previous?.active_users) : undefined}
                detail="Signed-in production players with tracked activity in the selected window."
                footer="Player activity"
                label="Active players"
                tone="cyan"
                value={numberLabel(summary.kpis.active_users)}
              />
              <ExecutiveMetricCard
                delta={latest ? deltaLabel(latest.sessions, previous?.sessions) : undefined}
                detail="First-party app sessions from privacy-clean client events."
                footer="App sessions"
                label="Sessions"
                tone="navy"
                value={numberLabel(summary.kpis.sessions)}
              />
              <ExecutiveMetricCard
                detail="Reserved platform commission from trusted payment and prize records."
                footer="Payment records"
                label="Trusted commission"
                tone="green"
                value={formatMinorMoney(currency, trustedRevenue)}
              />
              <ExecutiveMetricCard
                detail="Payouts and refunds still waiting for admin payment completion."
                footer={`Approved funds ${formatMinorMoney(currency, approvedFunds)}`}
                label="Payment queue"
                tone="amber"
                value={formatMinorMoney(currency, queuedPayments)}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
              <TrendPanel summary={summary} />
              <RevenuePanel summary={summary} />
            </div>

            <RevenueDepthPanel summary={summary} currency={currency} />

            <FunnelPanel summary={summary} />
            <FunnelDepthPanel summary={summary} />

            <div className="grid gap-5 xl:grid-cols-2">
              <Panel>
                <PanelHeader
                  description="Most common first-party app events in this reporting window."
                  eyebrow="Events"
                  title="Top tracked actions"
                />
                {summary.top_events.length ? (
                  <DataTable
                    columns={[
                      { key: "event_name", label: "Action", render: (row) => <span className="text-sm font-black text-ink">{eventLabel(row.event_name)}</span> },
                      { key: "event_count", label: "Count", render: (row) => <span className="font-mono text-xs font-bold text-muted">{numberLabel(row.event_count)}</span> },
                      { key: "user_count", label: "Players", render: (row) => <Badge tone="cyan">{numberLabel(row.user_count)}</Badge> }
                    ]}
                    rows={summary.top_events}
                  />
                ) : (
                  <div className="p-4">
                    <AdminEmptyState description="Tracked app events will appear here after players use the mobile app." title="No events yet" />
                  </div>
                )}
              </Panel>

              <Panel>
                <PanelHeader
                  description="Recent production player activity without proof files, chat body, payment details, or personal profile content."
                  eyebrow="Recent"
                  title="Latest app activity"
                />
                {summary.recent_events.length ? (
                  <DataTable
                    columns={[
                      { key: "occurred_at", label: "Time", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.occurred_at).toLocaleString("en-NG")}</span> },
                      { key: "event_name", label: "Action", render: (row) => <span className="text-sm font-black text-ink">{eventLabel(row.event_name)}</span> },
                      { key: "platform", label: "App", render: (row) => <Badge tone={row.platform === "android" ? "success" : "neutral"}>{row.platform}</Badge> },
                      { key: "screen", label: "Screen", render: (row) => <span className="text-sm font-bold text-muted">{row.screen ?? row.path ?? "App"}</span> }
                    ]}
                    rows={summary.recent_events}
                  />
                ) : (
                  <div className="p-4">
                    <AdminEmptyState description="No production player events have been recorded yet." title="No recent activity" />
                  </div>
                )}
              </Panel>
            </div>

            <QualityControlsPanel summary={summary} days={days} currency={currency} />
          </>
        ) : null}
      </section>
    </AdminShell>
  );
}
