"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui/Toast";
import { describeRealtimeEvent, type RealtimeEvent, type RealtimeToastTone } from "./realtimeEventPresentation";

type LiveUpdateStreamProps = {
  className?: string;
  eventTypePrefixes?: string[];
  label?: string;
  matchRoomId?: string;
  tournamentId?: string;
};

type LiveToast = {
  id: string;
  title: string;
  description: string;
  tone: RealtimeToastTone;
};

type RefreshNotice = {
  title: string;
  description: string;
};

function matchesPrefix(value: string, prefixes: string[]) {
  return prefixes.length === 0 || prefixes.some((prefix) => value.startsWith(prefix));
}

function pillTone(status: "live" | "reconnecting" | "idle") {
  if (status === "live") return "border-emerald-200 bg-gradient-to-r from-emerald-50 to-cyan-50 text-emerald-800 shadow-[0_18px_48px_rgba(16,185,129,0.14)]";
  if (status === "reconnecting") return "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 shadow-[0_18px_48px_rgba(245,158,11,0.12)]";
  return "border-line bg-white text-muted shadow-tight";
}

function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function eventBelongsToRoom(event: RealtimeEvent, matchRoomId?: string) {
  if (!matchRoomId) return true;
  if (event.match_room_id === matchRoomId) return true;

  const payloadRoomId = payloadString(event.payload, "match_room_id") ?? payloadString(event.payload, "matchRoomId");
  if (payloadRoomId === matchRoomId) return true;

  const actionUrl = payloadString(event.payload, "action_url") ?? payloadString(event.payload, "actionUrl");
  return Boolean(actionUrl?.includes(`/matches/${matchRoomId}`));
}

function eventBelongsToTournament(event: RealtimeEvent, tournamentId?: string) {
  if (!tournamentId) return true;
  if (event.tournament_id === tournamentId) return true;

  const payloadTournamentId = payloadString(event.payload, "tournament_id") ?? payloadString(event.payload, "tournamentId");
  if (payloadTournamentId === tournamentId) return true;

  const actionUrl = payloadString(event.payload, "action_url") ?? payloadString(event.payload, "actionUrl");
  return Boolean(actionUrl?.includes(`/tournaments/${tournamentId}`));
}

function refreshNoticeFor(event: RealtimeEvent): RefreshNotice {
  switch (event.event_type) {
    case "match.funding.approved":
      return {
        title: "Funding changed",
        description: "Refreshing this room so the funding card and next step stay correct."
      };
    case "match.funding.rejected":
      return {
        title: "Funding needs attention",
        description: "Refreshing this room so the player sees what to fix."
      };
    case "match.result.reviewed.approve_claim":
      return {
        title: "Result approved",
        description: "Refreshing the result, room status, and payout state now."
      };
    case "match.result.reviewed.reject_claim":
    case "match.result.reviewed.mark_disputed":
    case "match.result.reviewed.void_match":
      return {
        title: "Result decision updated",
        description: "Refreshing this room so the result section shows the latest decision."
      };
    case "match.settlement.reserved":
    case "match.payout.completed":
    case "match.refunds.reserved":
    case "match.refund.completed":
      return {
        title: "Money status updated",
        description: "Refreshing this room so payout or refund details are up to date."
      };
    default:
      return {
        title: "Room update received",
        description: "Refreshing this room so the latest changes appear."
      };
  }
}

