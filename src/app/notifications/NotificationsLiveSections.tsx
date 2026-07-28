"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatEntryAmount } from "@/lib/display-format";
import type { ChatDmRequest, NotificationPreference, RoomInvite, UserNotification } from "@/lib/match-room-api";
import { notificationAction } from "@/lib/notification-routing";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  openNotificationAction,
  respondToDmRequestAction,
  respondToRoomInviteAction,
  updateNotificationPreferencesAction
} from "./actions";

type InboxTab = "unread" | "read";

export type NotificationBootstrap = {
  notifications: UserNotification[];
  invites: RoomInvite[];
  requests: ChatDmRequest[];
  preferences: NotificationPreference;
};

const preferenceRows: Array<{
  key: keyof Omit<NotificationPreference, "user_id">;
  label: string;
  description: string;
  disabled?: boolean;
}> = [
  { key: "in_app_enabled", label: "In-app notifications", description: "Show updates inside Skillsroom." },
  { key: "in_app_sound_enabled", label: "In-app sound", description: "Play a short sound for new in-app notifications." },
  { key: "email_enabled", label: "Email for priority updates", description: "Only important alerts, requests, and announcements are sent by email." },
  { key: "sms_enabled", label: "SMS", description: "Reserved for future critical alerts.", disabled: true },
  { key: "room_invites_enabled", label: "Room invites", description: "Notify me when a player sends a room invite." },
  { key: "match_updates_enabled", label: "Match updates", description: "Notify me about match actions that need attention." },
  { key: "marketing_enabled", label: "Marketing", description: "Send occasional product and community promotions." }
];

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

