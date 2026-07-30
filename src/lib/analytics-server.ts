import { apiBaseUrl } from "./api";
import { getAccessToken } from "./auth-bridge";

type AnalyticsMetadata = Partial<Record<"source" | "action" | "tab" | "surface" | "target" | "queue" | "mode" | "entry_type" | "status", string | number | boolean>>;

export type ServerAnalyticsEventInput = {
  eventName: string;
  screen?: string;
  path?: string;
  entityType?: string;
  entityId?: string;
  matchRoomId?: string;
  tournamentId?: string;
  metadata?: AnalyticsMetadata;
};

export async function trackServerAnalyticsEvent(input: ServerAnalyticsEventInput) {
  const token = await getAccessToken();
  if (!token) return;

  await fetch(`${apiBaseUrl()}/analytics/events`, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      event_name: input.eventName,
      platform: "web",
      screen: input.screen,
      path: input.path,
      entity_type: input.entityType,
      entity_id: input.entityId,
      match_room_id: input.matchRoomId,
      tournament_id: input.tournamentId,
      metadata: input.metadata,
      occurred_at: new Date().toISOString()
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(1500)
  }).catch(() => null);
}
