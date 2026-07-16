"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { realtimePatchEventName, type RealtimePatchDetail } from "@/components/realtime/realtimePatches";
import type { RealtimeEvent } from "@/components/realtime/realtimeEventPresentation";

type NotificationBellProps = {
  initialUnread: number;
};

function displayCount(count: number) {
  if (count > 99) return "99+";
  return count.toString();
}

export function NotificationBell({ initialUnread }: NotificationBellProps) {
  const [unread, setUnread] = useState(Math.max(0, initialUnread));
  const seenEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    setUnread(Math.max(0, initialUnread));
  }, [initialUnread]);

  useEffect(() => {
    const applyEvent = (event: RealtimeEvent) => {
      const eventKey = `${event.id}:${event.event_type}`;
      if (seenEvents.current.has(eventKey)) return;
      seenEvents.current.add(eventKey);

      if (event.event_type === "notification.created") {
        setUnread((current) => current + 1);
      }
      if (event.event_type === "notification.read") {
        setUnread((current) => Math.max(0, current - 1));
      }
    };

    const onPatch = (event: Event) => {
      applyEvent((event as CustomEvent<RealtimePatchDetail>).detail.event);
    };

    window.addEventListener(realtimePatchEventName, onPatch);

    const source = new EventSource("/api/community/realtime/stream");
    source.addEventListener("realtime-event", (event) => {
      try {
        applyEvent(JSON.parse((event as MessageEvent).data) as RealtimeEvent);
      } catch {
        // Realtime badge updates are best effort; the server count refreshes on navigation.
      }
    });

    return () => {
      window.removeEventListener(realtimePatchEventName, onPatch);
      source.close();
    };
  }, []);

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
