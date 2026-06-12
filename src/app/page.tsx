import Link from "next/link";
import { GlobalLobbyClient } from "@/components/community/GlobalLobbyClient";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getCurrentUser } from "@/lib/auth-bridge";
import {
  formatEntryAmount,
  listChatChannels,
  listChatMessages,
  listDmRequests,
  listMatchRooms,
  type ChatChannel,
  type ChatDmRequest,
  type ChatMessage,
  type ChatPinnedMessage,
  type ChatPresenceSummary,
  matchStatusLabel,
  type MatchRoom,
  type MatchRoomStatus
} from "@/lib/match-room-api";
import { joinMatchRoomAction } from "./matches/actions";

type HomePageProps = {
  searchParams?: Promise<{ error?: string }>;
};

const actionStatuses: MatchRoomStatus[] = [
  "open",
  "awaiting_funding",
  "funding_review",
  "funded",
  "active",
  "awaiting_results",
  "under_review",
  "disputed",
  "settlement_pending",
  "completed"
];

const roomSteps = [
  ["Open", "Find an opponent or share the room code."],
  ["Fund", "Both entries are checked before play starts."],
  ["Play", "Run the match under the listed ruleset."],
  ["Review", "Result evidence is checked before settlement."]
] as const;

function statusTone(status: MatchRoomStatus) {
  if (status === "open") return "cyan" as const;
  if (["awaiting_funding", "funding_review", "funded"].includes(status)) return "warning" as const;
  if (["under_review", "disputed"].includes(status)) return "danger" as const;
  if (["active", "awaiting_results", "settlement_pending"].includes(status)) return "success" as const;
  return "cyan" as const;
}

function countWhere(rooms: MatchRoom[], statuses: MatchRoomStatus[]) {
  return rooms.filter((room) => statuses.includes(room.status)).length.toString();
}

function sortRooms(rooms: MatchRoom[]) {
  const rank: Record<MatchRoomStatus, number> = {
    open: 1,
    awaiting_funding: 2,
    funding_review: 3,
    funded: 4,
    active: 5,
    awaiting_results: 6,
    under_review: 7,
    disputed: 8,
    settlement_pending: 9,
    draft: 10,
    completed: 11,
    cancelled: 12,
    refunded: 13,
    voided: 14
  };

  return [...rooms].sort((left, right) => {
    const statusRank = rank[left.status] - rank[right.status];
    if (statusRank !== 0) return statusRank;
    return Date.parse(right.created_at) - Date.parse(left.created_at);
  });
}

