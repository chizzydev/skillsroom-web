import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStepUpPanel } from "@/components/admin/AdminStepUpPanel";
import { AdminShell } from "@/components/layout/AdminShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { listEvidenceRetentionReport } from "@/lib/evidence-storage";
import {
  getRiskDashboard,
  getDmAbuseQueue,
  listChatModerationQueue,
  listEvidenceAccessEvents,
  listModerationActions,
  listRiskFlags,
  listRoomHolds,
  type ChatModerationEvent,
  type ChatDmRequest,
  type ChatUserBlock,
  type ModerationAction,
  type RoomModerationHold,
  type SecurityEvent,
  type UserRiskFlag
} from "@/lib/match-room-api";
import {
  createModerationActionAction,
  createRiskFlagAction,
  createRoomHoldAction,
  deleteChatMessageAction,
  hideChatMessageAction,
  muteChatMemberAction,
  releaseRoomHoldAction,
  updateEvidenceDeletionAction,
  updateEvidenceLegalHoldAction,
  updateEvidenceQuarantineAction,
  updateRiskFlagStatusAction
} from "./actions";

export const dynamic = "force-dynamic";

function severityTone(severity: string) {
  if (severity === "critical" || severity === "high") return "danger" as const;
  if (severity === "medium") return "warning" as const;
  return "cyan" as const;
}

function countRows<T>(rows: T[]) {
  return rows.length.toString();
}

