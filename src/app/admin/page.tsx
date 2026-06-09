import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminQueueCard } from "@/components/admin/AdminQueueCard";
import { AdminShell } from "@/components/layout/AdminShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth-bridge";
import {
  formatEntryAmount,
  listManageableAnnouncements,
  listFundingSubmissions,
  listPayouts,
  listRefunds,
  listResultClaims,
  listRiskFlags,
  listRoomHolds,
  listSettlements,
  type CommunityAnnouncement,
  type ManualFundingSubmission,
  type MatchPayout,
  type MatchRefund,
  type MatchResultClaim,
  type MatchSettlement,
  type RoomModerationHold,
  type UserRiskFlag
} from "@/lib/match-room-api";
import { archiveAnnouncementAction, createPlatformAnnouncementAction, publishAnnouncementAction } from "./actions";

type WorkItem = {
  id: string;
  type: string;
  room: string;
  actor: string;
  amount: string;
  priority: string;
  tone: BadgeTone;
  href: string;
};

function money(currency: string, amountMinor: number) {
  return formatEntryAmount({ currency, entry_amount_minor: amountMinor });
}

function fromFunding(row: ManualFundingSubmission): WorkItem {
  return {
    id: row.id,
    type: "Funding review",
    room: row.match_room_id,
    actor: row.user_id,
    amount: money(row.currency, row.amount_minor),
    priority: "Verify transfer",
    tone: "warning",
    href: "/admin/funding"
  };
}

function fromResult(row: MatchResultClaim): WorkItem {
  return {
    id: row.id,
    type: "Result claim",
    room: row.match_room_id,
    actor: row.claimant_user_id,
    amount: row.score_summary,
    priority: "Evidence check",
    tone: "cyan",
    href: "/admin/results"
  };
}

function fromSettlement(row: MatchSettlement): WorkItem {
  return {
    id: row.id,
    type: "Settlement reserve",
    room: row.match_room_id,
    actor: row.winner_user_id,
    amount: money(row.currency, row.payout_minor),
    priority: "Queue payout",
    tone: "success",
    href: "/admin/settlements"
  };
}

function fromPayout(row: MatchPayout): WorkItem {
  return {
    id: row.id,
    type: "Manual payout",
    room: row.match_room_id,
    actor: row.user_id,
    amount: money(row.currency, row.amount_minor),
    priority: "Bank transfer",
    tone: "success",
    href: "/admin/settlements"
  };
}

function fromRefund(row: MatchRefund): WorkItem {
  return {
    id: row.id,
    type: "Manual refund",
    room: row.match_room_id,
    actor: row.user_id,
    amount: money(row.currency, row.amount_minor),
    priority: "Return funds",
    tone: "danger",
    href: "/admin/settlements"
  };
}

function fromRisk(row: UserRiskFlag): WorkItem {
  return {
    id: row.id,
    type: "Risk flag",
    room: "User",
    actor: row.user_id,
    amount: row.summary,
    priority: row.severity,
    tone: row.severity === "critical" || row.severity === "high" ? "danger" : "warning",
    href: "/admin/risk"
  };
}

