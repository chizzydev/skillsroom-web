import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MotionSection, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { getCurrentUser } from "@/lib/auth-bridge";
import {
  formatEntryAmount,
  getMatchRoomStatusCounts,
  listMatchRooms,
  matchStatusLabel,
  type MatchRoomListRow,
  type MatchRoomStatus
} from "@/lib/match-room-api";
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

function countStatus(counts: Partial<Record<MatchRoomStatus, number>>, status: MatchRoomStatus) {
  return (counts[status] ?? 0).toString();
}

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ error?: string; queue?: string; cursor?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/matches");
  const { error, queue, cursor } = await searchParams;
  const selectedQueue = parseRoomQueue(queue);

  let rooms: MatchRoomListRow[] = [];
  let nextCursor: string | null = null;
  let counts: Partial<Record<MatchRoomStatus, number>> = {};
  let loadError: string | null = null;
  try {
    const [roomPage, statusCounts] = await Promise.all([
      listMatchRooms({ status: selectedQueue, cursor, limit: 24 }),
      getMatchRoomStatusCounts()
    ]);
    rooms = roomPage.rooms;
    nextCursor = roomPage.next_cursor;
    counts = statusCounts.counts;
  } catch {
    loadError = "Rooms could not load right now. Please refresh the page or sign in again if this continues.";
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
      <MotionSection className="grid min-w-0 gap-6" variant="page">
        <MotionSection className="min-w-0 rounded-lg border border-line bg-white p-5 shadow-panel md:p-7" variant="hero">
          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <Badge tone="cyan">Match Rooms</Badge>
              <h1 className="mt-3 text-3xl font-black leading-tight text-ink sm:text-4xl lg:text-5xl">Create, join, and track rooms.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:text-base">
                Track rooms from open entry through funding, play, result review, and settlement.
              </p>
            </div>
            <div className="grid w-full min-w-0 gap-2 min-[380px]:grid-cols-2 lg:w-auto lg:min-w-[20rem]">
              <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-3 text-center text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="/matches/new" pendingLabel="Opening creator...">
                Create room
              </PendingLink>
              <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-center text-sm font-black text-ink hover:bg-surfaceHigh" href="#join-room">
                Join by code
              </a>
            </div>
          </div>
        </MotionSection>

        {(error || loadError) ? <TransientStatusBanner clearKeys={["error"]} durationMs={12000} message={error ?? loadError ?? ""} /> : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal staggerIndex={0}><StatusPanel detail="Visible to lobby" label="Open" tone="cyan" value={countStatus(counts, "open")} /></Reveal>
          <Reveal staggerIndex={1}><StatusPanel detail="Manual transfer next" label="Awaiting Funding" tone="warning" value={countStatus(counts, "awaiting_funding")} /></Reveal>
          <Reveal staggerIndex={2}><StatusPanel detail="Payment proof check" label="Funding Review" tone="danger" value={countStatus(counts, "funding_review")} /></Reveal>
          <Reveal staggerIndex={3}><StatusPanel detail="Visible rooms" label="Tracked" tone="success" value={Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0).toString()} /></Reveal>
        </div>

        <Reveal>
          <RoomActivityPanelClient initialQueue={selectedQueue} nextCursor={nextCursor} rooms={roomActivityRows} />
        </Reveal>

        <Reveal>
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
        </Reveal>
      </MotionSection>
    </AppShell>
  );
}
