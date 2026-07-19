import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MotionSection, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PendingLink } from "@/components/ui/PendingLink";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getCurrentUser } from "@/lib/auth-bridge";
import {
  getPlayerEngagement,
  listGameCatalog,
  type Game,
  type PlayerEngagementSummary,
  type PlayerLadderRow,
  type PlayerMission
} from "@/lib/match-room-api";

export const metadata: Metadata = {
  title: "Ladders and Missions | Skillsroom",
  description: "Daily and weekly Skillsroom ladders by game and city, plus player missions that build steady match activity."
};

type LaddersPageProps = {
  searchParams: Promise<{
    game_slug?: string;
    city?: string;
  }>;
};

const emptyEngagement: PlayerEngagementSummary = {
  daily_ladders: [],
  weekly_ladders: [],
  missions: []
};

function cleanFilter(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function playerName(row: PlayerLadderRow) {
  return row.display_name || row.username || "Skillsroom player";
}

function missionPercent(mission: PlayerMission) {
  if (mission.target <= 0) return mission.completed ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round((mission.progress / mission.target) * 100)));
}

function safeMissionHref(href: string) {
  if (href.startsWith("/")) return href;
  return "/";
}

function gameLabel(games: Game[], slug?: string) {
  if (!slug) return "All games";
  return games.find((game) => game.slug === slug)?.name ?? slug;
}

async function withPageTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 4500): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

