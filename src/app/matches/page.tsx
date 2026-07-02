import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { getCurrentUser } from "@/lib/auth-bridge";
import { formatEntryAmount, listMatchRooms, matchStatusLabel, type MatchRoom, type MatchRoomStatus } from "@/lib/match-room-api";
import { joinMatchRoomAction } from "./actions";
import { RoomActivityPanelClient, type RoomActivityStatus } from "./RoomActivityPanelClient";

const roomActivityStatuses: RoomActivityStatus[] = ["draft", "open", "awaiting_funding", "funding_review"];

function parseRoomQueue(value: string | undefined): RoomActivityStatus {
  if (value && roomActivityStatuses.includes(value as RoomActivityStatus)) {
    return value as RoomActivityStatus;
  }

  return "open";
}

function isRoomActivityStatus(status: MatchRoomStatus): status is RoomActivityStatus {
  return roomActivityStatuses.includes(status as RoomActivityStatus);
}

function countStatus(rooms: MatchRoom[], status: MatchRoomStatus) {
  return rooms.filter((room) => room.status === status).length.toString();
}

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ error?: string; queue?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/matches");
  const { error, queue } = await searchParams;
  const selectedQueue = parseRoomQueue(queue);

  let rooms: MatchRoom[] = [];
  let loadError: string | null = null;
  try {
    rooms = (await listMatchRooms()).rooms;
  } catch {
    loadError = "Unable to load match rooms right now. Check that the API is running and your session is still valid.";
  }

  const roomActivityRows = rooms
    .filter((room) => isRoomActivityStatus(room.status))
    .map((room) => ({
      id: room.id,
      room_code: room.room_code,
      title: room.title,
      status: room.status as RoomActivityStatus,
      status_label: matchStatusLabel(room.status),
      entry_label: formatEntryAmount(room),
      participant_count: room.participant_count ?? 0,
      max_participants: room.max_participants
    }));
  return (
    <AppShell active="matches">
      <section className="grid min-w-0 gap-6">
        <section className="min-w-0 rounded-lg border border-line bg-white p-5 shadow-panel md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge tone="cyan">Match Rooms</Badge>
              <h1 className="mt-3 text-3xl font-black leading-tight text-ink sm:text-4xl lg:text-5xl">Create, join, and track rooms.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:text-base">
                Track rooms from open entry through funding, play, result review, and settlement.
              </p>
            </div>
            <div className="grid w-full max-w-sm grid-cols-2 gap-2 lg:w-auto">
              <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-3 text-center text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="/matches/new" pendingLabel="Opening creator...">
                Create room
              </PendingLink>
              <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-center text-sm font-black text-ink hover:bg-surfaceHigh" href="#join-room">
                Join by code
              </a>
            </div>
          </div>
        </section>

        {(error || loadError) && (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {error ?? loadError}
          </div>
        )}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Visible to lobby" label="Open" tone="cyan" value={countStatus(rooms, "open")} />
          <StatusPanel detail="Manual transfer next" label="Awaiting Funding" tone="warning" value={countStatus(rooms, "awaiting_funding")} />
          <StatusPanel detail="Payment proof check" label="Funding Review" tone="danger" value={countStatus(rooms, "funding_review")} />
          <StatusPanel detail="Visible rooms" label="Tracked" tone="success" value={rooms.length.toString()} />
        </div>

        <RoomActivityPanelClient initialQueue={selectedQueue} rooms={roomActivityRows} />

        <Panel id="join-room">
          <PanelHeader eyebrow="Join Code" title="Join a private room" description="Players can join a room only when their profile is complete and the room is open." />
          <form action={joinMatchRoomAction} className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm font-bold uppercase outline-none focus:border-action"
              name="room_code"
              placeholder="SR8K21"
              required
            />
            <SubmitButton idleLabel="Join room" pendingLabel="Joining room..." />
          </form>
        </Panel>
      </section>
    </AppShell>
  );
}
