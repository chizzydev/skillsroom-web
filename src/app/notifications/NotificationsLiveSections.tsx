"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import {
  formatEntryAmount,
  type ChatDmRequest,
  type NotificationPreference,
  type RoomInvite,
  type UserNotification
} from "@/lib/match-room-api";
import { notificationAction } from "@/lib/notification-routing";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  openNotificationAction,
  respondToDmRequestAction,
  respondToRoomInviteAction
} from "./actions";

export type NotificationBootstrap = {
  notifications: UserNotification[];
  invites: RoomInvite[];
  requests: ChatDmRequest[];
  preferences: NotificationPreference;
};

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

export function NotificationsLiveSections({
  initialBootstrap,
  userId
}: {
  initialBootstrap: NotificationBootstrap;
  userId: string;
}) {
  const { data: bootstrap = initialBootstrap, isFetching, isError } = useQuery({
    queryKey: webQueryKeys.notifications,
    queryFn: fetchNotificationBootstrap,
    initialData: initialBootstrap,
    refetchOnMount: false,
    staleTime: 8_000
  });

  const notifications = bootstrap.notifications;
  const invites = bootstrap.invites;
  const dmRequests = bootstrap.requests;
  const incomingDmRequests = dmRequests.filter((request) => request.status === "pending" && request.recipient_user_id === userId);
  const outgoingDmRequests = dmRequests.filter((request) => request.status === "pending" && request.requester_user_id === userId);
  const activeDmRequests = dmRequests.filter((request) => request.status === "accepted" && request.channel_slug).slice(0, 6);

  return (
    <>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusPanel detail={isFetching ? "Refreshing..." : "Unread match and account updates"} label="Unread" tone={notifications.length ? "danger" : "success"} value={notifications.length.toString()} />
        <StatusPanel detail="Waiting for your response" label="Room Invites" tone={invites.length ? "warning" : "success"} value={invites.length.toString()} />
        <StatusPanel detail="Private chat requests" label="DM Requests" tone={incomingDmRequests.length ? "cyan" : "success"} value={incomingDmRequests.length.toString()} />
        <StatusPanel detail="Accepted private chats" label="Open DMs" tone="cyan" value={activeDmRequests.length.toString()} />
      </div>

      {isError ? (
        <div className="rounded-md border border-warning bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Inbox could not refresh. The current items are still available.
        </div>
      ) : null}

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
                  render: (row) => {
                    const action = notificationAction(row);
                    return (
                      <div className="flex flex-wrap gap-2">
                        {action.href ? (
                          <form action={openNotificationAction}>
                            <input name="notification_id" type="hidden" value={row.id} />
                            <input name="target" type="hidden" value={action.href} />
                            <FormActionButton idleLabel={action.label} pendingLabel="Opening..." size="sm" />
                          </form>
                        ) : null}
                        <form action={markNotificationReadAction}>
                          <input name="notification_id" type="hidden" value={row.id} />
                          <FormActionButton idleLabel="Read" pendingLabel="Marking read..." size="sm" variant="secondary" />
                        </form>
                      </div>
                    );
                  }
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

        <Panel className="scroll-mt-32" id="dm-requests">
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
                <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Open private chats</p>
                <div className="grid gap-2 sm:grid-cols-2">
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
      </div>

      <Panel className="scroll-mt-32" id="invites">
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
                      {row.room_title || "Private room"} / {row.room_code || row.match_room_id}
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
    </>
  );
}
