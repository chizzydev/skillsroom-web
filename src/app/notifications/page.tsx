import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { getCurrentUser } from "@/lib/auth-bridge";
import {
  formatEntryAmount,
  getNotificationPreferences,
  listNotifications,
  listRoomInvites,
  type NotificationPreference,
  type RoomInvite,
  type UserNotification
} from "@/lib/match-room-api";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
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

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/notifications");
  const { error } = await searchParams;

  let notifications: UserNotification[] = [];
  let invites: RoomInvite[] = [];
  let preferences: NotificationPreference | null = null;
  let loadError: string | null = null;
  try {
    const [notificationResult, inviteResult, preferenceResult] = await Promise.all([
      listNotifications("unread"),
      listRoomInvites("pending"),
      getNotificationPreferences()
    ]);
    notifications = notificationResult.notifications;
    invites = inviteResult.invites;
    preferences = preferenceResult.preferences;
  } catch {
    loadError = "Unable to load notifications.";
  }

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

        <LiveUpdateStream eventTypePrefixes={["notification.", "room.invite."]} label="Inbox live" />

        {(error || loadError) && (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {error ?? loadError}
          </div>
        )}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Unread" label="Notifications" tone="warning" value={notifications.length.toString()} />
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
                  <Button size="sm" type="submit" variant="secondary">Mark all read</Button>
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
                        <Button size="sm" type="submit" variant="secondary">Read</Button>
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
              <Button type="submit">Save preferences</Button>
            </form>
          </Panel>
        </div>

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
                        {row.room_title || "COD Mobile room"} · {row.room_code || row.match_room_id}
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
                      <Button name="response" size="sm" type="submit" value="accepted">Accept</Button>
                      <Button name="response" size="sm" type="submit" value="declined" variant="danger">Decline</Button>
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
