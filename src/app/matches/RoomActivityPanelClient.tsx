"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
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
        <DataTable
          columns={[
            {
              key: "room_code",
              label: "Code",
              render: (row) => <span className="font-mono font-bold text-ink">{row.room_code}</span>
            },
            {
              key: "title",
              label: "Room",
              render: (row) => (
                <PendingLink
                  className="font-bold text-ink hover:text-action"
                  href={`/matches/${row.id}`}
                  pendingLabel="Opening room..."
                >
                  {row.title ?? "Private room"}
                </PendingLink>
              )
            },
            {
              key: "entry_label",
              label: "Entry",
              render: (row) => <span className="font-mono font-bold text-ink">{row.entry_label}</span>
            },
            {
              key: "participant_count",
              label: "Players",
              render: (row) => (
                <span className="text-muted">
                  {row.participant_count ?? 0}/{row.max_participants}
                </span>
              )
            },
            {
              key: "status",
              label: "Status",
              render: (row) => <Badge tone={statusTone(row.status)}>{row.status_label}</Badge>
            },
            {
              key: "action",
              label: "Action",
              render: (row) => (
                <PendingLink
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
                  href={`/matches/${row.id}`}
                  pendingLabel="Opening room..."
                >
                  View room
                </PendingLink>
              )
            }
          ]}
          rows={queuedRooms}
        />
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