function displayLabel(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function metadataText(event: SecurityEvent, key: string) {
  const value = event.metadata?.[key];
  if (typeof value === "string" && value.length) return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function chatSenderLabel(event: ChatModerationEvent) {
  return event.sender_display_name || event.sender_username || event.target_user_id || "Skillsroom player";
}

type EvidenceReviewRow = {
  fileName: string;
  lastEventAt: string;
  context: string;
  uploader: string;
  retentionState: string;
  legalHold: boolean;
  eventCount: number;
  denialCount: number;
  exceptionCount: number;
  exportCount: number;
  chainReviewCount: number;
  verdict: "clean" | "review" | "exception";
};

function evidenceAction(event: SecurityEvent) {
  return event.event.replace("evidence.access.", "");
}

function evidenceReviewRows(events: SecurityEvent[]): EvidenceReviewRow[] {
  const byFile = new Map<string, SecurityEvent[]>();
  for (const event of events) {
    const fileName = metadataText(event, "file_name");
    if (!fileName || fileName === "unknown") continue;
    byFile.set(fileName, [...(byFile.get(fileName) ?? []), event]);
  }

  return Array.from(byFile.entries())
    .map(([fileName, fileEvents]) => {
      const sorted = [...fileEvents].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
      const latest = sorted[0]!;
      const actions = sorted.map(evidenceAction);
      const exceptionCount = actions.filter((action) => ["metadata_mismatch", "retention_expired", "invalid_request", "not_found"].includes(action)).length;
      const denialCount = actions.filter((action) => action === "denied").length;
      const exportCount = actions.filter((action) => action === "exported").length;
      const chainReviewCount = actions.filter((action) => action === "chain_reviewed").length;
      const legalHold = metadataText(latest, "legal_hold") === "true";
      const retentionState = metadataText(latest, "retention_state") ?? "unknown";
      const verdict: EvidenceReviewRow["verdict"] =
        exceptionCount > 0 ? "exception" : denialCount > 0 || chainReviewCount === 0 ? "review" : "clean";

      return {
        fileName,
        lastEventAt: latest.created_at,
        context: `${metadataText(latest, "context_type") ?? metadataText(latest, "storage") ?? "unknown"}:${metadataText(latest, "context_id") ?? "none"}`,
        uploader: latest.target_user_id ?? metadataText(latest, "uploaded_by_user_id") ?? "legacy",
        retentionState,
        legalHold,
        eventCount: sorted.length,
        denialCount,
        exceptionCount,
        exportCount,
        chainReviewCount,
        verdict
      };
    })
    .sort((left, right) => new Date(right.lastEventAt).getTime() - new Date(left.lastEventAt).getTime());
}

function reviewTone(verdict: EvidenceReviewRow["verdict"]) {
  if (verdict === "exception") return "danger" as const;
  if (verdict === "review") return "warning" as const;
  return "success" as const;
}

export default async function AdminRiskPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/risk");
  if (!canUseAdminSection(user, "risk")) redirect("/admin");
  const { error } = await searchParams;

  let flags: UserRiskFlag[] = [];
  let actions: ModerationAction[] = [];
  let holds: RoomModerationHold[] = [];
  let chatModerationEvents: ChatModerationEvent[] = [];
  let dmAbuseRequests: ChatDmRequest[] = [];
  let dmBlocks: ChatUserBlock[] = [];
  let evidenceEvents: SecurityEvent[] = [];
  let retentionReport: Awaited<ReturnType<typeof listEvidenceRetentionReport>> | null = null;
  let loadError: string | null = null;
  try {
    const [dashboard, flagResult, actionResult, holdResult, chatModerationResult, dmAbuseResult, evidenceEventResult, localRetentionReport] = await Promise.all([
      getRiskDashboard(),
      listRiskFlags("open"),
      listModerationActions(),
      listRoomHolds("active"),
      listChatModerationQueue(),
      getDmAbuseQueue(),
      listEvidenceAccessEvents(50),
      listEvidenceRetentionReport()
    ]);
    flags = flagResult.flags;
    actions = actionResult.actions;
    holds = holdResult.holds;
    chatModerationEvents = chatModerationResult.events;
    dmAbuseRequests = dmAbuseResult.requests;
    dmBlocks = dmAbuseResult.blocks;
    void dmAbuseResult.retention_policy;
    evidenceEvents = evidenceEventResult.events;
    retentionReport = localRetentionReport;
    void dashboard;
  } catch {
    loadError = "Unable to load the safety workspace.";
  }
  const evidenceReviews = evidenceReviewRows(evidenceEvents);
  const evidenceExceptions = evidenceReviews.filter((row) => row.verdict === "exception");
  const evidenceNeedsReview = evidenceReviews.filter((row) => row.verdict === "review");
  const evidenceLegalHolds = evidenceReviews.filter((row) => row.legalHold);
  const cleanupEligible = retentionReport?.summary.cleanupEligible ?? 0;
  const quarantinedEvidence = retentionReport?.summary.quarantined ?? 0;
  const deletionRequested = retentionReport?.summary.deletionRequested ?? 0;
  const deletionApproved = retentionReport?.summary.deletionApproved ?? 0;
  const deletedEvidence = retentionReport?.summary.deleted ?? 0;
  const canMakeFinalEvidenceDeletionDecision = user?.role === "admin" || user?.role === "owner";

  return (
    <AdminShell active="risk">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Review player reports, unsafe chat messages, blocked rooms, and evidence that needs attention."
          eyebrow="Safety"
          title="Player safety and moderation"
          tone="danger"
        />

        <LiveUpdateStream eventTypePrefixes={["admin.queue.risk.", "admin.queue.chat_moderation.", "match.hold.", "chat.message.", "chat.member."]} label="Safety updates" />

        {(error || loadError) && (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {error ?? loadError}
          </div>
        )}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Reports waiting" label="Player Reports" tone="danger" value={countRows(flags)} />
          <StatusPanel detail="Active room blocks" label="Room Holds" tone="warning" value={countRows(holds)} />
          <StatusPanel detail="Recent decisions" label="Actions" tone="cyan" value={countRows(actions)} />
          <StatusPanel detail="Reports and chat safety actions" label="Chat Queue" tone={chatModerationEvents.length ? "warning" : "success"} value={countRows(chatModerationEvents)} />
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusPanel detail="Metadata, retention, or missing-file exceptions" label="Custody Exceptions" tone={evidenceExceptions.length ? "danger" : "success"} value={countRows(evidenceExceptions)} />
          <StatusPanel detail="Needs custody review or has denials" label="Needs Review" tone={evidenceNeedsReview.length ? "warning" : "success"} value={countRows(evidenceNeedsReview)} />
          <StatusPanel detail="Files preserved beyond normal retention" label="Legal Hold" tone={evidenceLegalHolds.length ? "warning" : "neutral"} value={countRows(evidenceLegalHolds)} />
          <StatusPanel detail="Expired and eligible for quarantine" label="Cleanup Queue" tone={cleanupEligible ? "warning" : "success"} value={cleanupEligible.toString()} />
        </div>

        <Panel>
          <PanelHeader eyebrow="Chat Safety" title="Chat moderation queue" description="Review reported messages, hide or delete unsafe content, and mute users from a channel." />
          {chatModerationEvents.length ? (
            <DataTable
              columns={[
                { key: "created_at", label: "Created", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                { key: "event_type", label: "Type", render: (row) => <Badge tone={row.event_type === "message_reported" ? "warning" : "cyan"}>{displayLabel(row.event_type)}</Badge> },
                {
                  key: "message",
                  label: "Message",
                  render: (row) => (
                    <span className="grid gap-1">
                      <span className="text-sm font-bold text-ink [overflow-wrap:anywhere]">{row.message_body ?? "Message no longer visible"}</span>
                      <span className="text-xs font-bold text-muted">{row.channel_title ?? row.channel_slug ?? "Channel"} by {chatSenderLabel(row)}</span>
                    </span>
                  )
                },
                { key: "reason", label: "Reason", render: (row) => <span className="text-sm text-muted">{row.reason ?? "No reason supplied"}</span> },
                {
                  key: "actions",
                  label: "Actions",
                  render: (row) => (
                    <div className="grid min-w-[16rem] gap-2">
                      <form action={hideChatMessageAction} className="grid grid-cols-[1fr_auto] gap-2">
                        <input name="channel_slug" type="hidden" value={row.channel_slug ?? row.channel_id} />
                        <input name="message_id" type="hidden" value={row.message_id ?? ""} />
                        <input className="min-h-9 rounded-md border border-line bg-white px-2 text-xs outline-none focus:border-action" name="reason" placeholder="Hide reason" />
                        <FormActionButton disabled={!row.message_id || row.message_status !== "visible"} idleLabel="Hide" pendingLabel="Hiding..." size="sm" variant="secondary" />
                      </form>
                      <form action={deleteChatMessageAction} className="grid grid-cols-[1fr_auto] gap-2">
                        <input name="channel_slug" type="hidden" value={row.channel_slug ?? row.channel_id} />
                        <input name="message_id" type="hidden" value={row.message_id ?? ""} />
                        <input className="min-h-9 rounded-md border border-line bg-white px-2 text-xs outline-none focus:border-action" name="reason" placeholder="Delete reason" />
                        <FormActionButton disabled={!row.message_id || row.message_status === "deleted"} idleLabel="Delete" pendingLabel="Deleting..." size="sm" variant="danger" />
                      </form>
                      <form action={muteChatMemberAction} className="grid grid-cols-[1fr_5rem_auto] gap-2">
                        <input name="channel_slug" type="hidden" value={row.channel_slug ?? row.channel_id} />
                        <input name="user_id" type="hidden" value={row.target_user_id ?? ""} />
                        <input className="min-h-9 rounded-md border border-line bg-white px-2 text-xs outline-none focus:border-action" name="reason" placeholder="Mute reason" />
                        <input className="min-h-9 rounded-md border border-line bg-white px-2 text-xs outline-none focus:border-action" min={5} max={10080} name="duration_minutes" type="number" defaultValue={60} />
                        <FormActionButton disabled={!row.target_user_id} idleLabel="Mute" pendingLabel="Muting..." size="sm" variant="danger" />
                      </form>
                    </div>
                  )
                }
              ]}
              rows={chatModerationEvents}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState description="Reported chat messages and recent chat safety actions will appear here." title="Chat moderation queue is clear" />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Private DMs" title="DM abuse review" description="DMs are private. The team only reviews reports, blocks, and request history needed for safety decisions." />
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            <div className="grid gap-3">
              <h3 className="text-sm font-black text-ink">Recent DM requests</h3>
              {dmAbuseRequests.slice(0, 8).map((request) => (
                <div className="rounded-md border border-line bg-white p-3" key={request.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={request.status === "pending" ? "warning" : request.status === "accepted" ? "success" : "neutral"}>{request.status}</Badge>
                    <span className="text-xs font-bold text-muted">{new Date(request.created_at).toLocaleString("en-NG")}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-ink">{request.requester_label} to {request.recipient_label}</p>
                  {request.intro_message ? <p className="mt-1 text-sm text-muted">{request.intro_message}</p> : null}
                </div>
              ))}
              {!dmAbuseRequests.length ? <AdminEmptyState title="No DM requests" description="DM request metadata appears here for investigation." /> : null}
            </div>
            <div className="grid gap-3">
              <h3 className="text-sm font-black text-ink">User blocks</h3>
              {dmBlocks.slice(0, 8).map((block) => (
                <div className="rounded-md border border-line bg-white p-3" key={`${block.blocker_user_id}:${block.blocked_user_id}`}>
                  <p className="text-sm font-bold text-ink">{block.blocker_label} blocked {block.blocked_label}</p>
                  <p className="mt-1 text-xs font-bold text-muted">{new Date(block.created_at).toLocaleString("en-NG")}</p>
                  {block.reason ? <p className="mt-1 text-sm text-muted">{block.reason}</p> : null}
                </div>
              ))}
              {!dmBlocks.length ? <AdminEmptyState title="No user blocks" description="Blocks between users will appear here when there is something to review." /> : null}
            </div>
          </div>
          <div className="grid gap-2 border-t border-line p-4 text-sm text-muted">
            <p><strong className="text-ink">DM requests:</strong> Players can only start private DMs after the other person accepts.</p>
            <p><strong className="text-ink">Message access:</strong> The team does not browse private chats. Reports and safety cases show only the details needed for review.</p>
            <p><strong className="text-ink">Abuse records:</strong> Reports, blocks, and safety actions are kept so repeated abuse can be investigated.</p>
          </div>
        </Panel>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusPanel detail="Temporarily hidden from normal access" label="Held evidence" tone={quarantinedEvidence ? "warning" : "neutral"} value={quarantinedEvidence.toString()} />
          <StatusPanel detail="Waiting for another team member" label="Delete Requests" tone={deletionRequested ? "warning" : "neutral"} value={deletionRequested.toString()} />
          <StatusPanel detail="Ready for final deletion" label="Delete Approved" tone={deletionApproved ? "danger" : "neutral"} value={deletionApproved.toString()} />
          <StatusPanel detail="File removed, record kept" label="Deleted Media" tone={deletedEvidence ? "danger" : "neutral"} value={deletedEvidence.toString()} />
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Reports" title="Player reports" description="Support can view reports. Community managers can create and update them." />
            {flags.length ? (
              <DataTable
                columns={[
                  { key: "created_at", label: "Created", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                  { key: "user_id", label: "User", render: (row) => <span className="font-bold text-ink">{row.user_id}</span> },
                  { key: "flag_type", label: "Type", render: (row) => <span className="font-mono text-xs font-bold text-muted">{row.flag_type}</span> },
                  { key: "severity", label: "Severity", render: (row) => <Badge tone={severityTone(row.severity)}>{row.severity}</Badge> },
                  { key: "summary", label: "Summary", render: (row) => <span className="text-muted">{row.summary}</span> }
                ]}
                rows={flags}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState description="No player report is waiting for review right now." title="Player reports are clear" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="New Report" title="Add player report" />
            <form action={createRiskFlagAction} className="grid gap-3 p-4">
              <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="user_id" placeholder="User ID" required />
              <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="flag_type" placeholder="duplicate_account" required />
              <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="severity">
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
                <option value="low">Low</option>
              </select>
              <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="summary" placeholder="What happened?" required />
              <FormActionButton idleLabel="Create flag" pendingLabel="Creating flag..." />
            </form>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Room Holds" title="Active held rooms" description="Held rooms should not be paid out until a team member releases the hold." />
            {holds.length ? (
              <DataTable
                columns={[
                  { key: "created_at", label: "Created", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                  { key: "match_room_id", label: "Room", render: (row) => <span className="font-mono text-xs font-bold text-ink">{row.match_room_id}</span> },
                  { key: "severity", label: "Severity", render: (row) => <Badge tone={severityTone(row.severity)}>{row.severity}</Badge> },
                  { key: "reason", label: "Reason", render: (row) => <span className="text-muted">{row.reason}</span> },
                  { key: "id", label: "Hold ID", render: (row) => <span className="font-mono text-xs text-muted">{row.id}</span> }
                ]}
                rows={holds}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState description="No room is currently blocked by an active moderation hold." title="No active room holds" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Hold Room" title="Create or release hold" />
            <div className="grid gap-4 p-4">
              <form action={createRoomHoldAction} className="grid gap-3">
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="match_room_id" placeholder="Match room ID" required />
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="severity">
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                  <option value="low">Low</option>
                </select>
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="reason" placeholder="Hold reason" required />
                <FormActionButton idleLabel="Hold room" pendingLabel="Holding room..." variant="danger" />
              </form>
              <form action={releaseRoomHoldAction} className="grid gap-3 border-t border-line pt-4">
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="hold_id" placeholder="Hold ID" required />
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="release_note" placeholder="Release note" />
                <FormActionButton idleLabel="Release hold" pendingLabel="Releasing hold..." variant="secondary" />
              </form>
            </div>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
          <PanelHeader eyebrow="History" title="Recent moderation actions" />
            {actions.length ? (
              <DataTable
                columns={[
                  { key: "created_at", label: "Created", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                  { key: "action_type", label: "Action", render: (row) => <Badge tone={row.action_type === "ban" ? "danger" : "warning"}>{displayLabel(row.action_type)}</Badge> },
                  { key: "target_user_id", label: "Target", render: (row) => <span className="font-mono text-xs text-muted">{row.target_user_id ?? row.match_room_id}</span> },
                  { key: "summary", label: "Summary", render: (row) => <span className="text-muted">{row.summary}</span> }
                ]}
                rows={actions}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState description="No moderation action has been recorded for the current queue." title="No recent moderation actions" />
              </div>
            )}
          </Panel>

          <div className="grid gap-4">
            <AdminStepUpPanel returnTo="/admin/risk" />
            <Panel>
              <PanelHeader eyebrow="Action" title="Apply account moderation" description="Restrictions, suspensions, and bans use the active unlock on this session." />
              <form action={createModerationActionAction} className="grid gap-3 p-4">
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="target_user_id" placeholder="Target user ID" />
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="match_room_id" placeholder="Optional room ID" />
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="action_type">
                  <option value="warn">Warn</option>
                  <option value="restrict">Restrict</option>
                  <option value="suspend">Suspend</option>
                  <option value="ban">Ban</option>
                  <option value="note">Note</option>
                </select>
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="severity">
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                  <option value="low">Low</option>
                </select>
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="summary" placeholder="Reason and team note" required />
                <FormActionButton idleLabel="Apply moderation" pendingLabel="Applying moderation..." variant="danger" />
              </form>
            </Panel>
          </div>
        </div>

        <Panel>
          <PanelHeader eyebrow="Evidence Review" title="Evidence review" description="Files that may need extra attention before they are used, hidden, exported, or removed." />
          {evidenceReviews.length ? (
            <DataTable
              columns={[
                { key: "lastEventAt", label: "Last Event", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.lastEventAt).toLocaleString("en-NG")}</span> },
                {
                  key: "verdict",
                  label: "Verdict",
                  render: (row) => <Badge tone={reviewTone(row.verdict)}>{displayLabel(row.verdict)}</Badge>
                },
                {
                  key: "fileName",
                  label: "File",
                  render: (row) => (
                    <span className="grid gap-1">
                      <span className="font-mono text-xs font-bold text-ink [overflow-wrap:anywhere]">{row.fileName}</span>
                      <span className="text-xs font-bold text-muted">{row.context}</span>
                    </span>
                  )
                },
                { key: "uploader", label: "Uploader", render: (row) => <span className="font-mono text-xs text-muted">{row.uploader}</span> },
                {
                  key: "retention",
                  label: "Retention",
                  render: (row) => (
                    <span className="grid gap-1">
                      <Badge tone={row.retentionState === "expired" ? "danger" : row.retentionState === "legal_hold" ? "warning" : "cyan"}>{displayLabel(row.retentionState)}</Badge>
                      <span className="text-xs font-bold text-muted">{row.legalHold ? "Legal hold active" : "No legal hold"}</span>
                    </span>
                  )
                },
                {
                  key: "signals",
                  label: "Signals",
                  render: (row) => (
                    <span className="grid gap-1 text-xs font-bold text-muted">
                      <span>{row.eventCount} events</span>
                      <span>{row.denialCount} denials</span>
                      <span>{row.exceptionCount} exceptions</span>
                      <span>{row.chainReviewCount} reviews</span>
                    </span>
                  )
                },
                {
                  key: "actions",
                  label: "Actions",
                  render: (row) => (
                    <span className="flex flex-wrap gap-2">
                      <a className="rounded-md border border-line bg-white px-3 py-2 text-xs font-black text-ink shadow-tight hover:bg-surfaceHigh" href={`/api/evidence-chain?file_name=${encodeURIComponent(row.fileName)}`}>Review</a>
                      <a className="rounded-md border border-line bg-white px-3 py-2 text-xs font-black text-ink shadow-tight hover:bg-surfaceHigh" href={`/api/evidence-export?file_name=${encodeURIComponent(row.fileName)}`}>Export</a>
                    </span>
                  )
                }
              ]}
              rows={evidenceReviews}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState description="Evidence files will appear here after users open, upload, review, export, or place evidence under legal hold." title="No evidence files in review yet" />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Evidence History" title="Recent evidence activity" />
          {evidenceEvents.length ? (
            <DataTable
              columns={[
                { key: "created_at", label: "Created", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                { key: "event", label: "Event", render: (row) => <Badge tone={row.severity === "warning" ? "warning" : "cyan"}>{displayLabel(row.event.replace("evidence.access.", ""))}</Badge> },
                { key: "actor_user_id", label: "Actor", render: (row) => <span className="font-mono text-xs text-muted">{row.actor_user_id ?? "unknown"}</span> },
                { key: "target_user_id", label: "Uploader", render: (row) => <span className="font-mono text-xs text-muted">{row.target_user_id ?? "legacy"}</span> },
                {
                  key: "context",
                  label: "Context",
                  render: (row) => (
                    <span className="font-mono text-xs text-muted">
                      {metadataText(row, "context_type") ?? metadataText(row, "storage") ?? "unknown"}:{metadataText(row, "context_id") ?? "none"}
                    </span>
                  )
                },
                {
                  key: "file",
                  label: "File / Reason",
                  render: (row) => (
                    <span className="grid min-w-0 gap-1">
                      <span className="font-mono text-xs text-ink [overflow-wrap:anywhere]">{metadataText(row, "file_name") ?? "unknown"}</span>
                      <span className="text-xs font-bold text-muted">{metadataText(row, "reason") ?? row.event}</span>
                    </span>
                  )
                }
              ]}
              rows={evidenceEvents}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState description="Evidence opens, denials, metadata mismatches, and missing-file attempts will appear here." title="No evidence access events yet" />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Evidence Cleanup" title="Cleanup and quarantine queue" description="Expired hardened files without legal hold can be moved out of active serving. Metadata-error rows require manual review before action." />
          {retentionReport?.entries.length ? (
            <DataTable
              columns={[
                { key: "fileName", label: "File", render: (row) => <span className="font-mono text-xs font-bold text-ink [overflow-wrap:anywhere]">{row.fileName}</span> },
                { key: "state", label: "Retention", render: (row) => <Badge tone={row.state === "expired" ? "danger" : row.state === "legal_hold" ? "warning" : row.state === "metadata_error" ? "danger" : "cyan"}>{displayLabel(row.state)}</Badge> },
                { key: "cleanupStatus", label: "Cleanup", render: (row) => <Badge tone={row.cleanupStatus === "quarantined" ? "warning" : row.cleanupEligible ? "danger" : "neutral"}>{displayLabel(row.cleanupStatus)}</Badge> },
                { key: "retainUntil", label: "Retain Until", render: (row) => <span className="font-mono text-xs text-muted">{row.retainUntil ? new Date(row.retainUntil).toLocaleString("en-NG") : "manual review"}</span> },
                { key: "legalHold", label: "Hold", render: (row) => <span className="text-xs font-bold text-muted">{row.legalHold ? "Legal hold active" : "No legal hold"}</span> },
                {
                  key: "deletion",
                  label: "Deletion",
                  render: (row) => (
                    <span className="grid gap-1 text-xs font-bold text-muted">
                      <span>{row.deletionRequestedAt ? `Requested ${new Date(row.deletionRequestedAt).toLocaleString("en-NG")}` : row.deletionEligible ? "Eligible after request" : "Not eligible"}</span>
                      <span>{row.deletionApprovedAt ? `Approved ${new Date(row.deletionApprovedAt).toLocaleString("en-NG")}` : "No approval"}</span>
                      <span>{row.deletedAt ? `Deleted ${new Date(row.deletedAt).toLocaleString("en-NG")}` : "Media retained"}</span>
                    </span>
                  )
                },
                { key: "quarantineObjectKey", label: "Object", render: (row) => <span className="font-mono text-xs text-muted [overflow-wrap:anywhere]">{row.deletedObjectKey ?? row.quarantineObjectKey ?? row.cleanupReason ?? "none"}</span> }
              ]}
              rows={retentionReport.entries}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState description="No hardened evidence sidecars are currently present in local storage." title="Cleanup queue is clear" />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Evidence Hold" title="Hide or restore evidence" description="Use this when a file should be temporarily removed from normal access while review continues." />
          <form action={updateEvidenceQuarantineAction} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_minmax(0,1fr)_auto]">
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
              name="evidence_file_name"
              placeholder="evidence-v1_...png"
              required
            />
            <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="quarantine_action">
              <option value="quarantine">Quarantine</option>
              <option value="restore">Restore</option>
            </select>
            <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="quarantine_reason">
              <option value="retention_expired">Expired</option>
              <option value="operator_quarantine">Team review</option>
            </select>
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
              name="quarantine_note"
              placeholder="Retention cleanup, incident review, mistaken quarantine restore"
              required
            />
            <FormActionButton idleLabel="Save quarantine" pendingLabel="Saving quarantine..." variant="danger" />
          </form>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Evidence Deletion"
            title={canMakeFinalEvidenceDeletionDecision ? "Request or complete permanent deletion" : "Request evidence deletion"}
            description={
              canMakeFinalEvidenceDeletionDecision
                ? "Permanent deletion requires a prior hold, expiry, no legal hold, another team member's approval, and final confirmation."
                : "Use this to ask for expired or unsafe evidence to be removed. An admin or owner must make the final deletion decision."
            }
          />
          <form action={updateEvidenceDeletionAction} className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)_180px_auto]">
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
              name="evidence_file_name"
              placeholder="evidence-v1_...png"
              required
            />
            <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="deletion_action">
              <option value="request">Request</option>
              {canMakeFinalEvidenceDeletionDecision ? <option value="approve">Approve</option> : null}
              {canMakeFinalEvidenceDeletionDecision ? <option value="reject">Reject</option> : null}
              {canMakeFinalEvidenceDeletionDecision ? <option value="delete">Delete</option> : null}
            </select>
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
              name="deletion_note"
              placeholder="Retention expiry, reconciliation checked, approval note"
              required
            />
            {canMakeFinalEvidenceDeletionDecision ? (
              <input
                className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
                name="deletion_confirmation"
                placeholder="DELETE EVIDENCE"
              />
            ) : null}
            <FormActionButton idleLabel="Save deletion" pendingLabel="Saving deletion..." variant="danger" />
          </form>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Evidence Hold" title="Apply or release legal hold" description="Use for disputes, abuse investigations, payout reconciliation, or regulator-sensitive proof." />
          <form action={updateEvidenceLegalHoldAction} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)_auto]">
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
              name="evidence_file_name"
              placeholder="evidence-v1_...png"
              required
            />
            <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="legal_hold_action">
              <option value="apply">Apply hold</option>
              <option value="release">Release hold</option>
            </select>
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
              name="legal_hold_reason"
              placeholder="Dispute, payout review, abuse investigation"
              required
            />
            <FormActionButton idleLabel="Save hold" pendingLabel="Saving hold..." variant="secondary" />
          </form>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Evidence Export" title="Download evidence package" description="Downloads the file record, review details, retention status, and related history." />
          <form action="/api/evidence-export" className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]" method="get">
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
              name="file_name"
              placeholder="evidence-v1_...png"
              required
            />
            <FormActionButton idleLabel="Export package" pendingLabel="Exporting package..." variant="secondary" />
          </form>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Evidence Check" title="Review evidence history" description="Checks the file record, retention status, legal hold history, and related activity." />
          <form action="/api/evidence-chain" className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]" method="get">
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
              name="file_name"
              placeholder="evidence-v1_...png"
              required
            />
            <FormActionButton idleLabel="Review custody" pendingLabel="Reviewing custody..." variant="secondary" />
          </form>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Flag Status" title="Update flag status" />
          <form action={updateRiskFlagStatusAction} className="grid gap-3 p-4 md:grid-cols-[1fr_220px_auto]">
            <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="flag_id" placeholder="Report ID" required />
            <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="status">
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
              <option value="open">Open</option>
            </select>
            <FormActionButton idleLabel="Update flag" pendingLabel="Updating flag..." variant="secondary" />
          </form>
        </Panel>
      </section>
    </AdminShell>
  );
}
