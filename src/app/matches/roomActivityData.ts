import {
  formatEntryAmount,
  getMatchRoomStatusCounts,
  listMatchRooms,
  matchStatusLabel,
  type MatchRoomListRow,
  type MatchRoomStatus
} from "@/lib/match-room-api";
import {
  queueForRoomStatus,
  roomActivityQueueStatuses,
  roomActivityQueues,
  roomActivityStatuses,
  type RoomActivityQueue,
  type RoomActivityStatus
} from "./roomActivityConfig";

export type RoomActivityRow = {
  id: string;
  room_code: string;
  title: string | null;
  status: RoomActivityStatus;
  status_label: string;
  entry_label: string;
  participant_count: number;
  max_participants: number;
  is_expired_open: boolean;
};

export type RoomActivitySnapshot = {
  rooms: RoomActivityRow[];
  counts: Partial<Record<MatchRoomStatus, number>>;
  selectedQueue: RoomActivityQueue;
  nextCursor: string | null;
  loadError: string | null;
  loadedAt: string;
};

export function parseRoomQueue(value: string | undefined): RoomActivityQueue {
  if (value && roomActivityQueues.includes(value as RoomActivityQueue)) return value as RoomActivityQueue;
  if (value && roomActivityStatuses.includes(value as RoomActivityStatus)) return queueForRoomStatus(value as RoomActivityStatus);
  return "open";
}

function isRoomActivityStatus(status: MatchRoomStatus): status is RoomActivityStatus {
  return roomActivityStatuses.includes(status as RoomActivityStatus);
}

