"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

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

function syncQueueInUrl(status: RoomActivityStatus) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (status === "open") {
    url.searchParams.delete("queue");
  } else {
    url.searchParams.set("queue", status);
  }
  window.history.replaceState(window.history.state, "", url);
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

function RoomActivityMobileCards({ rooms }: { rooms: RoomActivityRow[] }) {
  return (
    <div className="grid min-w-0 gap-3 bg-surfaceWarm p-3 lg:hidden">
      {rooms.map((room) => (
        <article
          className="grid min-w-0 gap-4 rounded-[1.15rem] border border-line bg-white p-4 shadow-[0_12px_30px_rgba(3,10,20,0.06)]"
          key={room.id}
        >
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
      ))}
    </div>
  );
}

function RoomActivityDesktopTable({ rooms }: { rooms: RoomActivityRow[] }) {
  return (
    <div className="hidden max-w-full overflow-x-auto lg:block">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-surfaceWarm">
            {["Code", "Room", "Entry", "Players", "Status", "Action"].map((label) => (
              <th className="whitespace-nowrap px-4 py-3.5 font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rooms.map((room) => (
            <tr className="bg-white align-top transition hover:bg-surfaceWarm" key={room.id}>
              <td className="px-4 py-4 leading-6">
                <span className="font-mono font-bold text-ink">{room.room_code}</span>
              </td>
              <td className="max-w-[22rem] px-4 py-4 leading-6">
                <PendingLink className="font-bold text-ink hover:text-action" href={`/matches/${room.id}`} pendingLabel="Opening room...">
                  {room.title ?? "Private room"}
                </PendingLink>
              </td>
              <td className="px-4 py-4 leading-6">
                <span className="font-mono font-bold text-ink">{room.entry_label}</span>
              </td>
              <td className="px-4 py-4 leading-6">
                <span className="text-muted">{room.participant_count ?? 0}/{room.max_participants}</span>
              </td>
              <td className="px-4 py-4 leading-6">
                <Badge tone={statusTone(room.status)}>{room.status_label}</Badge>
              </td>
              <td className="px-4 py-4 leading-6">
                <PendingLink
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
                  href={`/matches/${room.id}`}
                  pendingLabel="Opening room..."
                >
                  View room
                </PendingLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type RoomActivityPanelClientProps = {
  rooms: RoomActivityRow[];
  initialQueue: RoomActivityStatus;
};

export function RoomActivityPanelClient({ rooms, initialQueue }: RoomActivityPanelClientProps) {
  const [selectedQueue, setSelectedQueue] = useState<RoomActivityStatus>(initialQueue);
  const [switchingTo, setSwitchingTo] = useState<RoomActivityStatus | null>(null);
  const switchTimerRef = useRef<number | null>(null);
  const queueStatuses = useMemo<RoomActivityStatus[]>(
    () => rooms.some((room) => room.status === "draft") ? ["draft", ...defaultQueueStatuses] : defaultQueueStatuses,
    [rooms]
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
      setSelectedQueue(nextStatus);
      setSwitchingTo(null);
      syncQueueInUrl(nextStatus);
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
        description="Open rooms appear first. Rooms become active only after the required entry checks are complete."
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
    </Panel>
  );
}
