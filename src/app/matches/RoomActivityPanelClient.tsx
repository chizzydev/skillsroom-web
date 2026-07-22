"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { VirtualList } from "@/components/ui/VirtualList";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import type { RoomActivitySnapshot } from "./roomActivityData";
import {
  queueDescription,
  queueLabel,
  queuePanelTone,
  roomActivityQueueStatuses,
  roomActivityQueues,
  type RoomActivityQueue,
  type RoomActivityStatus
} from "./roomActivityConfig";

type RoomActivityRow = RoomActivitySnapshot["rooms"][number];

function statusTone(status: RoomActivityStatus, expired = false) {
  if (expired) return "neutral" as const;
  if (status === "open") return "cyan" as const;
  if (["awaiting_funding", "funding_review", "funded"].includes(status)) return "warning" as const;
  if (["under_review", "disputed"].includes(status)) return "danger" as const;
  if (["cancelled", "voided"].includes(status)) return "neutral" as const;
  return "success" as const;
}

function queueActionLabel(status: RoomActivityStatus, expired = false) {
  if (expired) return "Open history";
  if (status === "open") return "Share or join";
  if (status === "awaiting_funding") return "Complete entry";
  if (status === "funding_review") return "Check funding";
  if (status === "funded") return "Start match";
  if (status === "active") return "Open live room";
  if (status === "awaiting_results") return "Submit result";
  if (status === "under_review" || status === "disputed") return "Review result";
  if (status === "settlement_pending") return "Track payout";
  return "Open room";
}

function queueForRoom(room: RoomActivityRow): RoomActivityQueue {
  if (room.is_expired_open) return "expired";
  const match = roomActivityQueues.find((queue) => roomActivityQueueStatuses[queue].includes(room.status));
  return match ?? "open";
}

const RoomActivityMobileCard = memo(function RoomActivityMobileCard({ room }: { room: RoomActivityRow }) {
  return (
    <article className="grid min-w-0 gap-4 rounded-[1.15rem] border border-line bg-white p-4 shadow-[0_12px_30px_rgba(3,10,20,0.06)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.14em] text-dim">Code</p>
          <p className="mt-1 break-all font-mono text-lg font-black text-ink">{room.room_code}</p>
        </div>
        <Badge tone={statusTone(room.status, room.is_expired_open)}>{room.is_expired_open ? "Expired" : room.status_label}</Badge>
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.14em] text-dim">Room</p>
        <PendingLink
          className="mt-1 block break-words text-xl font-black leading-tight text-ink hover:text-action"
          href={`/matches/${room.id}`}
          pendingLabel="Opening room..."
        >
          {room.title ?? "Private room"}
        </PendingLink>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-3">
        <div className="rounded-md border border-line bg-surfaceWarm p-3">
          <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Entry</p>
          <p className="mt-1 break-words font-mono text-sm font-black text-ink">{room.entry_label}</p>
        </div>
        <div className="rounded-md border border-line bg-surfaceWarm p-3">
          <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Players</p>
          <p className="mt-1 text-sm font-black text-ink">{room.participant_count ?? 0}/{room.max_participants}</p>
        </div>
      </div>
      {room.is_expired_open ? (
        <div className="rounded-md border border-line bg-surfaceWarm p-3 text-sm font-bold leading-6 text-muted">
          This challenge window ended before another player accepted. Open it for history, or post a fresh challenge.
        </div>
      ) : null}
      <PendingLink
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh"
        href={`/matches/${room.id}`}
        pendingLabel="Opening room..."
      >
          {queueActionLabel(room.status, room.is_expired_open)}
      </PendingLink>
    </article>
  );
});

const RoomActivityDesktopRow = memo(function RoomActivityDesktopRow({ room }: { room: RoomActivityRow }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(16rem,1fr)_8rem_7rem_9rem_8rem] bg-white text-sm transition hover:bg-surfaceWarm">
      <div className="px-4 py-4 leading-6">
        <span className="font-mono font-bold text-ink">{room.room_code}</span>
      </div>
      <div className="max-w-[28rem] px-4 py-4 leading-6">
        <PendingLink className="font-bold text-ink hover:text-action" href={`/matches/${room.id}`} pendingLabel="Opening room...">
          {room.title ?? "Private room"}
        </PendingLink>
      </div>
      <div className="px-4 py-4 leading-6">
        <span className="font-mono font-bold text-ink">{room.entry_label}</span>
      </div>
      <div className="px-4 py-4 leading-6">
        <span className="text-muted">{room.participant_count ?? 0}/{room.max_participants}</span>
      </div>
      <div className="px-4 py-4 leading-6">
        <Badge tone={statusTone(room.status, room.is_expired_open)}>{room.is_expired_open ? "Expired" : room.status_label}</Badge>
      </div>
      <div className="px-4 py-4 leading-6">
        <PendingLink
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
          href={`/matches/${room.id}`}
          pendingLabel="Opening room..."
        >
          {queueActionLabel(room.status, room.is_expired_open)}
        </PendingLink>
      </div>
    </div>
  );
});

function RoomActivityMobileCards({ rooms }: { rooms: RoomActivityRow[] }) {
  const renderRoom = useCallback((room: RoomActivityRow) => <RoomActivityMobileCard room={room} />, []);
  return (
    <VirtualList
      className="grid min-w-0 gap-3 bg-surfaceWarm p-3 lg:hidden"
      estimateItemHeight={220}
      itemClassName="pb-3 last:pb-0"
      itemKey={(room) => room.id}
      items={rooms}
      renderItem={renderRoom}
      threshold={12}
    />
  );
}

