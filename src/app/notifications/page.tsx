import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getCurrentUser } from "@/lib/auth-bridge";
import {
  formatEntryAmount,
  getNotificationPreferences,
  listDmRequests,
  listNotifications,
  listRoomInvites,
  type ChatDmRequest,
  type NotificationPreference,
  type RoomInvite,
  type UserNotification
} from "@/lib/match-room-api";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  respondToDmRequestAction,
  respondToRoomInviteAction,
  updateNotificationPreferencesAction
} from "./actions";

function inviteSender(invite: RoomInvite) {
  return invite.inviter_display_name || invite.inviter_username || "A Skillsroom player";
}

function inviteEntry(invite: RoomInvite) {
  if (!invite.currency || typeof invite.entry_amount_minor !== "number") return "Entry amount unavailable";
  return formatEntryAmount({ currency: invite.currency, entry_amount_minor: invite.entry_amount_minor });
}

function dmRequester(request: ChatDmRequest) {
  return request.requester_label || request.requester_display_name || request.requester_username || "A Skillsroom player";
}

function dmRecipient(request: ChatDmRequest) {
  return request.recipient_label || request.recipient_display_name || request.recipient_username || "A Skillsroom player";
}

function dmHandle(username?: string | null) {
  return username ? `@${username}` : "@skillsroom";
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/notifications");
  const { error } = await searchParams;

  let notifications: UserNotification[] = [];
  let invites: RoomInvite[] = [];
  let dmRequests: ChatDmRequest[] = [];
  let preferences: NotificationPreference | null = null;
  let loadError: string | null = null;
  try {
    const [notificationResult, inviteResult, dmRequestResult, preferenceResult] = await Promise.all([
      listNotifications("unread"),
      listRoomInvites("pending"),
      listDmRequests(),
      getNotificationPreferences()
    ]);
    notifications = notificationResult.notifications;
    invites = inviteResult.invites;
    dmRequests = dmRequestResult.requests;
    preferences = preferenceResult.preferences;
  } catch {
    loadError = "Unable to load notifications.";
  }
  const incomingDmRequests = dmRequests.filter((request) => request.status === "pending" && request.recipient_user_id === user.id);
  const outgoingDmRequests = dmRequests.filter((request) => request.status === "pending" && request.requester_user_id === user.id);
  const activeDmRequests = dmRequests.filter((request) => request.status === "accepted" && request.channel_slug).slice(0, 6);

  return (
    <AppShell active="notifications">
      <section className="grid gap-6">
        <section className="min-w-0 rounded-lg border border-line bg-white p-5 shadow-panel md:p-7">
          <Badge tone="warning">Inbox</Badge>
          <h1 className="mt-3 max-w-full break-words text-2xl font-black leading-tight text-ink [overflow-wrap:anywhere] md:text-3xl">
            Inbox and invites.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:text-base">
            In-app notifications are the primary channel. Email can be activated once the provider configuration is present and your preferences allow it.
          </p>
        </section>

        <LiveUpdateStream eventTypePrefixes={["notification.", "room.invite.", "chat.dm.request."]} label="Inbox live" />

        {(error || loadError) && (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {error ?? loadError}
          </div>
        )}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatusPanel detail="Unread" label="Notifications" tone="warning" value={notifications.length.toString()} />
          <StatusPanel detail="Awaiting you" label="DM Requests" tone="cyan" value={incomingDmRequests.length.toString()} />
          <StatusPanel detail="Pending" label="Invites" tone="cyan" value={invites.length.toString()} />
          <StatusPanel detail="Current channel" label="In-app" tone={preferences?.in_app_enabled ? "success" : "danger"} value={preferences?.in_app_enabled ? "On" : "Off"} />
          <StatusPanel
            detail={`Email ${preferences?.email_enabled ? "on" : "off"} / SMS ${preferences?.sms_enabled ? "on" : "off"}`}
            label="External"
            tone={preferences?.email_enabled || preferences?.sms_enabled ? "success" : "neutral"}
            value={(preferences?.email_enabled || preferences?.sms_enabled) ? "On" : "Off"}
          />
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader
              action={
                <form action={markAllNotificationsReadAction}>
                  <FormActionButton idleLabel="Mark all read" pendingLabel="Marking all read..." size="sm" variant="secondary" />
                </form>
              }
              eyebrow="Inbox"
              title="Unread notifications"
            />
            {notifications.length ? (
              <DataTable
                columns={[
                  { key: "created_at", label: "Time", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                  { key: "title", label: "Title", render: (row) => <strong className="text-ink">{row.title}</strong> },
                  { key: "body", label: "Message", render: (row) => <span className="text-muted">{row.body}</span> },
                  {
                    key: "id",
                    label: "Action",
                    render: (row) => (
                      <form action={markNotificationReadAction}>
                        <input name="notification_id" type="hidden" value={row.id} />
                        <FormActionButton idleLabel="Read" pendingLabel="Marking read..." size="sm" variant="secondary" />
                      </form>
                    )
                  }
                ]}
                rows={notifications}
              />
            ) : (
              <div className="p-4">
                <EmptyState description="Unread match updates, room decisions, and invite notices will appear here." title="Inbox is clear" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Preferences" title="Notification settings" />
            <form action={updateNotificationPreferencesAction} className="grid gap-3 p-4">
              {[
                ["in_app_enabled", "In-app notifications", preferences?.in_app_enabled ?? true],
                ["email_enabled", "Email", preferences?.email_enabled ?? false],
                ["sms_enabled", "SMS", preferences?.sms_enabled ?? false],
                ["room_invites_enabled", "Room invites", preferences?.room_invites_enabled ?? true],
                ["match_updates_enabled", "Match updates", preferences?.match_updates_enabled ?? true],
                ["marketing_enabled", "Marketing", preferences?.marketing_enabled ?? false]
              ].map(([name, label, checked]) => (
                <label className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm font-bold text-ink" key={String(name)}>
                  <span className="min-w-0 break-words">{label}</span>
                  <input className="shrink-0" defaultChecked={Boolean(checked)} name={String(name)} type="checkbox" />
                </label>
              ))}
              <SubmitButton idleLabel="Save preferences" pendingLabel="Saving preferences..." />
            </form>
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            eyebrow="Messages"
            title="DM requests"
            description="Accept a request to open a private channel. Pending sent requests stay visible here so they never feel lost."
          />
          <div className="grid gap-4 p-4">
            {incomingDmRequests.length ? (
              <div className="grid gap-3">
                <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Waiting for your response</p>
                {incomingDmRequests.map((request) => (
                  <article className="grid gap-3 rounded-md border border-line bg-white p-4 shadow-tight" key={request.id}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-950 text-sm font-black text-action">
                        {dmRequester(request).slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-base font-black text-ink">{dmRequester(request)}</p>
                        <p className="mt-0.5 break-words text-xs font-bold text-muted">{dmHandle(request.requester_username)} requested a private chat</p>
                        {request.intro_message ? <p className="mt-3 rounded-md bg-surfaceHigh p-3 text-sm leading-6 text-muted">{request.intro_message}</p> : null}
                        <p className="mt-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-dim">{new Date(request.created_at).toLocaleString("en-NG")}</p>
                      </div>
                    </div>
                    <form action={respondToDmRequestAction} className="flex flex-wrap gap-2">
                      <input name="request_id" type="hidden" value={request.id} />
                      <FormActionButton idleLabel="Accept" name="response" pendingLabel="Accepting..." size="sm" value="accepted" />
                      <FormActionButton idleLabel="Decline" name="response" pendingLabel="Declining..." size="sm" value="declined" variant="danger" />
                    </form>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState description="Private chat requests waiting for your response will appear here." title="No DM requests waiting" />
            )}

            {outgoingDmRequests.length ? (
              <div className="grid gap-3 border-t border-line pt-4">
                <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-dim">Sent requests</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {outgoingDmRequests.map((request) => (
                    <article className="rounded-md border border-line bg-surfaceHigh p-3" key={request.id}>
                      <p className="font-black text-ink">{dmRecipient(request)}</p>
                      <p className="mt-1 text-sm font-bold text-muted">{dmHandle(request.recipient_username)} has not responded yet.</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {activeDmRequests.length ? (
              <div className="grid gap-3 border-t border-line pt-4">
                <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-dim">Open private chats</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeDmRequests.map((request) => {
                    const otherName = request.requester_user_id === user.id ? dmRecipient(request) : dmRequester(request);
                    return (
                      <Link className="rounded-md border border-line bg-white p-3 font-black text-ink shadow-tight transition hover:border-cyan hover:text-cyan" href={`/chat?channel=${encodeURIComponent(request.channel_slug!)}`} key={request.id}>
                        {otherName}
                        <span className="mt-1 block text-xs font-bold text-muted">Open private chat</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Invites"
            title="Pending room invites"
            description="Accept or decline here. Opening rooms is still available from the lobby, but direct invites live in this inbox."
          />
          {invites.length ? (
            <DataTable
              columns={[
                { key: "created_at", label: "Created", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                {
                  key: "inviter_user_id",
                  label: "Invite",
                  render: (row) => (
                    <div className="min-w-0">
                      <p className="font-black text-ink">{inviteSender(row)}</p>
                      <p className="mt-1 text-sm font-bold text-muted">
                        {row.room_title || "Private room"} · {row.room_code || row.match_room_id}
                      </p>
                    </div>
                  )
                },
                { key: "entry_amount_minor", label: "Entry", render: (row) => <span className="font-black text-warning">{inviteEntry(row)}</span> },
                { key: "message", label: "Message", render: (row) => <span className="text-muted">{row.message ?? "No message"}</span> },
                {
                  key: "id",
                  label: "Respond",
                  render: (row) => (
                    <form action={respondToRoomInviteAction} className="flex flex-wrap gap-2">
                      <input name="invite_id" type="hidden" value={row.id} />
                      <FormActionButton idleLabel="Accept" name="response" pendingLabel="Accepting..." size="sm" value="accepted" />
                      <FormActionButton idleLabel="Decline" name="response" pendingLabel="Declining..." size="sm" value="declined" variant="danger" />
                    </form>
                  )
                }
              ]}
              rows={invites}
            />
          ) : (
            <div className="p-4">
              <EmptyState description="Room invites waiting for your response will appear here." title="No pending invites" />
            </div>
          )}
        </Panel>
      </section>
    </AppShell>
  );
}
