"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { RealtimeEvent } from "./realtimeEventPresentation";
import { classifyRealtimePatch, dispatchRealtimePatch, type RealtimePatchTarget } from "./realtimePatches";

type GlobalRealtimeBridgeProps = {
  enabled: boolean;
};

function payloadString(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function eventRoomId(event: RealtimeEvent) {
  return event.match_room_id ?? payloadString(event.payload, "match_room_id") ?? payloadString(event.payload, "matchRoomId");
}

function eventTournamentId(event: RealtimeEvent) {
  return event.tournament_id ?? payloadString(event.payload, "tournament_id") ?? payloadString(event.payload, "tournamentId");
}

function pathRoomId(pathname: string) {
  return pathname.match(/^\/matches\/([^/?#]+)/)?.[1] ?? null;
}

function pathTournamentId(pathname: string) {
  return pathname.match(/^\/tournaments\/([^/?#]+)/)?.[1] ?? null;
}

function activeElementIsEditable() {
  const element = document.activeElement;
  if (!(element instanceof HTMLElement)) return false;
  const tagName = element.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || element.isContentEditable;
}

function routeShouldRefresh(pathname: string, event: RealtimeEvent, target: RealtimePatchTarget) {
  if (pathname.startsWith("/admin")) return true;
  if (pathname === "/" || pathname.startsWith("/profile")) return true;

  if (pathname.startsWith("/notifications")) {
    return ["notifications", "room", "chat"].includes(target);
  }

  if (pathname.startsWith("/wallet")) {
    return target === "wallet" || event.event_type.includes("wallet") || event.event_type.includes("payout") || event.event_type.includes("refund");
  }

  if (pathname === "/matches") {
    return ["room", "room-funding", "room-result", "notifications"].includes(target);
  }

  const currentRoomId = pathRoomId(pathname);
  if (currentRoomId) {
    const roomId = eventRoomId(event);
    return Boolean(roomId && roomId === currentRoomId) || target === "notifications";
  }

  if (pathname.startsWith("/challenges")) {
    return ["room", "room-funding", "notifications"].includes(target) || event.event_type.includes("challenge");
  }

  if (pathname === "/tournaments") {
    return ["tournament", "tournament-funding", "tournament-result", "notifications"].includes(target);
  }

  const currentTournamentId = pathTournamentId(pathname);
  if (currentTournamentId) {
    const tournamentId = eventTournamentId(event);
    return Boolean(tournamentId && tournamentId === currentTournamentId) || target === "notifications";
  }

  if (pathname.startsWith("/chat")) {
    return target === "chat" || target === "notifications";
  }

  if (pathname.startsWith("/community")) {
    return target === "chat" || target === "notifications" || event.event_type.startsWith("community.");
  }

  return false;
}

export function GlobalRealtimeBridge({ enabled }: GlobalRealtimeBridgeProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const pathnameRef = useRef(pathname);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const refreshTimerRef = useRef<number | null>(null);
  const dirtyWhileHiddenOrEditingRef = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const refreshSoon = useCallback(() => {
    if (document.visibilityState === "hidden" || activeElementIsEditable()) {
      dirtyWhileHiddenOrEditingRef.current = true;
      return;
    }

    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      router.refresh();
    }, 650);
  }, [router]);

  const flushDeferredRefresh = useCallback(() => {
    if (!dirtyWhileHiddenOrEditingRef.current) return;
    if (document.visibilityState === "hidden" || activeElementIsEditable()) return;
    dirtyWhileHiddenOrEditingRef.current = false;
    refreshSoon();
  }, [refreshSoon]);

  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (!event.id || !event.event_type) return;
    const eventKey = `${event.id}:${event.event_type}`;
    if (seenEventIdsRef.current.has(eventKey)) return;
    seenEventIdsRef.current.add(eventKey);

    const detail = dispatchRealtimePatch(event);
    const target = detail.target ?? classifyRealtimePatch(event);
    if (routeShouldRefresh(pathnameRef.current, event, target)) refreshSoon();
  }, [refreshSoon]);

  const listeners = useMemo(() => ({
    visibility: flushDeferredRefresh,
    focus: flushDeferredRefresh,
    focusout: () => window.setTimeout(flushDeferredRefresh, 120)
  }), [flushDeferredRefresh]);

  useEffect(() => {
    if (!enabled) return;

    let retryTimer: number | null = null;
    let source: EventSource | null = null;
    let closed = false;

    const connect = () => {
      source?.close();
      source = new EventSource("/api/community/realtime/stream");
      source.addEventListener("realtime-event", (message) => {
        try {
          handleRealtimeEvent(JSON.parse((message as MessageEvent).data) as RealtimeEvent);
        } catch {
          // Ignore malformed events and keep the global stream alive.
        }
      });
      source.addEventListener("error", () => {
        source?.close();
        source = null;
        if (closed || retryTimer) return;
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          if (!closed) connect();
        }, 4_000);
      });
    };

    document.addEventListener("visibilitychange", listeners.visibility);
    window.addEventListener("focus", listeners.focus);
    document.addEventListener("focusout", listeners.focusout);
    connect();

    return () => {
      closed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      document.removeEventListener("visibilitychange", listeners.visibility);
      window.removeEventListener("focus", listeners.focus);
      document.removeEventListener("focusout", listeners.focusout);
      source?.close();
    };
  }, [enabled, handleRealtimeEvent, listeners]);

  return null;
}