function RoomActivityDesktopTable({ rooms }: { rooms: RoomActivityRow[] }) {
  const renderRoom = useCallback((room: RoomActivityRow) => <RoomActivityDesktopRow room={room} />, []);
  return (
    <div className="hidden max-w-full overflow-x-auto lg:block">
      <div className="min-w-[58rem]">
        <div className="grid grid-cols-[9rem_minmax(16rem,1fr)_8rem_7rem_9rem_8rem] border-b border-line bg-surfaceWarm">
          {["Code", "Room", "Entry", "Players", "Status", "Action"].map((label) => (
            <div className="whitespace-nowrap px-4 py-3.5 font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim" key={label}>
              {label}
            </div>
          ))}
        </div>
        <VirtualList className="divide-y divide-line" estimateItemHeight={76} itemKey={(room) => room.id} items={rooms} renderItem={renderRoom} threshold={18} />
      </div>
    </div>
  );
}

type RoomQueueTabsProps = {
  queues: RoomActivityQueue[];
  selectedQueue: RoomActivityQueue;
  onSelect: (queue: RoomActivityQueue) => void;
};

function RoomQueueTabs({ queues, selectedQueue, onSelect }: RoomQueueTabsProps) {
  return (
    <div className="border-b border-line bg-white px-3 py-3 sm:px-5">
      <div className="grid min-w-full grid-cols-3 gap-1 rounded-md border border-line bg-surfaceHigh p-1 min-[360px]:grid-cols-5 lg:grid-cols-10">
          {queues.map((queue) => {
            const active = queue === selectedQueue;
            return (
              <button
                className={[
                  "inline-flex min-h-10 min-w-0 items-center justify-center rounded-sm px-1.5 text-center text-[0.62rem] font-black leading-tight transition min-[360px]:px-2 min-[430px]:text-[0.68rem] sm:px-3 sm:text-[0.72rem] lg:shrink-0",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2",
                  active ? "bg-white text-ink shadow-tight" : "text-muted hover:bg-white/70 hover:text-ink"
                ].join(" ")}
                key={queue}
                onClick={() => onSelect(queue)}
                type="button"
              >
                {queueLabel(queue)}
              </button>
            );
          })}
      </div>
    </div>
  );
}

type RoomActivityPanelClientProps = {
  initialSnapshot: RoomActivitySnapshot;
};

async function fetchRoomActivitySnapshot(selectedQueue: RoomActivityQueue) {
  const params = new URLSearchParams();
  if (selectedQueue !== "open") params.set("queue", selectedQueue);
  const response = await fetch(`/api/matches/activity?${params.toString()}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("ROOM_ACTIVITY_UNAVAILABLE");
  const payload = await response.json() as { ok?: boolean; data?: RoomActivitySnapshot };
  if (!payload.ok || !payload.data) throw new Error("ROOM_ACTIVITY_UNAVAILABLE");
  return payload.data;
}

export function RoomActivityPanelClient({ initialSnapshot }: RoomActivityPanelClientProps) {
  const [selectedQueue, setSelectedQueue] = useState<RoomActivityQueue>(initialSnapshot.selectedQueue);
  const queues = useMemo<RoomActivityQueue[]>(() => roomActivityQueues, []);

  const { data: snapshot = initialSnapshot, isFetching, isError } = useQuery({
    queryKey: [...webQueryKeys.rooms, "activity", selectedQueue],
    queryFn: () => fetchRoomActivitySnapshot(selectedQueue),
    initialData: initialSnapshot,
    refetchOnMount: false,
    staleTime: 10_000
  });

  useEffect(() => {
    setSelectedQueue(initialSnapshot.selectedQueue);
  }, [initialSnapshot.selectedQueue]);

  useEffect(() => {
    if (!queues.includes(selectedQueue)) {
      setSelectedQueue("open");
    }
  }, [queues, selectedQueue]);

  const queuedRooms = useMemo(
    () => snapshot.rooms.filter((room) => queueForRoom(room) === selectedQueue),
    [snapshot.rooms, selectedQueue]
  );

  const handleQueueChange = (nextQueue: RoomActivityQueue) => {
    if (!queues.includes(nextQueue)) return;
    if (nextQueue === selectedQueue) return;

    setSelectedQueue(nextQueue);
    const url = new URL(window.location.href);
    if (nextQueue === "open") url.searchParams.delete("queue");
    else url.searchParams.set("queue", nextQueue);
    url.searchParams.delete("cursor");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <Panel id="room-activity">
      <PanelHeader
        description={isFetching ? "Refreshing room activity..." : "Switch between every room stage, from open and funding through disputes, payout, done, and expired H2H challenges."}
        eyebrow="Rooms"
        title="Room activity"
      />
      {isError || snapshot.loadError ? (
        <div className="border-b border-line bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {snapshot.loadError ?? "Room activity could not refresh. The current list is still available."}
        </div>
      ) : null}
      <RoomQueueTabs queues={queues} selectedQueue={selectedQueue} onSelect={handleQueueChange} />
      {queuedRooms.length ? (
        <>
          <RoomActivityMobileCards rooms={queuedRooms} />
          <RoomActivityDesktopTable rooms={queuedRooms} />
        </>
      ) : (
        <div className="p-4">
          <EmptyState
            description={queueDescription(selectedQueue)}
            title={`No ${queueLabel(selectedQueue).toLowerCase()} rooms right now`}
            tone={queuePanelTone(selectedQueue)}
          />
        </div>
      )}
      {snapshot.nextCursor ? (
        <div className="border-t border-line bg-white p-4">
          <PendingLink
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
            href={`/matches?${new URLSearchParams({
              ...(selectedQueue === "open" ? {} : { queue: selectedQueue }),
              cursor: snapshot.nextCursor
            }).toString()}`}
            pendingLabel="Loading more rooms..."
          >
            Load more rooms
          </PendingLink>
        </div>
      ) : null}
    </Panel>
  );
}
