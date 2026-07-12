import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminQueueCard } from "@/components/admin/AdminQueueCard";
import { AdminShell } from "@/components/layout/AdminShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
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
import { archiveAnnouncementAction, createChatChannelAction, createPlatformAnnouncementAction, publishAnnouncementAction } from "./actions";

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

function scoreSummaryLabel(value: string | null | undefined) {
  return value && value.trim().length ? value : "No score line supplied";
}

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
    amount: scoreSummaryLabel(row.score_summary),
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
    type: "Player safety flag",
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
    actor: "Skillsroom team",
    amount: row.reason,
    priority: row.severity,
    tone: row.severity === "critical" || row.severity === "high" ? "danger" : "warning",
    href: "/admin/risk"
  };
}

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; announcement_saved?: string; announcement_published?: string; announcement_archived?: string; channel_saved?: string }>;
}) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) {
    redirect("/sign-in?redirect=/admin");
  }
  const { error, announcement_saved: announcementSaved, announcement_published: announcementPublished, announcement_archived: announcementArchived, channel_saved: channelSaved } = await searchParams;

  let funding: ManualFundingSubmission[] = [];
  let results: MatchResultClaim[] = [];
  let settlements: MatchSettlement[] = [];
  let payouts: MatchPayout[] = [];
  let refunds: MatchRefund[] = [];
  let flags: UserRiskFlag[] = [];
  let holds: RoomModerationHold[] = [];
  let announcements: CommunityAnnouncement[] = [];
  const loadErrors: string[] = [];
  const canSeeFunding = canUseAdminSection(user, "funding");
  const canSeeResults = canUseAdminSection(user, "results");
  const canSeeSettlements = canUseAdminSection(user, "settlements");
  const canSeeRisk = canUseAdminSection(user, "risk");
  const canManageCommunity = user?.role === "owner" || user?.role === "admin";
  const canSeeTeamGuide = user?.role === "owner";
  const headerCopy =
    user?.role === "moderator"
      ? {
          eyebrow: "Community",
          title: "Community manager workspace",
          description: "Review match results, player handles, tournament activity, and safety reports from one place.",
          actionHref: "/admin/results",
          actionLabel: "Review results",
          pendingLabel: "Opening results..."
        }
      : user?.role === "support"
        ? {
            eyebrow: "Support",
            title: "Support workspace",
            description: "Check player records and safety context without seeing money or owner-only controls.",
            actionHref: "/admin/players",
            actionLabel: "Review players",
            pendingLabel: "Opening players..."
          }
        : {
            eyebrow: "Admin",
            title: "Admin dashboard",
            description: "Review payments, match results, refunds, player reports, and support items from one place.",
            actionHref: canSeeFunding ? "/admin/funding" : "/admin/results",
            actionLabel: canSeeFunding ? "Review funding" : "Review results",
            pendingLabel: canSeeFunding ? "Opening funding..." : "Opening results..."
          };
  const roleBoundaryCards = [
    user?.role === "owner" ? ["Owner", "Full", "Full platform control, team roles, money, safety, and public operations."] : null,
    user?.role === "admin" || user?.role === "owner" ? ["Admin", "Money", "Funding, wallet top-ups, payouts, refunds, tournaments, and result support."] : null,
    user?.role === "moderator" || user?.role === "owner" ? ["Community Manager", "Community", "Result evidence, disputes, room holds, player trust, and tournament moderation."] : null,
    user?.role === "support" || user?.role === "owner" ? ["Support", "Assist", "Player context, support notes, and safe visibility into reports."] : null
  ].filter((item): item is [string, string, string] => Boolean(item));

  if (canSeeFunding) {
    try {
      const fundingResult = await listFundingSubmissions("submitted");
      funding = fundingResult.submissions;
    } catch {
      loadErrors.push("Funding queue could not be loaded.");
    }
  }

  if (canSeeResults) {
    try {
      const resultClaims = await listResultClaims("submitted");
      results = resultClaims.claims;
    } catch {
      loadErrors.push("Result review queue could not be loaded.");
    }
  }

  if (canSeeSettlements) {
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
      loadErrors.push("Payment queue could not be loaded.");
    }
  }

  if (canSeeRisk) {
    try {
      const [flagResult, holdResult] = await Promise.all([listRiskFlags("open"), listRoomHolds("active")]);
      flags = flagResult.flags;
      holds = holdResult.holds;
    } catch {
      loadErrors.push("Safety queue could not be loaded.");
    }
  }

  if (canManageCommunity) {
    try {
      const announcementResult = await listManageableAnnouncements({ scope: "platform", limit: 8 });
      announcements = announcementResult.announcements;
    } catch {
      loadErrors.push("Community publishing tools could not be loaded.");
    }
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
            <PendingLink
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink transition hover:border-cyan"
              href={headerCopy.actionHref}
              pendingLabel={headerCopy.pendingLabel}
            >
              {headerCopy.actionLabel}
            </PendingLink>
          }
          description={headerCopy.description}
          eyebrow={headerCopy.eyebrow}
          title={headerCopy.title}
        />

        <LiveUpdateStream eventTypePrefixes={["admin.queue.", "match.", "tournament.", "notification."]} label="Live updates" />

        {error ? <TransientStatusBanner clearKeys={["error"]} durationMs={12000} message={error} /> : null}
        {announcementSaved ? <TransientStatusBanner clearKeys={["announcement_saved"]} durationMs={12000} message="Platform announcement saved." tone="success" /> : null}
        {announcementPublished ? <TransientStatusBanner clearKeys={["announcement_published"]} durationMs={12000} message="Announcement published." tone="success" /> : null}
        {announcementArchived ? <TransientStatusBanner clearKeys={["announcement_archived"]} durationMs={12000} message="Announcement archived." tone="success" /> : null}
        {channelSaved ? <TransientStatusBanner clearKeys={["channel_saved"]} durationMs={12000} message="Community channel saved." tone="success" /> : null}
        {loadErrors.length ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadErrors.join(" ")}</div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {canSeeFunding ? <AdminQueueCard detail="Manual transfers waiting for approval." href="/admin/funding" label="Funding" tone="warning" value={funding.length.toString()} /> : null}
          {canSeeResults ? <AdminQueueCard detail="Score claims and match proof waiting for review." href="/admin/results" label="Results" tone="cyan" value={results.length.toString()} /> : null}
          {canSeeSettlements ? <AdminQueueCard detail="Winner payouts and player refunds waiting for payment." href="/admin/settlements" label="Payments" tone="success" value={(payouts.length + refunds.length).toString()} /> : null}
          {canSeeRisk ? <AdminQueueCard detail="Player reports and room holds waiting for review." href="/admin/risk" label="Safety" tone="danger" value={(flags.length + holds.length).toString()} /> : null}
        </div>

        <Panel>
          <PanelHeader
            description="Newest items you are allowed to review. Open a section when you are ready to handle it."
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
                    <PendingLink className="text-sm font-black text-cyan hover:text-action" href={row.href} pendingLabel="Opening area...">
                      Open area
                    </PendingLink>
                  )
                }
              ]}
              rows={workItems}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState
                description={user?.role === "moderator" ? "There are no result claims, player checks, tournament items, or safety reports waiting right now." : "There are no payments, results, refunds, or player reports waiting for review right now."}
                title="Nothing waiting right now"
              />
            </div>
          )}
        </Panel>

        {canManageCommunity ? (
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
                Summary <span className="text-xs font-bold text-muted">(optional)</span>
                <textarea className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" maxLength={280} name="summary" placeholder="Leave blank to use the start of the body." />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Body
                <textarea className="min-h-36 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" maxLength={4000} name="body" required />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  CTA label <span className="text-xs font-bold text-muted">(optional)</span>
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="cta_label" placeholder="Example: Read more" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  CTA URL <span className="text-xs font-bold text-muted">(optional)</span>
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="cta_url" placeholder="Add only if the announcement needs a button." type="url" />
                </label>
              </div>
              <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink">
                <input name="publish_now" type="checkbox" />
                Publish immediately
              </label>
              <FormActionButton idleLabel="Save announcement" pendingLabel="Saving announcement..." />
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
                          <FormActionButton className="text-xs" idleLabel="Publish" pendingLabel="Publishing..." size="sm" variant="secondary" />
                        </form>
                      ) : null}
                      {item.status !== "archived" ? (
                        <form action={archiveAnnouncementAction}>
                          <input name="announcement_id" type="hidden" value={item.id} />
                          <FormActionButton className="text-xs" idleLabel="Archive" pendingLabel="Archiving..." size="sm" variant="secondary" />
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
        ) : null}

        {canManageCommunity ? (
        <Panel>
          <PanelHeader
            description="Create broad community channels, or ensure game, tournament, and room-linked channels for the signed-in channel list."
            eyebrow="Channels"
            title="Community channel setup"
          />
          <form action={createChatChannelAction} className="grid gap-3 p-4 xl:grid-cols-[180px_minmax(0,1fr)_160px_minmax(0,1fr)_auto]">
            <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="channel_type">
              <option value="group">Community</option>
              <option value="game">Game</option>
              <option value="tournament">Tournament</option>
              <option value="match_room">Room</option>
            </select>
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="title" placeholder="Channel title" />
            <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="visibility">
              <option value="public">Public</option>
              <option value="members">Members</option>
              <option value="private">Private</option>
            </select>
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="description" placeholder="Description" />
            <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action xl:col-span-2" name="slug" placeholder="Optional slug" />
            <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="game_slug" placeholder="game slug" />
            <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="tournament_id" placeholder="tournament id" />
            <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="match_room_id" placeholder="room id" />
            <FormActionButton className="xl:col-start-5" fullWidth idleLabel="Save channel" pendingLabel="Saving..." />
          </form>
        </Panel>
        ) : null}

        {canSeeTeamGuide ? (
        <Panel>
          <PanelHeader
            description="Owner-only reference for what each team role can access."
            eyebrow="Team access"
            title="Role guide"
          />
          <div className="grid min-w-0 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {roleBoundaryCards.map(([role, scope, detail]) => (
              <div className="rounded-md border border-line bg-white p-4" key={role}>
                <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{role}</span>
                <strong className="mt-2 block text-xl font-black text-ink">{scope}</strong>
                <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
              </div>
            ))}
          </div>
        </Panel>
        ) : null}
      </section>
    </AdminShell>
  );
}