function fromHold(row: RoomModerationHold): WorkItem {
  return {
    id: row.id,
    type: "Room hold",
    room: row.match_room_id,
    actor: "Operations",
    amount: row.reason,
    priority: row.severity,
    tone: row.severity === "critical" || row.severity === "high" ? "danger" : "warning",
    href: "/admin/risk"
  };
}

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; announcement_saved?: string; announcement_published?: string; announcement_archived?: string }>;
}) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) {
    redirect("/sign-in?redirect=/admin");
  }
  const { error, announcement_saved: announcementSaved, announcement_published: announcementPublished, announcement_archived: announcementArchived } = await searchParams;

  let funding: ManualFundingSubmission[] = [];
  let results: MatchResultClaim[] = [];
  let settlements: MatchSettlement[] = [];
  let payouts: MatchPayout[] = [];
  let refunds: MatchRefund[] = [];
  let flags: UserRiskFlag[] = [];
  let holds: RoomModerationHold[] = [];
  let announcements: CommunityAnnouncement[] = [];
  let loadError: string | null = null;

  try {
    const [fundingResult, resultClaims, settlementResult, payoutResult, refundResult, flagResult, holdResult, announcementResult] =
      await Promise.all([
        listFundingSubmissions("submitted"),
        listResultClaims("submitted"),
        listSettlements("payout_pending"),
        listPayouts("queued"),
        listRefunds("queued"),
        listRiskFlags("open"),
        listRoomHolds("active"),
        listManageableAnnouncements({ scope: "platform", limit: 8 })
      ]);
    funding = fundingResult.submissions;
    results = resultClaims.claims;
    settlements = settlementResult.settlements;
    payouts = payoutResult.payouts;
    refunds = refundResult.refunds;
    flags = flagResult.flags;
    holds = holdResult.holds;
    announcements = announcementResult.announcements;
  } catch {
    loadError = "Unable to load the operations queue.";
  }

  const workItems = [
    ...funding.map(fromFunding),
    ...results.map(fromResult),
    ...settlements.map(fromSettlement),
    ...payouts.map(fromPayout),
    ...refunds.map(fromRefund),
    ...flags.map(fromRisk),
    ...holds.map(fromHold)
  ].slice(0, 12);

  return (
    <AdminShell active="overview">
      <section className="grid gap-5">
        <AdminPageHeader
          actions={
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink transition hover:border-cyan"
              href="/admin/funding"
            >
              Review funding
            </Link>
          }
          description="Live operational queues for funding, evidence, settlement, refunds, and risk. Every decision stays tied to a room, player, and audit trail."
          eyebrow="Operations"
          title="Admin Command Center"
        />

        <LiveUpdateStream eventTypePrefixes={["admin.queue.", "match.", "tournament.", "notification."]} label="Ops live" />

        {error ? <TransientStatusBanner clearKeys={["error"]} durationMs={9000} message={error} /> : null}
        {announcementSaved ? <TransientStatusBanner clearKeys={["announcement_saved"]} durationMs={9000} message="Platform announcement saved." tone="success" /> : null}
        {announcementPublished ? <TransientStatusBanner clearKeys={["announcement_published"]} durationMs={9000} message="Announcement published." tone="success" /> : null}
        {announcementArchived ? <TransientStatusBanner clearKeys={["announcement_archived"]} durationMs={9000} message="Announcement archived." tone="success" /> : null}
        {loadError ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminQueueCard detail="Manual transfers waiting for approval." href="/admin/funding" label="Funding" tone="warning" value={funding.length.toString()} />
          <AdminQueueCard detail="Score claims and evidence needing operator review." href="/admin/results" label="Results" tone="cyan" value={results.length.toString()} />
          <AdminQueueCard detail="Winner payouts and player refunds waiting on bank action." href="/admin/settlements" label="Money Ops" tone="success" value={(payouts.length + refunds.length).toString()} />
          <AdminQueueCard detail="Open player flags and active room holds." href="/admin/risk" label="Risk" tone="danger" value={(flags.length + holds.length).toString()} />
        </div>

        <Panel>
          <PanelHeader
            description="Post public platform notices for maintenance windows, community updates, winner stories, or policy changes."
            eyebrow="Community"
            title="Platform announcements"
          />
          <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <form action={createPlatformAnnouncementAction} className="grid gap-3 rounded-md border border-line bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Category
                  <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="category">
                    <option value="announcement">Announcement</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="incident">Incident</option>
                    <option value="winner_post">Winner post</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Priority
                  <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="priority">
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Title
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" maxLength={140} name="title" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Summary
                <textarea className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" maxLength={280} name="summary" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Body
                <textarea className="min-h-36 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" maxLength={4000} name="body" required />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  CTA label
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="cta_label" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  CTA URL
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="cta_url" type="url" />
                </label>
              </div>
              <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink">
                <input name="publish_now" type="checkbox" />
                Publish immediately
              </label>
              <button className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" type="submit">
                Save announcement
              </button>
            </form>

            <div className="grid gap-3 rounded-md border border-line bg-white p-4">
              {announcements.length ? (
                announcements.map((item) => (
                  <div className="rounded-md border border-line bg-surfaceWarm p-4" key={item.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={item.status === "published" ? "success" : item.status === "archived" ? "danger" : "warning"}>{item.status}</Badge>
                      <Badge tone={item.priority === "critical" ? "danger" : item.priority === "high" ? "warning" : "cyan"}>{item.priority}</Badge>
                    </div>
                    <h3 className="mt-3 text-base font-black text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted">{item.summary}</p>
                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                      {new Date(item.published_at ?? item.created_at).toLocaleString("en-NG")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.status !== "published" ? (
                        <form action={publishAnnouncementAction}>
                          <input name="announcement_id" type="hidden" value={item.id} />
                          <button className="inline-flex min-h-9 items-center justify-center rounded-md border border-line bg-white px-3 text-xs font-black text-ink hover:bg-surfaceHigh" type="submit">
                            Publish
                          </button>
                        </form>
                      ) : null}
                      {item.status !== "archived" ? (
                        <form action={archiveAnnouncementAction}>
                          <input name="announcement_id" type="hidden" value={item.id} />
                          <button className="inline-flex min-h-9 items-center justify-center rounded-md border border-line bg-white px-3 text-xs font-black text-ink hover:bg-surfaceHigh" type="submit">
                            Archive
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <AdminEmptyState title="No platform announcements yet" description="Saved and published platform notices will appear here." />
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            description="Newest actionable items across the platform. Open the lane to make the decision with the right controls."
            eyebrow="Queue"
            title="Priority work"
          />
          {workItems.length ? (
            <DataTable
              columns={[
                {
                  key: "type",
                  label: "Case",
                  render: (row) => (
                    <div className="min-w-52">
                      <strong className="font-mono text-xs text-dim">{row.id}</strong>
                      <p className="mt-1 text-sm font-black text-ink">{row.type}</p>
                    </div>
                  )
                },
                { key: "room", label: "Room", render: (row) => <span className="font-mono text-xs font-bold text-ink">{row.room}</span> },
                { key: "actor", label: "Player", render: (row) => <span className="font-mono text-xs font-bold text-muted">{row.actor}</span> },
                { key: "amount", label: "Context", render: (row) => <span className="line-clamp-2 text-sm font-bold text-ink">{row.amount}</span> },
                { key: "priority", label: "Priority", render: (row) => <Badge tone={row.tone}>{row.priority}</Badge> },
                {
                  key: "href",
                  label: "Action",
                  render: (row) => (
                    <Link className="text-sm font-black text-cyan hover:text-action" href={row.href}>
                      Open lane
                    </Link>
                  )
                }
              ]}
              rows={workItems}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState
                description="There are no funding, result, settlement, refund, or risk items waiting for review right now."
                title="No open operator work"
              />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            description="Use scoped team roles for real operations: owner keeps full control, admins handle money movement, moderators handle evidence, and support handles notes."
            eyebrow="Access"
            title="Owner-controlled operations"
          />
          <div className="grid min-w-0 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Owner", "100%", "Full platform control"],
              ["Admin", "Money", "Funding, payouts, and refunds"],
              ["Moderator", "Results", "Evidence, disputes, and holds"],
              ["Support", "Assist", "Player context and notes"]
            ].map(([role, scope, detail]) => (
              <div className="rounded-md border border-line bg-white p-4" key={role}>
                <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{role}</span>
                <strong className="mt-2 block text-xl font-black text-ink">{scope}</strong>
                <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </AdminShell>
  );
}
