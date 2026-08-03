import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { MotionSection, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getCurrentUser } from "@/lib/auth-bridge";
import { HomeLiveLobbyIsland } from "./HomeLiveLobbyIsland";
import {
  getProfileMe,
  getPlayerHomeSummary,
  type PlayerHomeReadiness,
  type PlayerHomeSummary,
  type PlayerLadderRow,
  type PlayerMission
} from "@/lib/match-room-api";
import { joinMatchRoomAction } from "./matches/actions";
import { RoomCodeInput } from "@/components/matches/RoomCodeInput";

type HomePageProps = {
  searchParams?: Promise<{ error?: string }>;
};

const premiumArtwork = {
  hero: "/marketing/skillsroom-premium/hero-premium.jpg",
  matchRooms: "/marketing/skillsroom-premium/match-rooms-premium.png",
  community: "/marketing/skillsroom-premium/community-premium.png",
  tournaments: "/marketing/skillsroom-premium/tournaments-premium.png",
  androidSecurity: "/marketing/skillsroom-android-security-check.jpeg"
} as const;

const androidApk = {
  href: "/downloads/skillsroom-android-v1.0.4-arm64.apk",
  version: "1.0.4",
  size: "43.0 MB"
} as const;

function firstName(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "player";
  return trimmed.split(/\s+/)[0];
}

function emailName(value?: string | null) {
  return value?.split("@")[0]?.replace(/[^A-Za-z0-9_]/g, "") || null;
}

function emptyHomeSummary(): PlayerHomeSummary {
  const emptyReadiness: PlayerHomeReadiness = {
    status: "needs_profile",
    label: "Open setup",
    detail: "Your home data could not load yet.",
    missing: ["setup"]
  };

  return {
    room_status_counts: {},
    active_room_previews: [],
    open_room_previews: [],
    recommended_room_previews: [],
    active_review_previews: [],
    open_tournament_previews: [],
    unread_notification_count: 0,
    wallet_mini_balance: {
      currency: "NGN",
      available_balance_minor: 0,
      locked_balance_minor: 0,
      winnings_balance_minor: 0,
      status: null
    },
    wallet_readiness: emptyReadiness,
    profile_readiness: emptyReadiness,
    play_now_counts: {
      open_rooms: 0,
      open_tournaments: 0,
      recommended_matches: 0,
      active_reviews: 0
    },
    daily_ladders: [],
    weekly_ladders: [],
    missions: [],
    active_tournament_preview_count: 0,
    community_highlights_preview: []
  };
}

function missionPercent(mission: PlayerMission) {
  if (mission.target <= 0) return mission.completed ? 100 : 0;
  return Math.min(100, Math.round((mission.progress / mission.target) * 100));
}

function LadderMiniCard({ row }: { row: PlayerLadderRow }) {
  return (
    <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-line bg-white p-3">
      <span className="grid h-10 w-10 place-items-center rounded-md bg-cyanSoft font-mono text-sm font-black text-cyan">#{row.rank}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-ink">{row.display_name || row.username || "Skillsroom player"}</p>
        <p className="mt-1 truncate text-xs font-bold text-muted">{row.game_name}{row.city ? ` / ${row.city}` : ""}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-black text-ink">{row.score}</p>
        <p className="text-xs font-bold text-muted">{row.wins} win{row.wins === 1 ? "" : "s"}</p>
      </div>
    </article>
  );
}

