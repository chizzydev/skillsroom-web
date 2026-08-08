"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import type { RealtimeEvent } from "./realtimeEventPresentation";
import { classifyRealtimePatch, dispatchRealtimeEvent, dispatchRealtimePatch, type RealtimePatchTarget } from "./realtimePatches";
import { invalidateQueriesForRealtimeEvent, realtimeEventRoomId, realtimeEventTournamentId } from "./webRealtimeInvalidation";

type GlobalRealtimeBridgeProps = {
  enabled: boolean;
};

type NotificationPreference = {
  in_app_enabled: boolean;
  in_app_sound_enabled: boolean;
};

function shouldPlaySoundForRealtimeEvent(event: RealtimeEvent, pathname: string, currentUserId?: string | null) {
  if (currentUserId && event.actor_user_id === currentUserId) return false;
  if (event.event_type === "match.challenge.created") return pathname.startsWith("/challenges");
  return event.event_type === "notification.created" || event.event_type === "room.invite.created";
}

async function getClientNotificationPreferences() {
  const response = await fetch("/api/community/notifications/bootstrap", {
    cache: "no-store",
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error("Notification settings could not be loaded.");
  const payload = await response.json() as {
    data?: {
      preferences?: NotificationPreference;
      current_user_id?: string | null;
    };
  };
  return {
    preferences: payload.data?.preferences ?? null,
    currentUserId: payload.data?.current_user_id ?? null
  };
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

function playNotificationTone() {
  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const masterGain = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const tones = [
    { frequency: 1046.5, start: 0, stop: 0.16 },
    { frequency: 1318.5, start: 0.13, stop: 0.34 }
  ];

  masterGain.gain.setValueAtTime(0.0001, context.currentTime);
  masterGain.gain.exponentialRampToValueAtTime(0.28, context.currentTime + 0.018);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.38);
  compressor.threshold.setValueAtTime(-18, context.currentTime);
  compressor.knee.setValueAtTime(12, context.currentTime);
  compressor.ratio.setValueAtTime(4, context.currentTime);
  compressor.attack.setValueAtTime(0.003, context.currentTime);
  compressor.release.setValueAtTime(0.12, context.currentTime);

  masterGain.connect(compressor);
  compressor.connect(context.destination);

  tones.forEach((tone) => {
    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(tone.frequency, context.currentTime + tone.start);
    oscillator.connect(masterGain);
    oscillator.start(context.currentTime + tone.start);
    oscillator.stop(context.currentTime + tone.stop);
  });

  window.setTimeout(() => void context.close().catch(() => undefined), 520);
}

function isRoomPatchTarget(target: RealtimePatchTarget) {
  return target === "room" || target === "room-funding" || target === "room-result";
}

function isTournamentPatchTarget(target: RealtimePatchTarget) {
  return target === "tournament" || target === "tournament-funding" || target === "tournament-result";
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
    const roomId = realtimeEventRoomId(event);
    return Boolean(roomId ? roomId === currentRoomId : isRoomPatchTarget(target)) || target === "notifications";
  }

  if (pathname.startsWith("/challenges")) {
    return ["room", "room-funding", "notifications"].includes(target) || event.event_type.includes("challenge");
  }

  if (pathname === "/tournaments") {
    return ["tournament", "tournament-funding", "tournament-result", "notifications"].includes(target);
  }

  const currentTournamentId = pathTournamentId(pathname);
  if (currentTournamentId) {
    const tournamentId = realtimeEventTournamentId(event);
    return Boolean(tournamentId ? tournamentId === currentTournamentId : isTournamentPatchTarget(target)) || target === "notifications";
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
  const queryClient = useQueryClient();
  const pathname = usePathname() ?? "/";
  const pathnameRef = useRef(pathname);
  const cursorRef = useRef<string | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const refreshTimerRef = useRef<number | null>(null);
  const lastSoundAtRef = useRef(0);
  const dirtyWhileHiddenOrEditingRef = useRef(false);
  const preferencesQuery = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: getClientNotificationPreferences,
    enabled,
    staleTime: 60_000
  });

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
    cursorRef.current = event.id;
    const eventKey = `${event.id}:${event.event_type}`;
    if (seenEventIdsRef.current.has(eventKey)) return;
    seenEventIdsRef.current.add(eventKey);

    const detail = dispatchRealtimePatch(event);
    dispatchRealtimeEvent(detail);
    invalidateQueriesForRealtimeEvent(queryClient, event);
    const preferences = preferencesQuery.data?.preferences;
    if (shouldPlaySoundForRealtimeEvent(event, pathnameRef.current, preferencesQuery.data?.currentUserId) && document.visibilityState === "visible" && preferences?.in_app_enabled && preferences.in_app_sound_enabled) {
      const now = Date.now();
      if (now - lastSoundAtRef.current > 1_500) {
        lastSoundAtRef.current = now;
        try {
          playNotificationTone();
        } catch {
          // Browsers may block audio until the player interacts with the page.
        }
      }
    }
    const target = detail.target ?? classifyRealtimePatch(event);
    if (routeShouldRefresh(pathnameRef.current, event, target)) refreshSoon();
  }, [preferencesQuery.data?.currentUserId, preferencesQuery.data?.preferences, queryClient, refreshSoon]);

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

    const disconnect = () => {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      source?.close();
      source = null;
    };

    const connect = () => {
      if (closed || document.visibilityState === "hidden") return;
      source?.close();
      const url = new URL("/api/community/realtime/stream", window.location.origin);
      if (cursorRef.current) url.searchParams.set("cursor", cursorRef.current);
      source = new EventSource(`${url.pathname}${url.search}`);
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
        }, 15_000);
      });
    };

    const handleVisibilityChange = () => {
      listeners.visibility();
      if (document.visibilityState === "hidden") {
        disconnect();
        return;
      }
      if (!source) connect();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", listeners.focus);
    document.addEventListener("focusout", listeners.focusout);
    connect();

    return () => {
      closed = true;
      disconnect();
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", listeners.focus);
      document.removeEventListener("focusout", listeners.focusout);
    };
  }, [enabled, handleRealtimeEvent, listeners]);

  return null;
}
