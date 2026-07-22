"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { realtimePatchEventName, type RealtimePatchDetail } from "@/components/realtime/realtimePatches";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import type { RealtimeEvent } from "@/components/realtime/realtimeEventPresentation";

type NotificationBellProps = {
  initialUnread: number;
};

function displayCount(count: number) {
  if (count > 99) return "99+";
  return count.toString();
}

function notificationEventMayChangeCount(eventType: string) {
  return eventType.startsWith("notification.") || eventType.startsWith("room.invite.") || eventType.startsWith("chat.dm.request.");
}

type NotificationCount = {
  unread: number;
  pending_invites: number;
  pending_dm_requests: number;
  count: number;
};

async function fetchNotificationCount(): Promise<NotificationCount> {
  const response = await fetch("/api/community/notifications/count", {
    headers: { accept: "application/json" },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; data?: Partial<NotificationCount> } | null;
  const count = payload?.ok === true && typeof payload.data?.count === "number" ? payload.data.count : null;
  if (count === null || !Number.isFinite(count)) throw new Error("Notification count could not be loaded.");
  return {
    unread: typeof payload?.data?.unread === "number" ? payload.data.unread : count,
    pending_invites: typeof payload?.data?.pending_invites === "number" ? payload.data.pending_invites : 0,
    pending_dm_requests: typeof payload?.data?.pending_dm_requests === "number" ? payload.data.pending_dm_requests : 0,
    count: Math.max(0, count)
  };
}

function updateCount(current: NotificationCount | undefined, delta: number, fallback: number): NotificationCount {
  const base = current ?? { unread: fallback, pending_invites: 0, pending_dm_requests: 0, count: fallback };
  return { ...base, count: Math.max(0, base.count + delta) };
}

export function NotificationBell({ initialUnread }: NotificationBellProps) {
  const queryClient = useQueryClient();
  const seenEvents = useRef<Set<string>>(new Set());
  const initialCount = Math.max(0, initialUnread);
  const { data } = useQuery({
    queryKey: webQueryKeys.notificationCount,
    queryFn: fetchNotificationCount,
    initialData: {
      unread: initialCount,
      pending_invites: 0,
      pending_dm_requests: 0,
      count: initialCount
    },
    refetchInterval: 15_000
  });
  const unread = Math.max(0, data.count);

  useEffect(() => {
    queryClient.setQueryData<NotificationCount>(webQueryKeys.notificationCount, (current) => {
      if (current) return current;
      return { unread: initialCount, pending_invites: 0, pending_dm_requests: 0, count: initialCount };
    });
  }, [initialCount, queryClient]);

  useEffect(() => {
    const applyEvent = (event: RealtimeEvent) => {
      const eventKey = `${event.id}:${event.event_type}`;
      if (seenEvents.current.has(eventKey)) return;
      seenEvents.current.add(eventKey);

      if (event.event_type === "notification.created" || event.event_type === "room.invite.created" || event.event_type === "chat.dm.request.created") {
        queryClient.setQueryData<NotificationCount>(webQueryKeys.notificationCount, (current) => updateCount(current, 1, initialCount));
      } else if (event.event_type === "notification.read" || event.event_type === "room.invite.responded" || event.event_type === "chat.dm.request.responded") {
        queryClient.setQueryData<NotificationCount>(webQueryKeys.notificationCount, (current) => updateCount(current, -1, initialCount));
      }

      if (notificationEventMayChangeCount(event.event_type)) {
        void queryClient.invalidateQueries({ queryKey: webQueryKeys.notificationCount });
      }
    };

    const onPatch = (event: Event) => {
      applyEvent((event as CustomEvent<RealtimePatchDetail>).detail.event);
    };

    window.addEventListener(realtimePatchEventName, onPatch);
    return () => window.removeEventListener(realtimePatchEventName, onPatch);
  }, [initialCount, queryClient]);

  return (
    <Link
      aria-label={unread > 0 ? `Open notifications, ${unread} unread` : "Open notifications"}
      className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink shadow-tight transition hover:bg-surfaceHigh"
      href="/notifications"
    >
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-danger px-1 text-[0.62rem] font-black leading-none text-white shadow-tight">
          {displayCount(unread)}
        </span>
      ) : null}
    </Link>
  );
}
