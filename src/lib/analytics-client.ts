"use client";

const analyticsEndpoint = "/api/analytics/events";
const sessionStorageKey = "skillsroom.analytics.session_id";

type AnalyticsMetadata = Partial<Record<"source" | "action" | "tab" | "surface" | "target" | "queue" | "mode" | "entry_type" | "status", string | number | boolean>>;

export type WebAnalyticsEventInput = {
  eventName: string;
  screen?: string;
  path?: string;
  entityType?: string;
  entityId?: string;
  matchRoomId?: string;
  tournamentId?: string;
  metadata?: AnalyticsMetadata;
};

function browserAllowsTracking() {
  if (typeof navigator === "undefined") return false;
  return navigator.doNotTrack !== "1";
}

function randomSessionSuffix() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function webSessionId() {
  if (typeof window === "undefined") return undefined;

  try {
    const existing = window.sessionStorage.getItem(sessionStorageKey);
    if (existing) return existing;

    const next = `web-${Date.now().toString(36)}-${randomSessionSuffix()}`;
    window.sessionStorage.setItem(sessionStorageKey, next);
    return next;
  } catch {
    return `web-${Date.now().toString(36)}-${randomSessionSuffix()}`;
  }
}

export function trackWebAnalyticsEvent(input: WebAnalyticsEventInput) {
  if (!browserAllowsTracking()) return;

  const payload = {
    event_name: input.eventName,
    platform: "web",
    session_id: webSessionId(),
    screen: input.screen,
    path: input.path,
    entity_type: input.entityType,
    entity_id: input.entityId,
    match_room_id: input.matchRoomId,
    tournament_id: input.tournamentId,
    metadata: input.metadata,
    occurred_at: new Date().toISOString()
  };

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(analyticsEndpoint, blob)) return;
  }

  void fetch(analyticsEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: true
  }).catch(() => undefined);
}