function MissionCard({ mission }: { mission: PlayerMission }) {
  const percent = missionPercent(mission);
  return (
    <article className="rounded-md border border-line bg-white p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone={mission.completed ? "success" : "cyan"}>{mission.completed ? "Done" : "Mission"}</Badge>
          <h3 className="mt-3 text-base font-black text-ink">{mission.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">{mission.detail}</p>
        </div>
        <span className="shrink-0 rounded-md border border-line bg-surfaceHigh px-3 py-2 font-mono text-xs font-black text-ink">
          {mission.progress}/{mission.target}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surfaceHigh">
        <div className={["h-full rounded-full", mission.completed ? "bg-success" : "bg-cyan"].join(" ")} style={{ width: `${percent}%` }} />
      </div>
      {!mission.completed ? (
        <PendingLink
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
          href={mission.action_href}
          pendingLabel="Opening..."
        >
          {mission.action_label}
        </PendingLink>
      ) : null}
    </article>
  );
}

function readinessTone(status: PlayerHomeReadiness["status"]) {
  if (status === "ready") return "success" as const;
  if (status === "blocked") return "danger" as const;
  if (status === "needs_review") return "warning" as const;
  return "cyan" as const;
}

function ReadinessCard({ title, readiness, href, actionLabel }: { title: string; readiness: PlayerHomeReadiness; href: string; actionLabel: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={readinessTone(readiness.status)}>{readiness.label}</Badge>
      </div>
      <h3 className="mt-3 text-base font-black text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{readiness.detail}</p>
      <PendingLink className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href={href} pendingLabel="Opening...">
        {actionLabel}
      </PendingLink>
    </div>
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

function AndroidAppTrustPanel({ compact = false }: { compact?: boolean }) {
  return (
    <Panel>
      <PanelHeader
        eyebrow="Android app"
        title="Install the Skillsroom app"
        description="The Android release is available as an official Skillsroom download."
      />
      <div className={["grid gap-4 p-4", compact ? "" : "lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center"].join(" ")}>
        <div className="min-w-0">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border border-line bg-surfaceHigh p-3">
              <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Version</p>
              <p className="mt-2 text-sm font-black text-ink">{androidApk.version}</p>
            </div>
            <div className="rounded-md border border-line bg-surfaceHigh p-3">
              <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Size</p>
              <p className="mt-2 text-sm font-black text-ink">{androidApk.size}</p>
            </div>
            <div className="rounded-md border border-line bg-surfaceHigh p-3">
              <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim">Source</p>
              <p className="mt-2 text-sm font-black text-ink">Official</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">
            Recent device security checks reported no risks for the Skillsroom Android release. Android may still ask you to confirm before installing because the app is downloaded directly from Skillsroom.
          </p>
          <a
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover sm:w-auto"
            download
            href={androidApk.href}
          >
            Download Android app
          </a>
        </div>
        <div className="overflow-hidden rounded-lg border border-line bg-navy-900">
          <Image
            alt="Skillsroom Android app security check"
            className="h-auto w-full object-cover"
            height={360}
            sizes={compact ? "(max-width: 768px) 100vw, 360px" : "(min-width: 1024px) 18rem, 100vw"}
            src={premiumArtwork.androidSecurity}
            width={520}
          />
        </div>
      </div>
    </Panel>
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
          <MotionSection className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]" variant="hero">
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
                    <Reveal className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur" staggerIndex={0}>
                      <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">One clear flow</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">Room setup, proof, disputes, and final decisions all stay in one place.</p>
                    </Reveal>
                    <Reveal className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur" staggerIndex={1}>
                      <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Built for real matches</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">It is made for competitive players, hosts, and communities that want things handled properly.</p>
                    </Reveal>
                    <Reveal className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur" staggerIndex={2}>
                      <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Know the vibe</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">Explore community updates, winners, and game activity before creating your player profile.</p>
                    </Reveal>
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
                          Community pages show the kind of matches, events, winners, and updates happening around Skillsroom.
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
                        Community pages show the kind of matches, events, winners, and updates happening around Skillsroom.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </MotionSection>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Reveal>
            <Panel>
              <PanelHeader
                eyebrow="Product"
                title="What players can do here"
                description="Skillsroom is built for competitive gaming, not chance-based play."
              />
              <div className="grid gap-4 bg-[#0b1622] p-4 xl:grid-cols-3">
                <Reveal staggerIndex={0}>
                <PremiumFeatureCard
                  description="Create or join private rooms with clear rules, proof checks, payment review, and a proper result flow."
                  eyebrow="Match rooms"
                  image={premiumArtwork.matchRooms}
                  title="Private matches should feel clear from the first click."
                />
                </Reveal>
                <Reveal staggerIndex={1}>
                <PremiumFeatureCard
                  description="Use global chat, game channels, rankings, and player identity to make the platform feel active."
                  eyebrow="Community"
                  image={premiumArtwork.community}
                  title="A gaming platform should not feel empty when people arrive."
                />
                </Reveal>
                <Reveal staggerIndex={2}>
                <PremiumFeatureCard
                  description="Run brackets, stages, and winner updates in a way players and organizers can actually follow."
                  eyebrow="Tournaments"
                  image={premiumArtwork.tournaments}
                  title="Tournaments should feel organized, not stressful."
                />
                </Reveal>
              </div>
            </Panel>
            </Reveal>

            <div className="grid gap-6">
              <Reveal staggerIndex={1}>
              <AndroidAppTrustPanel compact />
              </Reveal>

              <Reveal staggerIndex={2}>
              <Panel>
                <PanelHeader eyebrow="Explore" title="See Skillsroom in motion" />
                <div className="grid gap-2 p-4">
                  <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="/community" pendingLabel="Opening community...">
                    Community and leaderboards
                  </PendingLink>
                  <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="/community/highlights" pendingLabel="Opening highlights...">
                    Highlights and winner pages
                  </PendingLink>
                  <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="/policies" pendingLabel="Opening policies...">
                    Rules and player guidance
                  </PendingLink>
                  <PendingLink className="rounded-md border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-surfaceHigh" href="/support" pendingLabel="Opening support...">
                    Help center
                  </PendingLink>
                </div>
              </Panel>
              </Reveal>

              <Reveal staggerIndex={3}>
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
              </Reveal>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const [summaryResult, profileResult] = await Promise.allSettled([
    getPlayerHomeSummary(),
    getProfileMe("summary")
  ]);
  const summary = summaryResult.status === "fulfilled" ? summaryResult.value : emptyHomeSummary();
  const profileOverview = profileResult.status === "fulfilled" ? profileResult.value : null;
  const profile = profileOverview?.profile ?? null;
  const greetingName = firstName(profile?.display_name ?? profile?.username ?? emailName(user.email));
  const communityHighlights = summary.community_highlights_preview ?? [];

  return (
    <AppShell active="home">
      <MotionSection className="grid min-w-0 gap-5 md:gap-6" variant="page">
        <MotionSection className="min-w-0 rounded-lg border border-line bg-navy-900 p-5 text-white shadow-panel md:p-7" variant="hero">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div className="min-w-0">
              <Badge tone="cyan">Skillsroom</Badge>
              <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                What can you play now, {greetingName}?
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Jump into open rooms, enter tournaments, finish matches that need you, or create a new challenge for another player.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <PendingLink
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover sm:flex-none"
                  href="/challenges?mode=create"
                  pendingLabel="Opening creator..."
                >
                  Create challenge
                </PendingLink>
                <PendingLink
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-md border border-white/10 bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh sm:flex-none"
                  href="/challenges"
                  pendingLabel="Opening challenges..."
                >
                  Find challenge
                </PendingLink>
              </div>
            </div>
            <form action={joinMatchRoomAction} className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-3" id="join-room-code">
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
                  pendingLabel="Opening room creator..."
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
              </div>
            </div>
          </div>
        </MotionSection>

        {params?.error ? (
          <Reveal className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger" variant="down">
            {params.error}
          </Reveal>
        ) : null}

        <HomeLiveLobbyIsland initialSummary={summary} />

        <Reveal>
          <AndroidAppTrustPanel />
        </Reveal>

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            <Reveal staggerIndex={0}>
            <Panel>
              <PanelHeader
                action={
                  <PendingLink className="rounded-md border border-line bg-white px-3 py-2 text-sm font-black text-ink hover:bg-surfaceHigh" href="/ladders" pendingLabel="Opening ladders...">
                    Open ladders
                  </PendingLink>
                }
                eyebrow="Missions"
                title="Small wins to chase"
                description="Daily progress loops that help you build a real player record without waiting for a big tournament."
              />
              <div className="grid gap-3 p-4">
                {(summary.missions ?? []).length ? (
                  summary.missions.slice(0, 5).map((mission) => (
                    <MissionCard key={mission.key} mission={mission} />
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-line bg-surfaceWarm p-5 text-center">
                    <h3 className="text-base font-black text-ink">Missions are loading</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">Complete your profile, finish matches, join events, and invite players to start filling this list.</p>
                  </div>
                )}
              </div>
            </Panel>
            </Reveal>

            <Reveal staggerIndex={1}>
            <Panel>
              <PanelHeader
                action={
                  <PendingLink className="rounded-md border border-line bg-white px-3 py-2 text-sm font-black text-ink hover:bg-surfaceHigh" href="/ladders" pendingLabel="Opening ladders...">
                    View all
                  </PendingLink>
                }
                eyebrow="Ladders"
                title="Today and this week"
                description="City and game ladders are based on approved match wins."
              />
              <div className="grid gap-4 p-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-ink">Daily ladder</h3>
                    <Badge tone="cyan">Today</Badge>
                  </div>
                  <div className="grid gap-2">
                    {(summary.daily_ladders ?? []).length ? (
                      summary.daily_ladders.slice(0, 4).map((row) => <LadderMiniCard key={`daily-${row.user_id}-${row.game_slug}`} row={row} />)
                    ) : (
                      <div className="rounded-md border border-dashed border-line bg-surfaceWarm p-4 text-sm font-bold text-muted">
                        No approved match win on today&apos;s ladder yet.
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-ink">Weekly ladder</h3>
                    <Badge tone="warning">This week</Badge>
                  </div>
                  <div className="grid gap-2">
                    {(summary.weekly_ladders ?? []).length ? (
                      summary.weekly_ladders.slice(0, 4).map((row) => <LadderMiniCard key={`weekly-${row.user_id}-${row.game_slug}`} row={row} />)
                    ) : (
                      <div className="rounded-md border border-dashed border-line bg-surfaceWarm p-4 text-sm font-bold text-muted">
                        No approved match win on this week&apos;s ladder yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
            </Reveal>

            <Reveal staggerIndex={1}>
            <Panel>
              <PanelHeader eyebrow="Ready Check" title="Before you play" />
              <div className="grid gap-3 p-4">
                <ReadinessCard actionLabel="Open profile" href="/profile" readiness={summary.profile_readiness} title="Profile" />
                <ReadinessCard actionLabel="Open wallet" href="/wallet" readiness={summary.wallet_readiness} title="Wallet" />
              </div>
            </Panel>
            </Reveal>

            <Reveal staggerIndex={2}>
            <Panel>
              <PanelHeader
                eyebrow="Community"
                title="Recent winners"
                action={
                  <PendingLink className="rounded-md border border-line bg-white px-3 py-2 text-sm font-black text-ink hover:bg-surfaceHigh" href="/community" pendingLabel="Opening community...">
                    Open community
                  </PendingLink>
                }
              />
              <div className="grid gap-3 p-4">
                {communityHighlights.length ? (
                  communityHighlights.slice(0, 3).map((highlight) => (
                    <PendingLink
                      className="rounded-md border border-line bg-white p-3 text-sm hover:bg-surfaceHigh"
                      href={`/community/winners/tournaments/${encodeURIComponent(highlight.tournament_id)}`}
                      key={highlight.tournament_id}
                      pendingLabel="Opening winner page..."
                    >
                      <p className="font-black text-ink">{highlight.title}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                        {highlight.game_name} / {highlight.champion_entry_name ?? "Winner confirmed"}
                      </p>
                    </PendingLink>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-line bg-surfaceWarm p-5 text-center">
                    <h3 className="text-base font-black text-ink">No winner posts yet</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">Completed events will appear here after results are approved.</p>
                  </div>
                )}
              </div>
            </Panel>
            </Reveal>
        </div>
      </MotionSection>
    </AppShell>
  );
}
