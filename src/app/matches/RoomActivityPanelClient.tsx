"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { VirtualList } from "@/components/ui/VirtualList";

export type RoomActivityStatus = "draft" | "open" | "awaiting_funding" | "funding_review";

type RoomActivityRow = {
  id: string;
  room_code: string;
  title: string | null;
  status: RoomActivityStatus;
  status_label: string;
  entry_label: string;
  participant_count: number;
  max_participants: number;
};

const defaultQueueStatuses: RoomActivityStatus[] = ["open", "awaiting_funding", "funding_review"];
const queueSwitchDelayMs = 140;

function queueLabel(status: RoomActivityStatus) {
  if (status === "draft") return "Drafts";
  if (status === "open") return "Open";
  if (status === "awaiting_funding") return "Awaiting Funding";
  return "Funding Review";
}

function statusTone(status: RoomActivityStatus) {
  if (status === "draft") return "neutral" as const;
  if (status === "open") return "cyan" as const;
  return "warning" as const;
}

function queuePanelTone(status: RoomActivityStatus): "neutral" | "cyan" | "warning" {
  if (status === "draft") return "neutral";
  return status === "open" ? "cyan" : "warning";
}

function QueueSkeleton() {
  return (
    <div className="grid gap-3 p-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="grid gap-3 rounded-md border border-line bg-surfaceWarm p-4" key={index}>
          <div className="h-4 w-24 rounded bg-surfaceHigh" />
          <div className="h-5 w-48 rounded bg-surfaceHigh" />
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="h-4 rounded bg-surfaceHigh" />
            <div className="h-4 rounded bg-surfaceHigh" />
            <div className="h-4 rounded bg-surfaceHigh" />
          </div>
        </div>
      ))}
    </div>
  );
}

const RoomActivityMobileCard = memo(function RoomActivityMobileCard({ room }: { room: RoomActivityRow }) {
  return (
    <article className="grid min-w-0 gap-4 rounded-[1.15rem] border border-line bg-white p-4 shadow-[0_12px_30px_rgba(3,10,20,0.06)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.14em] text-dim">Code</p>
          <p className="mt-1 break-all font-mono text-lg font-black text-ink">{room.room_code}</p>
        </div>
        <Badge tone={statusTone(room.status)}>{room.status_label}</Badge>
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
      <PendingLink
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh"
        href={`/matches/${room.id}`}
        pendingLabel="Opening room..."
      >
        View room
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
        <Badge tone={statusTone(room.status)}>{room.status_label}</Badge>
      </div>
      <div className="px-4 py-4 leading-6">
        <PendingLink
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
          href={`/matches/${room.id}`}
          pendingLabel="Opening room..."
        >
          View
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

type RoomActivityPanelClientProps = {
  rooms: RoomActivityRow[];
  initialQueue: RoomActivityStatus;
  nextCursor: string | null;
};

export function RoomActivityPanelClient({ rooms, initialQueue, nextCursor }: RoomActivityPanelClientProps) {
  const [selectedQueue, setSelectedQueue] = useState<RoomActivityStatus>(initialQueue);
  const [switchingTo, setSwitchingTo] = useState<RoomActivityStatus | null>(null);
  const switchTimerRef = useRef<number | null>(null);
  const queueStatuses = useMemo<RoomActivityStatus[]>(
    () => ["draft", ...defaultQueueStatuses],
    []
  );

  useEffect(() => {
    setSelectedQueue(initialQueue);
  }, [initialQueue]);

  useEffect(() => {
    if (!queueStatuses.includes(selectedQueue)) {
      setSelectedQueue("open");
    }
  }, [queueStatuses, selectedQueue]);

  useEffect(() => {
    return () => {
      if (switchTimerRef.current !== null) {
        window.clearTimeout(switchTimerRef.current);
      }
    };
  }, []);

  const queuedRooms = useMemo(
    () => rooms.filter((room) => room.status === selectedQueue),
    [rooms, selectedQueue]
  );

  const handleQueueChange = (nextQueue: string) => {
    if (!queueStatuses.includes(nextQueue as RoomActivityStatus)) return;
    const nextStatus = nextQueue as RoomActivityStatus;
    if (nextStatus === selectedQueue && !switchingTo) return;

    if (switchTimerRef.current !== null) {
      window.clearTimeout(switchTimerRef.current);
    }

    setSwitchingTo(nextStatus);
    switchTimerRef.current = window.setTimeout(() => {
      const url = new URL(window.location.href);
      if (nextStatus === "open") {
        url.searchParams.delete("queue");
      } else {
        url.searchParams.set("queue", nextStatus);
      }
      url.searchParams.delete("cursor");
      window.location.assign(url.toString());
      switchTimerRef.current = null;
    }, queueSwitchDelayMs);
  };

  const visibleQueue = switchingTo ?? selectedQueue;

  return (
    <Panel id="room-activity">
      <PanelHeader
        action={
          <SegmentedControl
            onSelect={handleQueueChange}
            pendingValue={switchingTo ?? undefined}
            segments={queueStatuses.map((status) => ({
              value: status,
              label: queueLabel(status),
              active: status === visibleQueue
            }))}
          />
        }
        description="Switch between room groups to see the latest activity without losing your place."
        eyebrow="Rooms"
        title="Room activity"
      />
      {switchingTo ? (
        <QueueSkeleton />
      ) : queuedRooms.length ? (
        <>
          <RoomActivityMobileCards rooms={queuedRooms} />
          <RoomActivityDesktopTable rooms={queuedRooms} />
        </>
      ) : (
        <div className="p-4">
          <EmptyState
            description={`Rooms in ${queueLabel(selectedQueue).toLowerCase()} will appear here as soon as they enter that queue.`}
            title={`No ${queueLabel(selectedQueue).toLowerCase()} rooms right now`}
            tone={queuePanelTone(selectedQueue)}
          />
        </div>
      )}
      {nextCursor ? (
        <div className="border-t border-line bg-white p-4">
          <PendingLink
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
            href={`/matches?${new URLSearchParams({
              ...(selectedQueue === "open" ? {} : { queue: selectedQueue }),
              cursor: nextCursor
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