function formatWhen(value?: string | null) {
  if (!value) return "Just now";
  return new Date(value).toLocaleString("en-NG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function fetchNotificationBootstrap() {
  const response = await fetch("/api/community/notifications/bootstrap", {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("NOTIFICATIONS_UNAVAILABLE");
  const payload = await response.json() as { ok?: boolean; data?: NotificationBootstrap };
  if (!payload.ok || !payload.data) throw new Error("NOTIFICATIONS_UNAVAILABLE");
  return payload.data;
}

async function fetchNotifications(status: InboxTab) {
  const response = await fetch(`/api/community/notifications/list?status=${encodeURIComponent(status)}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("NOTIFICATIONS_UNAVAILABLE");
  const payload = await response.json() as { ok?: boolean; data?: { notifications: UserNotification[] } };
  if (!payload.ok || !payload.data) throw new Error("NOTIFICATIONS_UNAVAILABLE");
  return payload.data.notifications;
}

function PreferenceToggle({
  checked,
  description,
  disabled,
  label,
  name
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className={["flex min-w-0 items-center justify-between gap-3 rounded-md border border-line bg-surfaceWarm p-3 text-sm font-bold text-ink", disabled ? "opacity-60" : ""].join(" ")}>
      <span className="min-w-0">
        <span className="block break-words font-black">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
      </span>
      {disabled && checked ? <input name={name} type="hidden" value="on" /> : null}
      <input className="h-5 w-5 shrink-0 accent-action" defaultChecked={checked} disabled={disabled} name={name} type="checkbox" />
    </label>
  );
}

function NotificationCard({ notification }: { notification: UserNotification }) {
  const action = notificationAction(notification);

  return (
    <article className="grid gap-3 rounded-md border border-line bg-surfaceWarm p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan" />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-black text-ink">{notification.title}</h3>
          <p className="mt-1 break-words text-sm leading-6 text-muted">{notification.body}</p>
          <p className="mt-2 font-mono text-[0.68rem] font-black uppercase tracking-[0.1em] text-dim">{formatWhen(notification.created_at)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {action.href ? (
          <form action={openNotificationAction}>
            <input name="notification_id" type="hidden" value={notification.id} />
            <input name="target" type="hidden" value={action.href} />
            <FormActionButton fullWidth idleLabel={action.label} pendingLabel="Opening..." size="sm" />
          </form>
        ) : null}
        {notification.status === "unread" ? (
          <form action={markNotificationReadAction} className={action.href ? "" : "col-span-2"}>
            <input name="notification_id" type="hidden" value={notification.id} />
            <FormActionButton fullWidth idleLabel="Mark read" pendingLabel="Marking read..." size="sm" variant="secondary" />
          </form>
        ) : null}
      </div>
    </article>
  );
}

export function NotificationsLiveSections({
  initialBootstrap,
  userId
}: {
  initialBootstrap: NotificationBootstrap;
  userId: string;
}) {
  const [tab, setTab] = useState<InboxTab>("unread");
  const { data: bootstrap = initialBootstrap, isFetching, isError } = useQuery({
    queryKey: webQueryKeys.notifications,
    queryFn: fetchNotificationBootstrap,
    initialData: initialBootstrap,
    refetchOnMount: false,
    staleTime: 8_000
  });
  const {
    data: selectedNotifications,
    isFetching: notificationsFetching,
    isError: notificationsError
  } = useQuery({
    queryKey: [...webQueryKeys.notifications, tab],
    queryFn: () => fetchNotifications(tab),
    initialData: tab === "unread" ? initialBootstrap.notifications : undefined,
    staleTime: 8_000
  });

  const notifications = selectedNotifications ?? [];
  const unreadCount = tab === "unread" ? notifications.length : bootstrap.notifications.length;
  const invites = bootstrap.invites;
  const dmRequests = bootstrap.requests;
  const preferences = bootstrap.preferences;
  const incomingDmRequests = dmRequests.filter((request) => request.status === "pending" && request.recipient_user_id === userId);
  const outgoingDmRequests = dmRequests.filter((request) => request.status === "pending" && request.requester_user_id === userId);
  const activeDmRequests = dmRequests.filter((request) => request.status === "accepted" && request.channel_slug).slice(0, 6);

  return (
    <>
      <div className="grid grid-cols-2 rounded-[1.2rem] border border-line bg-white p-1 shadow-tight">
        {(["unread", "read"] as const).map((item) => (
          <button
            className={[
              "min-h-11 rounded-lg px-4 text-sm font-black transition",
              tab === item ? "bg-navy-950 text-white shadow-tight" : "text-muted hover:bg-surfaceHigh hover:text-ink"
            ].join(" ")}
            key={item}
            onClick={() => setTab(item)}
            type="button"
          >
            {item === "unread" ? "Unread" : "Read"}
          </button>
        ))}
      </div>

      <Panel>
        <PanelHeader eyebrow="Settings" title="Notification settings" description="Choose which Skillsroom updates can reach you." />
        <form action={updateNotificationPreferencesAction} className="grid gap-3 p-4">
          {preferenceRows.map((item) => (
            <PreferenceToggle
              checked={Boolean(preferences[item.key])}
              description={item.description}
              disabled={item.disabled}
              key={item.key}
              label={item.label}
              name={item.key}
            />
          ))}
          <SubmitButton idleLabel="Save preferences" pendingLabel="Saving preferences..." />
        </form>
      </Panel>

      {isError ? (
        <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Inbox could not refresh. The current items are still available.
        </div>
      ) : null}

      <Panel className="scroll-mt-32" id="dm-requests">
        <PanelHeader
          eyebrow="Messages"
          title="DM requests"
          description={incomingDmRequests.length ? `${incomingDmRequests.length} request${incomingDmRequests.length === 1 ? "" : "s"} waiting.` : "No private chat requests waiting."}
          action={
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/chat/dm-requests">
              Open DM requests
            </Link>
          }
        />
        <div className="grid gap-4 p-4">
          {incomingDmRequests.length ? (
            <div className="grid gap-3">
              {incomingDmRequests.map((request) => (
                <article className="grid gap-3 rounded-md border border-line bg-surfaceWarm p-4" key={request.id}>
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-950 text-sm font-black text-action">
                      {dmRequester(request).slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-black text-ink">{dmRequester(request)}</h3>
                      <p className="mt-1 break-words text-xs font-bold text-muted">{dmHandle(request.requester_username)} requested a private chat.</p>
                      {request.intro_message ? <p className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-muted">{request.intro_message}</p> : null}
                      <p className="mt-2 font-mono text-[0.68rem] font-black uppercase tracking-[0.1em] text-dim">{formatWhen(request.created_at)}</p>
                    </div>
                  </div>
                  <form action={respondToDmRequestAction} className="grid grid-cols-2 gap-2">
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
              <div className="grid grid-cols-2 gap-2">
                {outgoingDmRequests.map((request) => (
                  <article className="rounded-md border border-line bg-white p-3" key={request.id}>
                    <p className="break-words font-black text-ink">{dmRecipient(request)}</p>
                    <p className="mt-1 text-sm font-bold text-muted">{dmHandle(request.recipient_username)} has not responded yet.</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {activeDmRequests.length ? (
            <div className="grid gap-3 border-t border-line pt-4">
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Open private chats</p>
              <div className="grid grid-cols-2 gap-2">
                {activeDmRequests.map((request) => {
                  const otherName = request.requester_user_id === userId ? dmRecipient(request) : dmRequester(request);
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

      <Panel className="scroll-mt-32" id="invites">
        <PanelHeader
          eyebrow="Invites"
          title="Room invites"
          description={invites.length ? `${invites.length} invite${invites.length === 1 ? "" : "s"} waiting.` : "No room invites waiting."}
        />
        <div className="grid gap-3 p-4">
          {invites.length ? (
            invites.map((invite) => (
              <article className="grid gap-3 rounded-md border border-line bg-surfaceWarm p-4" key={invite.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success">Room invite</Badge>
                  <Badge tone="cyan">{invite.room_code || "Room"}</Badge>
                </div>
                <div className="min-w-0">
                  <h3 className="break-words text-base font-black text-ink">{invite.room_title || "Private room"}</h3>
                  <p className="mt-1 break-words text-sm leading-6 text-muted">{inviteSender(invite)} invited you to this room.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-line bg-white p-3">
                    <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Entry</p>
                    <p className="mt-1 text-sm font-black text-ink">{inviteEntry(invite)}</p>
                  </div>
                  <div className="rounded-md border border-line bg-white p-3">
                    <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Expires</p>
                    <p className="mt-1 text-sm font-black text-ink">{formatWhen(invite.expires_at)}</p>
                  </div>
                </div>
                {invite.message ? <p className="rounded-md border-l-4 border-cyan bg-white p-3 text-sm leading-6 text-muted">{invite.message}</p> : null}
                <form action={respondToRoomInviteAction} className="grid grid-cols-2 gap-2">
                  <input name="invite_id" type="hidden" value={invite.id} />
                  <FormActionButton idleLabel="Accept" name="response" pendingLabel="Accepting..." size="sm" value="accepted" />
                  <FormActionButton idleLabel="Decline" name="response" pendingLabel="Declining..." size="sm" value="declined" variant="danger" />
                </form>
              </article>
            ))
          ) : (
            <EmptyState description="Room invites waiting for your response will appear here." title="No room invites waiting" />
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          action={
            tab === "unread" && unreadCount > 0 ? (
              <form action={markAllNotificationsReadAction}>
                <FormActionButton idleLabel="Mark all read" pendingLabel="Marking all read..." size="sm" variant="secondary" />
              </form>
            ) : null
          }
          eyebrow="Updates"
          title={tab === "unread" ? "Unread updates" : "Read updates"}
          description={notificationsFetching || isFetching ? "Refreshing updates..." : "Tap any update to open the related Skillsroom area."}
        />
        <div className="grid gap-3 p-4">
          {notificationsError ? (
            <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Updates could not refresh. Try again in a moment.
            </div>
          ) : null}
          {!notificationsError && notifications.length ? (
            notifications.map((notification) => <NotificationCard key={notification.id} notification={notification} />)
          ) : null}
          {!notificationsError && !notifications.length ? (
            <EmptyState
              description={tab === "unread" ? "New room, chat, wallet, and tournament updates will appear here." : "Updates you mark as read will appear here."}
              title={tab === "unread" ? "Inbox is clear" : "No read notifications yet"}
            />
          ) : null}
        </div>
      </Panel>
    </>
  );
}