function RoomCard({ room }: { room: MatchRoom }) {
  const playerCount = room.participant_count ?? 0;
  const isJoinable = room.status === "open" && playerCount < room.max_participants;
  const roomActivityLabel =
    room.status === "completed"
      ? "Completed and retained for activity history"
      : isJoinable
        ? "Ready for opponent"
        : "Action in progress";

  return (
    <article className="grid gap-4 border-b border-line p-4 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-surfaceHigh px-2 py-1 font-mono text-xs font-black text-ink">
            {room.room_code}
          </span>
          <Badge tone={statusTone(room.status)}>{matchStatusLabel(room.status)}</Badge>
        </div>
        <PendingLink className="mt-3 block text-lg font-black text-ink hover:text-action" href={`/matches/${room.id}`} pendingLabel="Opening room...">
          {room.title ?? "Private match room"}
        </PendingLink>
        <div className="mt-3 grid gap-2 text-sm font-bold text-muted sm:grid-cols-3">
          <span>{formatEntryAmount(room)} entry</span>
          <span>
            {playerCount}/{room.max_participants} players
          </span>
          <span>{roomActivityLabel}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        <PendingLink
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
          href={`/matches/${room.id}`}
          pendingLabel="Opening room..."
        >
          View room
        </PendingLink>
        {isJoinable ? (
          <form action={joinMatchRoomAction}>
            <input name="room_code" type="hidden" value={room.room_code} />
            <input name="error_path" type="hidden" value="/" />
            <SubmitButton idleLabel="Join" pendingLabel="Joining..." />
          </form>
        ) : null}
      </div>
    </article>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-bg">
        <header className="border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-page">
            <Link className="flex min-w-0 items-center gap-3 text-lg font-black text-ink" href="/">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-navy-900 text-sm text-action shadow-tight">SR</span>
              <span className="truncate">Skillsroom</span>
            </Link>
            <nav className="ml-auto hidden items-center gap-2 md:flex">
              <PendingLink className="rounded-md px-3 py-2 text-sm font-black text-muted hover:bg-surfaceHigh hover:text-ink" href="/community" pendingLabel="Opening community...">
                Community
              </PendingLink>
              <PendingLink className="rounded-md px-3 py-2 text-sm font-black text-muted hover:bg-surfaceHigh hover:text-ink" href="/policies" pendingLabel="Opening policies...">
                Policies
              </PendingLink>
              <PendingLink className="rounded-md px-3 py-2 text-sm font-black text-muted hover:bg-surfaceHigh hover:text-ink" href="/support" pendingLabel="Opening support...">
                Support
              </PendingLink>
              <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/sign-in?redirect=/" pendingLabel="Opening sign in...">
                Sign in
              </PendingLink>
              <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="/register" pendingLabel="Opening registration...">
                Create account
              </PendingLink>
            </nav>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-page py-6 md:py-8">
          <section className="rounded-lg border border-line bg-navy-900 p-5 text-white shadow-panel md:p-7">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
              <div>
                <Badge tone="cyan">Skill-based competition platform</Badge>
                <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                  Structured rooms, evidence review, and serious tournament play.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  Skillsroom helps players and operators run private match rooms and competitive events with clear rules,
                  visible dispute handling, and controlled settlement workflows.
                </p>
                <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
                  <PendingLink
                    className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover sm:w-auto"
                    href="/register"
                    pendingLabel="Opening registration..."
                  >
                    Create account
                  </PendingLink>
                  <PendingLink
                    className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-white/10 bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh sm:w-auto"
                    href="/sign-in?redirect=/"
                    pendingLabel="Opening sign in..."
                  >
                    Sign in
                  </PendingLink>
                  <PendingLink
                    className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-white/10 bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh sm:w-auto"
                    href="/community"
                    pendingLabel="Opening community..."
                  >
                    View public community
                  </PendingLink>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">How trust works</p>
                <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-200">
                  <p className="rounded-md border border-white/10 bg-white/5 p-3">
                    Players join rooms and tournaments under visible rules instead of hidden chats and loose transfers.
                  </p>
                  <p className="rounded-md border border-white/10 bg-white/5 p-3">
                    Funding proof, evidence, disputes, and operator decisions stay attached to the match or tournament record.
                  </p>
                  <p className="rounded-md border border-white/10 bg-white/5 p-3">
                    Public policies, support pages, and community surfaces remain available before sign-in so new players can inspect the platform first.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Panel>
              <PanelHeader
                eyebrow="Product"
                title="What players can do here"
                description="Skillsroom is built for competitive gaming, not chance-based betting."
              />
              <div className="grid gap-3 p-4 md:grid-cols-2">
                <div className="rounded-md border border-line bg-surfaceWarm p-4">
                  <p className="text-sm font-black text-ink">Private match rooms</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Create or join head-to-head rooms, submit transfer proof, play, and move through result review with evidence attached.
                  </p>
                </div>
                <div className="rounded-md border border-line bg-surfaceWarm p-4">
                  <p className="text-sm font-black text-ink">Tournament operations</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Run brackets, Swiss, round robin, group stages, leagues, and cumulative-score formats with operator oversight.
                  </p>
                </div>
                <div className="rounded-md border border-line bg-surfaceWarm p-4">
                  <p className="text-sm font-black text-ink">Evidence and disputes</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Keep screenshots, clips, and decision history connected to the exact room or tournament match under review.
                  </p>
                </div>
                <div className="rounded-md border border-line bg-surfaceWarm p-4">
                  <p className="text-sm font-black text-ink">Public trust surfaces</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Review community pages, policies, winner pages, and public competition context before you ever create an account.
                  </p>
                </div>
              </div>
            </Panel>

            <div className="grid gap-6">
              <Panel>
                <PanelHeader eyebrow="Inspect first" title="Public pages" />
                <div className="grid gap-2 p-4">
                  <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="/community" pendingLabel="Opening community...">
                    Community and leaderboards
                  </PendingLink>
                  <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="/community/highlights" pendingLabel="Opening highlights...">
                    Highlights and winner pages
                  </PendingLink>
                  <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="/policies" pendingLabel="Opening policies...">
                    Policies and eligibility
                  </PendingLink>
                  <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="/support" pendingLabel="Opening support...">
                    Support and contact
                  </PendingLink>
                </div>
              </Panel>

              <Panel>
                <PanelHeader eyebrow="Account" title="Ready to continue?" />
                <div className="grid gap-2 p-4">
                  <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="/register" pendingLabel="Opening registration...">
                    Create account
                  </PendingLink>
                  <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/sign-in?redirect=/" pendingLabel="Opening sign in...">
                    Sign in
                  </PendingLink>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  let rooms: MatchRoom[] = [];
  let chatChannels: ChatChannel[] = [];
  let lobbyChannel: ChatChannel | null = null;
  let lobbyMessages: ChatMessage[] = [];
  let lobbyPinnedMessages: ChatPinnedMessage[] = [];
  let lobbyPresence: ChatPresenceSummary = { online_count: 0, active: [], typing: [] };
  let dmRequests: ChatDmRequest[] = [];
  let loadError: string | null = null;
  let lobbyError: string | null = null;

  try {
    const result = await listMatchRooms();
    rooms = sortRooms(result.rooms.filter((room) => actionStatuses.includes(room.status)));
  } catch {
    loadError = "Room activity could not load. Check your connection and try again.";
  }

  try {
    const [channelResult, dmRequestResult] = await Promise.all([
      listChatChannels(),
      listDmRequests()
    ]);
    chatChannels = channelResult.channels;
    dmRequests = dmRequestResult.requests;
    lobbyChannel = chatChannels.find((channel) => channel.slug === "global_lobby") ?? chatChannels[0] ?? null;
    if (lobbyChannel) {
      const result = await listChatMessages(lobbyChannel.slug, { limit: 60 });
      lobbyChannel = result.channel;
      lobbyMessages = result.messages;
      lobbyPinnedMessages = result.pinned_messages;
      lobbyPresence = result.presence;
      chatChannels = chatChannels.map((channel) => channel.id === result.channel.id ? { ...result.channel, unread_count: 0 } : channel);
    }
  } catch {
    lobbyError = "Community channels could not load right now.";
  }

  const openRooms = rooms.filter((room) => room.status === "open");
  const priorityRooms = rooms.slice(0, 5);

  return (
    <AppShell active="lobby">
      <section className="grid min-w-0 gap-5 md:gap-6">
        <section className="min-w-0 rounded-lg border border-line bg-navy-900 p-5 text-white shadow-panel md:p-7">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div className="min-w-0">
              <Badge tone="cyan">Free Fire beta lead - multi-game catalog</Badge>
              <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                Find a fair room. Fund once. Play under clear rules.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Skillsroom keeps private match entries, evidence, and admin decisions in one visible flow.
              </p>
              <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
                <PendingLink
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover sm:w-auto"
                  href="/matches"
                  pendingLabel="Opening rooms..."
                >
                  Open rooms
                </PendingLink>
                <PendingLink
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-white/10 bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh sm:w-auto"
                  href="/matches/new"
                  pendingLabel="Opening creator..."
                >
                  Create room
                </PendingLink>
                <PendingLink
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-white/10 bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh sm:w-auto"
                  href="/community"
                  pendingLabel="Opening community..."
                >
                  Community pulse
                </PendingLink>
              </div>
            </div>
            <form action={joinMatchRoomAction} className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-3">
              <input name="error_path" type="hidden" value="/" />
              <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">
                Join room code
                <input
                  className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-white px-3 font-mono text-sm font-black uppercase text-ink outline-none focus:border-action"
                  name="room_code"
                  placeholder="SR8K21"
                  required
                />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <SubmitButton idleLabel="Join" pendingLabel="Joining..." />
                <PendingLink
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/10 bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
                  href="/matches/new"
                  pendingLabel="Opening creator..."
                >
                  Create
                </PendingLink>
              </div>
            </form>
          </div>
        </section>

        {(params?.error || loadError) ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {params?.error ?? loadError}
          </div>
        ) : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Can still be joined" label="Open Rooms" tone="cyan" value={openRooms.length.toString()} />
          <StatusPanel
            detail="Transfer review"
            label="Funding"
            tone="warning"
            value={countWhere(rooms, ["awaiting_funding", "funding_review", "funded"])}
          />
          <StatusPanel detail="Playing or reporting" label="Live Flow" tone="success" value={countWhere(rooms, ["active", "awaiting_results"])} />
          <StatusPanel detail="Needs decision" label="Review" tone="danger" value={countWhere(rooms, ["under_review", "disputed"])} />
        </div>

        {lobbyChannel ? (
          <GlobalLobbyClient channels={chatChannels} currentUserId={user.id} currentUserRole={user.role} initialChannel={lobbyChannel} initialMessages={lobbyMessages} initialPinnedMessages={lobbyPinnedMessages} initialPresence={lobbyPresence} initialDmRequests={dmRequests} />
        ) : (
          <Panel>
            <PanelHeader eyebrow="Global Lobby" title="Community chat unavailable" description={lobbyError ?? "The lobby channel is still warming up."} />
          </Panel>
        )}

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Panel>
            <PanelHeader
              action={
                <PendingLink className="rounded-md border border-line bg-white px-3 py-2 text-sm font-black text-ink hover:bg-surfaceHigh" href="/matches" pendingLabel="Opening rooms...">
                  View all rooms
                </PendingLink>
              }
              eyebrow="Lobby"
              title="Rooms needing players or action"
              description="Open rooms appear first, followed by rooms waiting on funding, play, evidence, or review."
            />
            {priorityRooms.length ? (
              <div>
                {priorityRooms.map((room) => (
                  <RoomCard key={room.id} room={room} />
                ))}
              </div>
            ) : (
              <div className="p-4">
                <div className="grid place-items-center rounded-md border border-dashed border-line bg-surfaceWarm p-8 text-center">
                  <div className="max-w-md">
                    <h3 className="text-lg font-black text-ink">No active rooms yet</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Create the first room for your game or share a room code from your community when one is ready.
                    </p>
                    <PendingLink
                      className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover"
                      href="/matches/new"
                      pendingLabel="Opening creator..."
                    >
                      Create room
                    </PendingLink>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <div className="grid gap-6">
            <Panel>
              <PanelHeader eyebrow="Room Flow" title="How every room moves" />
              <div className="grid gap-3 p-4">
                {roomSteps.map(([label, detail], index) => (
                  <div className="grid grid-cols-[2rem_1fr] gap-3" key={label}>
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-cyanSoft text-sm font-black text-cyan">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-black text-ink">{label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Trust" title="Before you play" />
              <div className="grid gap-3 p-4 text-sm leading-6 text-muted">
                <p className="rounded-md border border-line bg-surfaceWarm p-3">
                  Match entries are checked before play. Results need evidence before settlement.
                </p>
                <p className="rounded-md border border-line bg-surfaceWarm p-3">
                  Keep your in-game handle and screenshots clear so admins can review fast.
                </p>
              </div>
            </Panel>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