function LadderRowCard({ row }: { row: PlayerLadderRow }) {
  return (
    <article className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-line bg-white p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-cyanSoft font-mono text-base font-black text-cyan">
        #{row.rank}
      </span>
      <div className="min-w-0">
        <h3 className="truncate text-base font-black text-ink">{playerName(row)}</h3>
        <p className="mt-1 truncate text-sm font-bold text-muted">
          {row.game_name} / {row.city || row.region || "Online"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="success">{row.wins} win{row.wins === 1 ? "" : "s"}</Badge>
          <Badge tone="neutral">{row.matches_played} match{row.matches_played === 1 ? "" : "es"}</Badge>
        </div>
      </div>
      <div className="col-span-2 rounded-md border border-line bg-surfaceHigh p-3 text-left sm:col-span-1 sm:min-w-24 sm:text-right">
        <p className="font-mono text-xl font-black text-ink">{row.score}</p>
        <p className="text-xs font-bold text-muted">points</p>
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
          <Badge tone={mission.completed ? "success" : "cyan"}>{mission.completed ? "Done" : "Open"}</Badge>
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
      <PendingLink
        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
        href={safeMissionHref(mission.action_href)}
        pendingLabel="Opening..."
      >
        {mission.completed ? "View" : mission.action_label}
      </PendingLink>
    </article>
  );
}

function FilterLink({ href, children, active = false }: { href: string; children: React.ReactNode; active?: boolean }) {
  return (
    <PendingLink
      className={[
        "inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-sm font-black",
        active ? "border-green-200 bg-successSoft text-success" : "border-line bg-white text-muted hover:bg-surfaceHigh hover:text-ink"
      ].join(" ")}
      href={href}
      pendingLabel="Filtering..."
    >
      {children}
    </PendingLink>
  );
}

export default async function LaddersPage({ searchParams }: LaddersPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/ladders");

  const params = await searchParams;
  const selectedGameSlug = cleanFilter(params.game_slug);
  const selectedCity = cleanFilter(params.city);

  const [catalog, engagement] = await Promise.all([
    withPageTimeout(listGameCatalog(), { games: [], rulesets: [] }),
    withPageTimeout(getPlayerEngagement({ game_slug: selectedGameSlug, city: selectedCity }), emptyEngagement)
  ]);
  const games = catalog.games.filter((game) => game.status === "active");
  const completedMissions = engagement.missions.filter((mission) => mission.completed).length;
  const topDaily = engagement.daily_ladders[0];
  const topWeekly = engagement.weekly_ladders[0];
  const filterSummary = [gameLabel(games, selectedGameSlug), selectedCity].filter(Boolean).join(" in ");

  return (
    <AppShell active="home">
      <MotionSection className="grid min-w-0 gap-6" variant="page">
        <MotionSection className="rounded-lg border border-navy-800 bg-navy-950 p-5 text-white shadow-panel md:p-7" variant="hero">
          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <Badge tone="cyan" className="border-cyan/30 bg-cyan/10 text-cyan">Ladders and missions</Badge>
              <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                Chase today&apos;s ladder and keep your match habit moving.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Daily and weekly ladders rank approved match wins by game and city. Missions give you small next steps when there is no big tournament waiting.
              </p>
            </div>
            <div className="grid w-full min-w-0 gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[30rem]">
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-300">Daily leader</p>
                <p className="mt-1 truncate text-lg font-black text-white">{topDaily ? playerName(topDaily) : "Waiting"}</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-300">Weekly leader</p>
                <p className="mt-1 truncate text-lg font-black text-white">{topWeekly ? playerName(topWeekly) : "Waiting"}</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-300">Missions done</p>
                <p className="mt-1 truncate text-lg font-black text-white">{completedMissions}/{engagement.missions.length || 5}</p>
              </div>
            </div>
          </div>
        </MotionSection>

        <Panel>
          <PanelHeader
            eyebrow="Filters"
            title="Game and city"
            description={`Showing ${filterSummary || "all games and cities"}. City filters match public player profile city.`}
            action={<PendingLink className="rounded-md border border-line bg-white px-3 py-2 text-sm font-black text-ink hover:bg-surfaceHigh" href="/ladders" pendingLabel="Clearing...">Clear filters</PendingLink>}
          />
          <div className="grid gap-4 p-4">
            <div className="flex min-w-0 flex-wrap gap-2">
              <FilterLink active={!selectedGameSlug} href={selectedCity ? `/ladders?city=${encodeURIComponent(selectedCity)}` : "/ladders"}>
                All games
              </FilterLink>
              {games.slice(0, 10).map((game) => {
                const query = new URLSearchParams();
                query.set("game_slug", game.slug);
                if (selectedCity) query.set("city", selectedCity);
                return (
                  <FilterLink active={selectedGameSlug === game.slug} href={`/ladders?${query.toString()}`} key={game.slug}>
                    {game.name}
                  </FilterLink>
                );
              })}
            </div>
            <form action="/ladders" className="grid gap-3 rounded-md border border-line bg-surfaceHigh p-3 sm:grid-cols-[1fr_auto] sm:items-end">
              {selectedGameSlug ? <input name="game_slug" type="hidden" value={selectedGameSlug} /> : null}
              <label className="grid gap-2 text-sm font-black text-ink">
                City
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-action"
                  defaultValue={selectedCity ?? ""}
                  maxLength={80}
                  name="city"
                  placeholder="Lagos, Abuja, Port Harcourt"
                />
              </label>
              <SubmitButton idleLabel="Apply city" pendingLabel="Applying..." />
            </form>
          </div>
        </Panel>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="grid gap-6">
            <Reveal>
              <Panel>
                <PanelHeader eyebrow="Today" title="Daily ladder" description="Approved wins from today count here." />
                <div className="grid gap-3 p-4">
                  {engagement.daily_ladders.length ? (
                    engagement.daily_ladders.map((row, index) => (
                      <Reveal key={`daily-${row.user_id}-${row.game_slug}`} staggerIndex={index}>
                        <LadderRowCard row={row} />
                      </Reveal>
                    ))
                  ) : (
                    <EmptyState description="Finish a match with an approved result and today&apos;s ladder will start moving." title="No daily ladder activity yet" />
                  )}
                </div>
              </Panel>
            </Reveal>

            <Reveal>
              <Panel>
                <PanelHeader eyebrow="This week" title="Weekly ladder" description="Weekly ladders reset at the start of the week and use approved match wins." />
                <div className="grid gap-3 p-4">
                  {engagement.weekly_ladders.length ? (
                    engagement.weekly_ladders.map((row, index) => (
                      <Reveal key={`weekly-${row.user_id}-${row.game_slug}`} staggerIndex={index}>
                        <LadderRowCard row={row} />
                      </Reveal>
                    ))
                  ) : (
                    <EmptyState description="Approved match wins this week will appear here by player, game, and city." title="No weekly ladder activity yet" />
                  )}
                </div>
              </Panel>
            </Reveal>
          </div>

          <div className="grid content-start gap-6">
            <Reveal>
              <Panel>
                <PanelHeader eyebrow="Missions" title="Small actions, steady progress" description="These missions are based on your current player activity." />
                <div className="grid gap-3 p-4">
                  {engagement.missions.length ? (
                    engagement.missions.map((mission) => <MissionCard key={mission.key} mission={mission} />)
                  ) : (
                    <EmptyState description="Complete profile setup and play activity will start filling your mission list." title="No missions yet" />
                  )}
                </div>
              </Panel>
            </Reveal>
          </div>
        </div>
      </MotionSection>
    </AppShell>
  );
}
