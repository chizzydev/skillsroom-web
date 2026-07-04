import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getCurrentUser } from "@/lib/auth-bridge";
import {
  formatEntryAmount,
  listMatchRooms,
  matchStatusLabel,
  type MatchRoom,
  type MatchRoomStatus
} from "@/lib/match-room-api";
import { joinMatchRoomAction } from "./matches/actions";
import { RoomCodeInput } from "@/components/matches/RoomCodeInput";

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

const premiumArtwork = {
  hero: "/marketing/skillsroom-premium/hero-premium.jpg",
  matchRooms: "/marketing/skillsroom-premium/match-rooms-premium.png",
  community: "/marketing/skillsroom-premium/community-premium.png",
  tournaments: "/marketing/skillsroom-premium/tournaments-premium.png"
} as const;

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

function PremiumFeatureCard({
  image,
  eyebrow,
  title,
  description
}: {
  image: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <article className="group overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#132131] shadow-[0_30px_80px_rgba(3,10,20,0.32)]">
      <div className="relative h-72 overflow-hidden">
        <Image alt={title} className="object-cover transition duration-500 group-hover:scale-[1.03]" fill sizes="(min-width: 1280px) 30vw, (min-width: 768px) 50vw, 100vw" src={image} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09131f] via-[#09131f]/28 to-transparent" />
        <div className="absolute inset-x-4 bottom-4">
          <span className="inline-flex rounded-full border border-white/15 bg-black/25 px-3 py-1 font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">
            {eyebrow}
          </span>
        </div>
      </div>
      <div className="p-5 text-white">
        <h3 className="text-xl font-black leading-tight">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
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
          <section className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(320px,42%)]">
              <div className="relative p-5 md:p-7 lg:p-9">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(33,170,255,0.18),transparent_36%)]" />
                <div className="relative">
                  <Badge tone="cyan">Skill-based gaming platform</Badge>
                  <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                    Create fair match rooms, join tournaments, and play under clear rules.
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                    Skillsroom gives players and organizers one place to manage rooms, results, disputes, and tournament play without confusing side chats and guesswork.
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
                  <div className="relative mt-8 grid gap-3 xl:max-w-2xl xl:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                      <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">One clear flow</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">Room setup, proof, disputes, and final decisions all stay in one place.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                      <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Built for real matches</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">It is made for competitive players, hosts, and communities that want things handled properly.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                      <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Check before joining</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">Public community pages and policies are open first, so people can look around before signing in.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 lg:min-h-full lg:border-l lg:border-t-0">
                <div className="relative min-h-[320px] md:min-h-[380px] lg:min-h-full">
                  <Image alt="Premium Skillsroom competitive gaming scene" className="object-cover" fill priority sizes="(min-width: 1024px) 42vw, 100vw" src={premiumArtwork.hero} />
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#08131f]/80" />
                  <div className="absolute inset-x-4 bottom-4 hidden gap-3 md:inset-x-6 md:grid">
                    <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">How it works</p>
                      <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-200">
                        <p className="rounded-xl border border-white/10 bg-white/5 p-3">
                          Players join rooms and tournaments with clear rules instead of trying to sort everything out in random chats.
                        </p>
                        <p className="rounded-xl border border-white/10 bg-white/5 p-3">
                          Payment checks, match proof, disputes, and admin decisions stay attached to the room or tournament record.
                        </p>
                        <p className="rounded-xl border border-white/10 bg-white/5 p-3">
                          Public policies, support pages, and community sections are visible before sign-in so new users can look around first.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 border-t border-white/10 bg-[#08131f] p-4 md:hidden">
                  <div className="rounded-2xl border border-white/10 bg-[#09131f] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">How it works</p>
                    <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-200">
                      <p className="rounded-xl border border-white/10 bg-white/5 p-3">
                        Players join rooms and tournaments with clear rules instead of trying to sort everything out in random chats.
                      </p>
                      <p className="rounded-xl border border-white/10 bg-white/5 p-3">
                        Payment checks, match proof, disputes, and admin decisions stay attached to the room or tournament record.
                      </p>
                      <p className="rounded-xl border border-white/10 bg-white/5 p-3">
                        Public policies, support pages, and community sections are visible before sign-in so new users can look around first.
                      </p>
                    </div>
                  </div>
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
              <div className="grid gap-4 bg-[#0b1622] p-4 xl:grid-cols-3">
                <PremiumFeatureCard
                  description="Create or join private rooms with clear rules, proof checks, payment review, and a proper result flow."
                  eyebrow="Match rooms"
                  image={premiumArtwork.matchRooms}
                  title="Private matches should feel clear from the first click."
                />
                <PremiumFeatureCard
                  description="Use global chat, game channels, rankings, and player identity to make the platform feel active."
                  eyebrow="Community"
                  image={premiumArtwork.community}
                  title="A gaming platform should not feel empty when people arrive."
                />
                <PremiumFeatureCard
                  description="Run brackets, stages, and winner updates in a way players and organizers can actually follow."
                  eyebrow="Tournaments"
                  image={premiumArtwork.tournaments}
                  title="Tournaments should feel organized, not stressful."
                />
              </div>
            </Panel>

            <div className="grid gap-6">
              <Panel>
                <PanelHeader eyebrow="Look around first" title="Public pages" />
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
  let loadError: string | null = null;

  try {
    const result = await listMatchRooms();
    rooms = sortRooms(result.rooms.filter((room) => actionStatuses.includes(room.status)));
  } catch {
    loadError = "Room activity could not load. Check your connection and try again.";
  }

  const openRooms = rooms.filter((room) => room.status === "open");
  const priorityRooms = rooms.slice(0, 5);

  return (
    <AppShell active="home">
      <section className="grid min-w-0 gap-5 md:gap-6">
        <section className="min-w-0 rounded-lg border border-line bg-navy-900 p-5 text-white shadow-panel md:p-7">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div className="min-w-0">
              <Badge tone="cyan">Multi-game catalog</Badge>
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
                  href="/notifications"
                  pendingLabel="Opening inbox..."
                >
                  Inbox
                </PendingLink>
              </div>
            </div>
            <form action={joinMatchRoomAction} className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-3">
              <input name="error_path" type="hidden" value="/" />
              <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">
                Join room code
                <RoomCodeInput />
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
          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0d1824]">
            <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="relative min-h-[280px]">
                <Image alt="Skillsroom premium hero" className="object-cover" fill sizes="(min-width: 1024px) 55vw, 100vw" src={premiumArtwork.hero} />
                <div className="absolute inset-0 bg-gradient-to-r from-[#08131f]/12 via-[#08131f]/38 to-[#08131f]" />
              </div>
              <div className="grid gap-3 p-5">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Clear match setup</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">Before a match starts, both players can see the rules, the room status, and what happens next.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Everything stays connected</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">You can move from chat to room to result review without feeling lost or starting over.</p>
                </div>
              </div>
            </div>
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
