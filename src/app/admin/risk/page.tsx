import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminShell } from "@/components/layout/AdminShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth-bridge";
import { listEvidenceRetentionReport } from "@/lib/evidence-storage";
import {
  getRiskDashboard,
  listEvidenceAccessEvents,
  listModerationActions,
  listRiskFlags,
  listRoomHolds,
  type ModerationAction,
  type RoomModerationHold,
  type SecurityEvent,
  type UserRiskFlag
} from "@/lib/match-room-api";
import {
  createModerationActionAction,
  createRiskFlagAction,
  createRoomHoldAction,
  releaseRoomHoldAction,
  updateEvidenceDeletionAction,
  updateEvidenceLegalHoldAction,
  updateEvidenceQuarantineAction,
  updateRiskFlagStatusAction
} from "./actions";

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
  const { error } = await searchParams;

  let flags: UserRiskFlag[] = [];
  let actions: ModerationAction[] = [];
  let holds: RoomModerationHold[] = [];
  let evidenceEvents: SecurityEvent[] = [];
  let retentionReport: Awaited<ReturnType<typeof listEvidenceRetentionReport>> | null = null;
  let loadError: string | null = null;
  try {
    const [dashboard, flagResult, actionResult, holdResult, evidenceEventResult, localRetentionReport] = await Promise.all([
      getRiskDashboard(),
      listRiskFlags("open"),
      listModerationActions(),
      listRoomHolds("active"),
      listEvidenceAccessEvents(50),
      listEvidenceRetentionReport()
    ]);
    flags = flagResult.flags;
    actions = actionResult.actions;
    holds = holdResult.holds;
    evidenceEvents = evidenceEventResult.events;
    retentionReport = localRetentionReport;
    void dashboard;
  } catch {
    loadError = "Unable to load risk dashboard.";
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

  return (
    <AdminShell active="risk">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Track suspicious players, hold risky rooms, and apply scoped restrictions with an audit trail."
          eyebrow="Risk Ops"
          title="Risk and Moderation"
          tone="danger"
        />

        <LiveUpdateStream eventTypePrefixes={["admin.queue.risk.", "match.hold."]} label="Risk live" />

        {(error || loadError) && (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {error ?? loadError}
          </div>
        )}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Open queue" label="Risk Flags" tone="danger" value={countRows(flags)} />
          <StatusPanel detail="Active room blocks" label="Room Holds" tone="warning" value={countRows(holds)} />
          <StatusPanel detail="Recent audit trail" label="Actions" tone="cyan" value={countRows(actions)} />
          <StatusPanel detail="Grouped evidence files" label="Evidence Review" tone={evidenceExceptions.length ? "danger" : evidenceNeedsReview.length ? "warning" : "cyan"} value={countRows(evidenceReviews)} />
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusPanel detail="Metadata, retention, or missing-file exceptions" label="Custody Exceptions" tone={evidenceExceptions.length ? "danger" : "success"} value={countRows(evidenceExceptions)} />
          <StatusPanel detail="Needs custody review or has denials" label="Needs Review" tone={evidenceNeedsReview.length ? "warning" : "success"} value={countRows(evidenceNeedsReview)} />
          <StatusPanel detail="Files preserved beyond normal retention" label="Legal Hold" tone={evidenceLegalHolds.length ? "warning" : "neutral"} value={countRows(evidenceLegalHolds)} />
          <StatusPanel detail="Expired and eligible for quarantine" label="Cleanup Queue" tone={cleanupEligible ? "warning" : "success"} value={cleanupEligible.toString()} />
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusPanel detail="Moved out of active serving" label="Quarantined" tone={quarantinedEvidence ? "warning" : "neutral"} value={quarantinedEvidence.toString()} />
          <StatusPanel detail="Awaiting second operator" label="Delete Requests" tone={deletionRequested ? "warning" : "neutral"} value={deletionRequested.toString()} />
          <StatusPanel detail="Ready for final operator" label="Delete Approved" tone={deletionApproved ? "danger" : "neutral"} value={deletionApproved.toString()} />
          <StatusPanel detail="Media deleted, tombstone kept" label="Deleted Media" tone={deletedEvidence ? "danger" : "neutral"} value={deletedEvidence.toString()} />
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Flags" title="Open risk flags" description="Support can view, moderators can create and update flags." />
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
                <AdminEmptyState description="No open player risk flag is currently waiting for review." title="Risk flag queue is clear" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Create Flag" title="Add player risk flag" />
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
              <Button type="submit">Create flag</Button>
            </form>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Room Holds" title="Active held rooms" description="Held rooms should not be settled until an operator releases the hold." />
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
                <Button type="submit" variant="danger">Hold room</Button>
              </form>
              <form action={releaseRoomHoldAction} className="grid gap-3 border-t border-line pt-4">
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="hold_id" placeholder="Hold ID" required />
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="release_note" placeholder="Release note" />
                <Button type="submit" variant="secondary">Release hold</Button>
              </form>
            </div>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Audit" title="Recent moderation actions" />
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

          <Panel>
            <PanelHeader eyebrow="Action" title="Apply account moderation" description="Restrictions, suspensions, and bans require admin step-up." />
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
              <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="summary" placeholder="Reason and operator note" required />
              <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="step_up_token" placeholder="Step-up token" required />
              <Button type="submit" variant="danger">Apply moderation</Button>
            </form>
          </Panel>
        </div>

        <Panel>
          <PanelHeader eyebrow="Evidence Review" title="Evidence admin review dashboard" description="Grouped view of files, retention state, legal hold, access denials, custody exceptions, and operator package actions." />
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
          <PanelHeader eyebrow="Evidence Audit" title="Recent evidence access events" />
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
          <PanelHeader eyebrow="Evidence Quarantine" title="Quarantine or restore evidence" description="Quarantine moves media out of active serving while preserving the sidecar, audit trail, and restore path." />
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
              <option value="operator_quarantine">Operator review</option>
            </select>
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
              name="quarantine_note"
              placeholder="Retention cleanup, incident review, mistaken quarantine restore"
              required
            />
            <Button type="submit" variant="danger">Save quarantine</Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Evidence Deletion" title="Request or execute permanent media deletion" description="Permanent deletion requires quarantine, expiry, no legal hold, a second-operator approval, and a final third-operator execution." />
          <form action={updateEvidenceDeletionAction} className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)_180px_auto]">
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
              name="evidence_file_name"
              placeholder="evidence-v1_...png"
              required
            />
            <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="deletion_action">
              <option value="request">Request</option>
              <option value="approve">Approve</option>
              <option value="reject">Reject</option>
              <option value="delete">Delete</option>
            </select>
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
              name="deletion_note"
              placeholder="Retention expiry, reconciliation checked, approval note"
              required
            />
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
              name="deletion_confirmation"
              placeholder="DELETE EVIDENCE"
            />
            <Button type="submit" variant="danger">Save deletion</Button>
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
            <Button type="submit" variant="secondary">Save hold</Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Evidence Export" title="Download evidence package" description="Creates a JSON manifest with sidecar metadata, retention state, integrity checks, and matching audit events." />
          <form action="/api/evidence-export" className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]" method="get">
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
              name="file_name"
              placeholder="evidence-v1_...png"
              required
            />
            <Button type="submit" variant="secondary">Export package</Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Custody Review" title="Review evidence chain of custody" description="Generates a verdict, integrity findings, retention status, legal-hold history, and audit timeline." />
          <form action="/api/evidence-chain" className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]" method="get">
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
              name="file_name"
              placeholder="evidence-v1_...png"
              required
            />
            <Button type="submit" variant="secondary">Review custody</Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Flag Status" title="Update flag status" />
          <form action={updateRiskFlagStatusAction} className="grid gap-3 p-4 md:grid-cols-[1fr_220px_auto]">
            <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="flag_id" placeholder="Risk flag ID" required />
            <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="status">
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
              <option value="open">Open</option>
            </select>
            <Button type="submit" variant="secondary">Update flag</Button>
          </form>
        </Panel>
      </section>
    </AdminShell>
  );
}