function isExpiredOpenRoom(room: MatchRoomListRow) {
  if (room.status !== "open" || !room.expires_at) return false;
  const expiresAt = new Date(room.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

const roomStatusSet = new Set<MatchRoomStatus>(roomActivityStatuses);

function toFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeRoom(row: unknown): MatchRoomListRow | null {
  if (!isRecord(row)) return null;
  if (typeof row.id !== "string" || typeof row.room_code !== "string") return null;
  if (typeof row.status !== "string" || !roomStatusSet.has(row.status as MatchRoomStatus)) return null;

  return {
    id: row.id,
    game_id: typeof row.game_id === "string" ? row.game_id : undefined,
    ruleset_id: typeof row.ruleset_id === "string" ? row.ruleset_id : undefined,
    room_code: row.room_code,
    status: row.status as MatchRoomStatus,
    currency: typeof row.currency === "string" && row.currency.trim() ? row.currency : "NGN",
    entry_amount_minor: toFiniteNumber(row.entry_amount_minor, 0),
    commission_bps: toFiniteNumber(row.commission_bps, 0),
    max_participants: Math.max(1, toFiniteNumber(row.max_participants, 2)),
    title: typeof row.title === "string" ? row.title : null,
    created_by_user_id: typeof row.created_by_user_id === "string" ? row.created_by_user_id : "",
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
    participant_count: Math.max(0, toFiniteNumber(row.participant_count, 0)),
    game_slug: typeof row.game_slug === "string" ? row.game_slug : null,
    game_name: typeof row.game_name === "string" ? row.game_name : null,
    ruleset_slug: typeof row.ruleset_slug === "string" ? row.ruleset_slug : null,
    ruleset_title: typeof row.ruleset_title === "string" ? row.ruleset_title : null
  };
}

function deriveCounts(rooms: MatchRoomListRow[]) {
  return rooms.reduce<Partial<Record<MatchRoomStatus, number>>>((current, room) => ({
    ...current,
    [room.status]: (current[room.status] ?? 0) + 1
  }), {});
}

function sanitizeCounts(value: unknown, fallbackRooms: MatchRoomListRow[]) {
  if (!isRecord(value)) return deriveCounts(fallbackRooms);
  const source = isRecord(value.counts) ? value.counts : value;
  return roomActivityStatuses.reduce<Partial<Record<MatchRoomStatus, number>>>((current, status) => {
    const count = source[status];
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) current[status] = count;
    return current;
  }, deriveCounts(fallbackRooms));
}

export async function loadRoomActivitySnapshot(input: { queue?: string; cursor?: string | null } = {}): Promise<RoomActivitySnapshot> {
  const selectedQueue = parseRoomQueue(input.queue);
  const selectedQueueStatuses = roomActivityQueueStatuses[selectedQueue];
  let loadError: string | null = null;

  const [activityPageResult, roomPageResults, statusCountsResult] = await Promise.all([
    listMatchRooms({
      cursor: selectedQueue === "expired" ? input.cursor ?? undefined : undefined,
      limit: 50
    }).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason) => ({ status: "rejected" as const, reason })
    ),
    Promise.allSettled(
      roomActivityStatuses.map(async (status) => ({
        status,
        page: await listMatchRooms({
          status,
          cursor: selectedQueueStatuses.length === 1 && status === selectedQueueStatuses[0] ? input.cursor ?? undefined : undefined,
          limit: 24
        })
      }))
    ),
    getMatchRoomStatusCounts().then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason) => ({ status: "rejected" as const, reason })
    )
  ]);

  const activityPage = activityPageResult.status === "fulfilled"
    ? {
        rooms: Array.isArray(activityPageResult.value.rooms)
          ? activityPageResult.value.rooms.map(sanitizeRoom).filter((room): room is MatchRoomListRow => Boolean(room))
          : [],
        next_cursor: typeof activityPageResult.value.next_cursor === "string" ? activityPageResult.value.next_cursor : null
      }
    : { rooms: [], next_cursor: null };
  const roomPages = roomPageResults.flatMap((result) => {
    if (result.status !== "fulfilled") return [];
    const rows = Array.isArray(result.value.page?.rooms) ? result.value.page.rooms.map(sanitizeRoom).filter((room): room is MatchRoomListRow => Boolean(room)) : [];
    return [{
      status: result.value.status,
      page: {
        rooms: rows,
        next_cursor: typeof result.value.page?.next_cursor === "string" ? result.value.page.next_cursor : null
      }
    }];
  });

  const roomsById = new Map<string, MatchRoomListRow>();
  for (const room of roomPages.flatMap(({ page }) => page.rooms)) roomsById.set(room.id, room);
  for (const room of activityPage.rooms.filter(isExpiredOpenRoom)) roomsById.set(room.id, room);
  const rooms = Array.from(roomsById.values());
  const nextCursor = selectedQueue === "expired"
    ? activityPage.next_cursor
    : selectedQueueStatuses.length === 1 ? (roomPages.find((item) => item.status === selectedQueueStatuses[0])?.page.next_cursor ?? null) : null;
  const counts = statusCountsResult.status === "fulfilled" ? sanitizeCounts(statusCountsResult.value, rooms) : deriveCounts(rooms);

  if (activityPageResult.status === "rejected" && roomPageResults.every((result) => result.status === "rejected")) {
    loadError = "Rooms are temporarily unavailable. Your account is still signed in; try this page again in a moment.";
  } else if (activityPageResult.status === "rejected" || roomPageResults.some((result) => result.status === "rejected") || statusCountsResult.status === "rejected" || roomPages.length < roomActivityStatuses.length) {
    loadError = "Some room data could not load. The rooms shown below are still safe to use.";
  }

  return {
    rooms: rooms
      .filter((room) => isRoomActivityStatus(room.status))
      .map((room) => ({
        id: room.id,
        room_code: room.room_code,
        title: room.title,
        status: room.status as RoomActivityStatus,
        status_label: isExpiredOpenRoom(room) ? "Expired" : matchStatusLabel(room.status),
        entry_label: formatEntryAmount(room),
        participant_count: room.participant_count ?? 0,
        max_participants: room.max_participants,
        is_expired_open: isExpiredOpenRoom(room)
      })),
    counts,
    selectedQueue,
    nextCursor,
    loadError,
    loadedAt: new Date().toISOString()
  };
}
