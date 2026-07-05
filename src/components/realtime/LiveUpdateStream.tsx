"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function matchesPrefix(value: string, prefixes: string[]) {
  return prefixes.length === 0 || prefixes.some((prefix) => value.startsWith(prefix));
}

function pillTone(status: "live" | "reconnecting" | "idle") {
  if (status === "live") return "border-emerald-200 bg-gradient-to-r from-emerald-50 to-cyan-50 text-emerald-800 shadow-[0_18px_48px_rgba(16,185,129,0.14)]";
  if (status === "reconnecting") return "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 shadow-[0_18px_48px_rgba(245,158,11,0.12)]";
  return "border-line bg-white text-muted shadow-tight";
}

export function LiveUpdateStream({
  className,
  eventTypePrefixes = [],
  label = "Live updates on",
  matchRoomId,
  tournamentId
}: LiveUpdateStreamProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"live" | "reconnecting" | "idle">("idle");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [toasts, setToasts] = useState<LiveToast[]>([]);
  const dirtyRef = useRef(false);
  const hiddenEventsRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    const refresh = () => {
      if (document.visibilityState === "hidden") {
        dirtyRef.current = true;
        return;
      }

      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        router.refresh();
        setUpdatedAt(new Date().toISOString());
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
    source.addEventListener("open", () => {
      connectedOnceRef.current = true;
      setStatus("live");
    });
    source.addEventListener("error", () => {
      setStatus(connectedOnceRef.current ? "reconnecting" : "idle");
    });
    source.addEventListener("realtime-event", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as RealtimeEvent;
        if (seenEventIdsRef.current.has(payload.id)) return;
        seenEventIdsRef.current.add(payload.id);
        if (!matchesPrefix(payload.event_type, prefixes)) return;
        if (matchRoomId && payload.match_room_id && payload.match_room_id !== matchRoomId) return;
        if (tournamentId && payload.tournament_id && payload.tournament_id !== tournamentId) return;
        showToast(payload);
        refresh();
      } catch {
        // Ignore malformed events and let the stream continue.
      }
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      for (const timer of toastTimers.values()) clearTimeout(timer);
      toastTimers.clear();
      source.close();
    };
  }, [matchRoomId, prefixes, router, tournamentId]);

  const statusLabel = status === "live" ? "On" : status === "reconnecting" ? "Reconnecting" : "Starting";
  const updatedLabel = updatedAt
    ? `Updated ${new Date(updatedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}`
    : "Listening for updates";

  return (
    <>
      <div
        className={[
          "flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold",
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
        <span className="ml-auto rounded-full bg-white/70 px-3 py-1 text-xs font-black text-ink shadow-tight">{statusLabel}</span>
      </div>
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
