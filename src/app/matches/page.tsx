import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { getCurrentUser } from "@/lib/auth-bridge";
import { formatEntryAmount, listMatchRooms, matchStatusLabel, type MatchRoom, type MatchRoomStatus } from "@/lib/match-room-api";
import { joinMatchRoomAction } from "./actions";

const lobbyStatuses: MatchRoomStatus[] = ["open", "awaiting_funding", "funding_review", "active", "under_review", "disputed", "settlement_pending", "completed"];

function statusTone(status: MatchRoomStatus) {
  if (status === "open") return "cyan" as const;
  if (["awaiting_funding", "funding_review"].includes(status)) return "warning" as const;
  if (["under_review", "disputed"].includes(status)) return "danger" as const;
  return "success" as const;
}

function countStatus(rooms: MatchRoom[], status: MatchRoomStatus) {
  return rooms.filter((room) => room.status === status).length.toString();
}

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/matches");
  const { error } = await searchParams;

  let rooms: MatchRoom[] = [];
  let loadError: string | null = null;
  try {
    rooms = (await listMatchRooms()).rooms;
  } catch {
    loadError = "Unable to load match rooms right now. Check that the API is running and your session is still valid.";
  }

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
          <StatusPanel detail="Evidence check" label="Under Review" tone="danger" value={countStatus(rooms, "under_review")} />
          <StatusPanel detail="Visible rooms" label="Tracked" tone="success" value={rooms.length.toString()} />
        </div>

        <Panel>
          <PanelHeader
            action={<SegmentedControl segments={lobbyStatuses.slice(0, 3).map((status, index) => ({ label: matchStatusLabel(status), active: index === 0 }))} />}
            description="Open rooms appear first. Rooms become active only after the required entry checks are complete."
            eyebrow="Rooms"
            title="Room activity"
          />
          <DataTable
            columns={[
              { key: "room_code", label: "Code", render: (row) => <span className="font-mono font-bold text-ink">{row.room_code}</span> },
              {
                key: "title",
                label: "Room",
                render: (row) => (
                  <PendingLink className="font-bold text-ink hover:text-action" href={`/matches/${row.id}`} pendingLabel="Opening room...">
                    {row.title ?? "Private room"}
                  </PendingLink>
                )
              },
              { key: "entry_amount_minor", label: "Entry", render: (row) => <span className="font-mono font-bold text-ink">{formatEntryAmount(row)}</span> },
              { key: "participant_count", label: "Players", render: (row) => <span className="text-muted">{row.participant_count ?? 0}/{row.max_participants}</span> },
              { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{matchStatusLabel(row.status)}</Badge> },
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
            rows={rooms}
          />
        </Panel>

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
