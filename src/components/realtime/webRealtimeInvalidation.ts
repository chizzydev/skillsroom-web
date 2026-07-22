import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { RealtimeEvent } from "./realtimeEventPresentation";

export const webQueryKeys = {
  home: ["home"] as const,
  rooms: ["rooms"] as const,
  room: (roomId: string) => ["room", roomId] as const,
  roomFunding: (roomId: string) => ["room", roomId, "funding"] as const,
  roomResults: (roomId: string) => ["room", roomId, "results"] as const,
  roomLivestreams: (roomId: string) => ["room", roomId, "livestreams"] as const,
  challenges: ["challenges"] as const,
  wallet: ["wallet"] as const,
  notifications: ["notifications"] as const,
  notificationCount: ["notifications", "count"] as const,
  tournaments: ["tournaments"] as const,
  tournament: (tournamentId: string) => ["tournaments", "detail", tournamentId] as const,
  tournamentFunding: (tournamentId: string) => ["tournaments", "detail", tournamentId, "funding"] as const,
  tournamentResults: (tournamentId: string) => ["tournaments", "detail", tournamentId, "results"] as const,
  chat: ["chat"] as const,
  admin: ["admin"] as const
};

function payloadString(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function payloadRecord(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function payloadNestedString(payload: Record<string, unknown> | undefined, parentKey: string, key: string) {
  return payloadString(payloadRecord(payload, parentKey) ?? undefined, key);
}

export function realtimeEventRoomId(event: RealtimeEvent) {
  return event.match_room_id
    ?? payloadString(event.payload, "match_room_id")
    ?? payloadString(event.payload, "matchRoomId")
    ?? payloadString(event.payload, "room_id")
    ?? payloadString(event.payload, "roomId")
    ?? payloadNestedString(event.payload, "room", "id")
    ?? payloadNestedString(event.payload, "match_room", "id")
    ?? payloadNestedString(event.payload, "matchRoom", "id");
}

export function realtimeEventTournamentId(event: RealtimeEvent) {
  return event.tournament_id
    ?? payloadString(event.payload, "tournament_id")
    ?? payloadString(event.payload, "tournamentId")
    ?? payloadNestedString(event.payload, "tournament", "id");
}

function pushUnique(keys: QueryKey[], key: QueryKey) {
  if (!keys.some((existing) => JSON.stringify(existing) === JSON.stringify(key))) keys.push(key);
}

export function queryKeysForRealtimeEvent(event: RealtimeEvent): QueryKey[] {
  const type = event.event_type;
  const roomId = realtimeEventRoomId(event);
  const tournamentId = realtimeEventTournamentId(event);
  const keys: QueryKey[] = [];

  if (type.startsWith("match.") || roomId) {
    pushUnique(keys, webQueryKeys.rooms);
    pushUnique(keys, webQueryKeys.home);
    if (roomId) {
      pushUnique(keys, webQueryKeys.room(roomId));
      pushUnique(keys, webQueryKeys.roomLivestreams(roomId));
    }
  }

  if (type.startsWith("match.funding.") && roomId) {
    pushUnique(keys, webQueryKeys.roomFunding(roomId));
    pushUnique(keys, webQueryKeys.admin);
  }

  if ((type.startsWith("match.result.") || type.startsWith("match.settlement.")) && roomId) {
    pushUnique(keys, webQueryKeys.roomResults(roomId));
    pushUnique(keys, webQueryKeys.admin);
  }

  if (type.startsWith("room.invite.") || type.startsWith("notification.")) {
    pushUnique(keys, webQueryKeys.notifications);
    pushUnique(keys, webQueryKeys.notificationCount);
    pushUnique(keys, webQueryKeys.home);
    if (roomId) pushUnique(keys, webQueryKeys.room(roomId));
  }

  if (type.startsWith("wallet.") || type.includes(".funding.") || type.includes(".payout.") || type.includes(".refund.") || type.includes(".topup.")) {
    pushUnique(keys, webQueryKeys.wallet);
    pushUnique(keys, webQueryKeys.admin);
  }

  if (type.startsWith("tournament.") || tournamentId) {
    pushUnique(keys, webQueryKeys.tournaments);
    pushUnique(keys, webQueryKeys.home);
    if (tournamentId) pushUnique(keys, webQueryKeys.tournament(tournamentId));
  }

  if ((type.startsWith("tournament.contribution.") || type.startsWith("tournament.settlement.") || type.startsWith("tournament.refunds.")) && tournamentId) {
    pushUnique(keys, webQueryKeys.tournamentFunding(tournamentId));
    pushUnique(keys, webQueryKeys.admin);
  }

  if ((type.startsWith("tournament.match.reviewed.") || type.startsWith("tournament.scores.")) && tournamentId) {
    pushUnique(keys, webQueryKeys.tournamentResults(tournamentId));
    pushUnique(keys, webQueryKeys.admin);
  }

  if (type.startsWith("chat.")) {
    pushUnique(keys, webQueryKeys.chat);
    if (type.includes("dm.request") || type === "chat.message.mentioned" || type === "chat.member.muted") {
      pushUnique(keys, webQueryKeys.notifications);
      pushUnique(keys, webQueryKeys.notificationCount);
      pushUnique(keys, webQueryKeys.home);
    }
  }

  if (type.startsWith("community.livestream")) {
    pushUnique(keys, webQueryKeys.rooms);
    pushUnique(keys, webQueryKeys.tournaments);
    if (roomId) pushUnique(keys, webQueryKeys.roomLivestreams(roomId));
    if (tournamentId) pushUnique(keys, webQueryKeys.tournament(tournamentId));
  }

  if (type.startsWith("community.announcement")) {
    pushUnique(keys, webQueryKeys.home);
    pushUnique(keys, webQueryKeys.tournaments);
    pushUnique(keys, webQueryKeys.notifications);
    pushUnique(keys, webQueryKeys.notificationCount);
    if (tournamentId) pushUnique(keys, webQueryKeys.tournament(tournamentId));
  }

  if (type.startsWith("admin.queue.")) {
    pushUnique(keys, webQueryKeys.admin);
  }

  return keys;
}

export function invalidateQueriesForRealtimeEvent(queryClient: QueryClient, event: RealtimeEvent) {
  const keys = queryKeysForRealtimeEvent(event);
  for (const queryKey of keys) {
    void queryClient.invalidateQueries({ queryKey });
  }
  return keys.length;
}