export function LiveUpdateStream({
  className,
  eventTypePrefixes = [],
  label = "Live updates on",
  matchRoomId,
  tournamentId
}: LiveUpdateStreamProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"live" | "reconnecting" | "idle">("idle");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [toasts, setToasts] = useState<LiveToast[]>([]);
  const [refreshNotice, setRefreshNotice] = useState<RefreshNotice | null>(null);
  const [showRefreshFallback, setShowRefreshFallback] = useState(false);
  const dirtyRef = useRef(false);
  const hiddenEventsRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedOnceRef = useRef(false);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const prefixes = useMemo(() => eventTypePrefixes.filter(Boolean), [eventTypePrefixes]);

  useEffect(() => {
    const toastTimers = toastTimersRef.current;

    const dismissToast = (toastId: string) => {
      const timer = toastTimers.get(toastId);
      if (timer) {
        clearTimeout(timer);
        toastTimers.delete(toastId);
      }
      setToasts((current) => current.filter((toast) => toast.id !== toastId));
    };

    const showToast = (event: RealtimeEvent) => {
      const message = describeRealtimeEvent(event);
      if (!message || document.visibilityState === "hidden") {
        hiddenEventsRef.current += 1;
        return;
      }

      const toastId = `${event.id}:${event.event_type}`;
      setToasts((current) => {
        const next = [{ id: toastId, ...message }, ...current.filter((toast) => toast.id !== toastId)].slice(0, 4);
        return next;
      });

      const timer = setTimeout(() => dismissToast(toastId), 11000);
      toastTimers.set(toastId, timer);
    };

    const clearFallbackTimers = () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (clearNoticeTimerRef.current) clearTimeout(clearNoticeTimerRef.current);
      fallbackTimerRef.current = null;
      clearNoticeTimerRef.current = null;
    };

    const refresh = (event?: RealtimeEvent) => {
      if (document.visibilityState === "hidden") {
        dirtyRef.current = true;
        return;
      }

      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      clearFallbackTimers();
      setRefreshNotice(event ? refreshNoticeFor(event) : { title: "Refreshing room", description: "Checking for the newest room details." });
      setShowRefreshFallback(false);
      refreshTimerRef.current = setTimeout(() => {
        startTransition(() => {
          router.refresh();
        });
        setUpdatedAt(new Date().toISOString());
        clearNoticeTimerRef.current = setTimeout(() => {
          setRefreshNotice(null);
          setShowRefreshFallback(false);
        }, 9000);
      }, 300);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && dirtyRef.current) {
        dirtyRef.current = false;
        refresh();
      }
      if (document.visibilityState === "visible" && hiddenEventsRef.current > 0) {
        const count = hiddenEventsRef.current;
        hiddenEventsRef.current = 0;
        const toastId = `hidden:${Date.now()}`;
        const hiddenToast: LiveToast = {
          id: toastId,
          title: "New live updates arrived",
          description: `${count} change${count === 1 ? "" : "s"} landed while this tab was in the background.`,
          tone: "neutral"
        };
        setToasts((current): LiveToast[] => [hiddenToast, ...current].slice(0, 4));
        const timer = setTimeout(() => dismissToast(toastId), 11000);
        toastTimers.set(toastId, timer);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const source = new EventSource("/api/community/realtime/stream");
    fallbackTimerRef.current = setTimeout(() => {
      if (!connectedOnceRef.current) setShowRefreshFallback(true);
    }, 7000);
    source.addEventListener("open", () => {
      connectedOnceRef.current = true;
      setStatus("live");
      setShowRefreshFallback(false);
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    });
    source.addEventListener("error", () => {
      setStatus(connectedOnceRef.current ? "reconnecting" : "idle");
      setShowRefreshFallback(true);
    });
    source.addEventListener("realtime-event", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as RealtimeEvent;
        if (seenEventIdsRef.current.has(payload.id)) return;
        seenEventIdsRef.current.add(payload.id);
        if (!matchesPrefix(payload.event_type, prefixes)) return;
        if (!eventBelongsToRoom(payload, matchRoomId)) return;
        if (!eventBelongsToTournament(payload, tournamentId)) return;
        showToast(payload);
        refresh(payload);
      } catch {
        // Ignore malformed events and let the stream continue.
      }
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      clearFallbackTimers();
      for (const timer of toastTimers.values()) clearTimeout(timer);
      toastTimers.clear();
      source.close();
    };
  }, [matchRoomId, prefixes, router, tournamentId]);

  const statusLabel = status === "live" ? "On" : status === "reconnecting" ? "Reconnecting" : "Starting";
  const updatedLabel = updatedAt
    ? `Updated ${new Date(updatedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}`
    : "Listening for updates";
  const needsManualRefresh = showRefreshFallback;

  return (
    <>
      <div
        className={[
          "motion-admin-live flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold",
          pillTone(status),
          className ?? ""
        ].join(" ")}
      >
        <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-white/80 shadow-tight">
          <span className={["absolute size-3 rounded-full", status === "live" ? "bg-emerald-500" : status === "reconnecting" ? "bg-amber-500" : "bg-slate-400"].join(" ")} />
          {status === "live" ? <span className="absolute size-3 animate-ping rounded-full bg-emerald-400/60" /> : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-ink">{label.replace(/\s*live$/i, "") || "Live updates"}</span>
          <span className="block text-xs font-bold text-muted">{updatedLabel}</span>
        </span>
        <span className="ml-auto rounded-full bg-white/70 px-3 py-1 text-xs font-black text-ink shadow-tight">{isPending ? "Updating" : statusLabel}</span>
      </div>
      {refreshNotice || needsManualRefresh ? (
        <div className="rounded-2xl border border-cyan bg-cyanSoft p-4 shadow-tight">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black text-ink">{refreshNotice?.title ?? "Live updates are slow"}</p>
              <p className="mt-1 text-xs font-bold leading-5 text-muted">
                {needsManualRefresh
                  ? "If the room does not change in a few seconds, refresh this room manually."
                  : refreshNotice?.description}
              </p>
            </div>
            <button
              className="motion-tap inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh"
              onClick={() => {
                setShowRefreshFallback(false);
                setRefreshNotice({ title: "Refreshing room", description: "Checking for the newest room details." });
                startTransition(() => {
                  router.refresh();
                });
                setUpdatedAt(new Date().toISOString());
              }}
              type="button"
            >
              Refresh room
            </button>
          </div>
        </div>
      ) : null}
      {toasts.length ? (
        <div className="pointer-events-none fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] grid gap-2 md:inset-x-auto md:right-6 md:top-20 md:bottom-auto md:w-[22rem]">
          {toasts.map((toast) => (
            <div className="pointer-events-auto" key={toast.id}>
              <Toast
                title={toast.title}
                description={toast.description}
                tone={toast.tone}
              >
                <button
                  aria-label="Dismiss live update"
                  className="rounded-sm px-2 py-1 text-xs font-black text-muted hover:bg-white/60 hover:text-ink"
                  onClick={() => {
                    const timer = toastTimersRef.current.get(toast.id);
                    if (timer) {
                      clearTimeout(timer);
                      toastTimersRef.current.delete(toast.id);
                    }
                    setToasts((current) => current.filter((item) => item.id !== toast.id));
                  }}
                  type="button"
                >
                  Close
                </button>
              </Toast>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
