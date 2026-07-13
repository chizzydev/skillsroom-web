import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PublicSharePanel } from "@/components/community/PublicSharePanel";
import { MotionSection, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getCurrentUser } from "@/lib/auth-bridge";
import {
  getCommunitySocialProof,
  listCommunityAnnouncements,
  listCommunityClans,
  listCommunityHighlights,
  listLeaderboard,
  type CommunityAnnouncement,
  type CommunityClanListItem,
  type CommunityClanListResponse,
  type CommunityHighlightsResponse,
  type CommunityLeaderboardResponse,
  type CommunityLeaderboardSummary,
  type CommunitySocialProofMetrics,
  type CommunityTournamentHighlightCard,
  type CommunityAnnouncementListResponse,
  type LeaderboardRow
} from "@/lib/match-room-api";
import { shareMetadata, shareUrl } from "@/lib/share-cards";
import { createRoomInviteAction } from "./actions";

export const metadata: Metadata = shareMetadata({
  title: "Skillsroom Community Leaderboards",
  description: "Player rankings, local scenes, clans, and recent highlights from the Skillsroom community.",
  path: "/community"
});

type CommunityPageProps = {
  searchParams: Promise<{
    error?: string;
    game_slug?: string;
    city?: string;
    campus?: string;
    region?: string;
  }>;
};

const premiumArtwork = {
  community: "/marketing/skillsroom-premium/community-premium.png",
  tournaments: "/marketing/skillsroom-premium/tournaments-premium.png"
} as const;

function cleanFilter(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function displayName(row: LeaderboardRow) {
  return row.display_name || row.username;
}

function withPageTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 3500): Promise<T> {
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

const emptyLeaderboardSummary: CommunityLeaderboardSummary = {
  ranked_players: 0,
  completed_matches: 0,
  completed_tournaments: 0,
  tournament_wins: 0,
  podium_finishes: 0,
  active_games: 0,
  active_cities: 0,
  active_campuses: 0
};

const emptySocialProofMetrics: CommunitySocialProofMetrics = {
  as_of: new Date(0).toISOString(),
  rooms_created: 0,
  matches_completed: 0,
  tournaments_hosted: 0,
  winners_crowned: 0,
  disputes_resolved: 0,
  players_registered: 0,
  clans_created: 0,
  entries_checked_in: 0,
  prize_reservations_count: 0,
  prize_reservations_minor: 0,
  payout_queue_count: 0,
  payout_queue_minor: 0,
  refund_queue_count: 0,
  refund_queue_minor: 0,
  verified_payout_metrics_enabled: false,
  verified_payouts_completed_count: null,
  verified_payouts_completed_minor: null
};

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const filters = {
    game_slug: cleanFilter(params.game_slug),
    city: cleanFilter(params.city),
    campus: cleanFilter(params.campus),
    region: cleanFilter(params.region),
    limit: 36
  };

  let leaderboardResult: Awaited<ReturnType<typeof listLeaderboard>> | null = null;
  let highlights: CommunityTournamentHighlightCard[] = [];
  let announcements: CommunityAnnouncement[] = [];
  let clans: CommunityClanListItem[] = [];
  let socialProof: CommunitySocialProofMetrics | null = null;
  const [leaderboardResponse, highlightsResult, announcementResult, clanResult, socialProofResult] = await Promise.all([
    withPageTimeout<CommunityLeaderboardResponse>(listLeaderboard(filters), { filters, leaderboard: [], summary: emptyLeaderboardSummary }),
    withPageTimeout<CommunityHighlightsResponse>(listCommunityHighlights(6), { tournament_highlights: [] }),
    withPageTimeout<CommunityAnnouncementListResponse>(listCommunityAnnouncements({ limit: 4 }), { announcements: [] }),
    withPageTimeout<CommunityClanListResponse>(listCommunityClans({ ...filters, limit: 3 }), { clans: [] }),
    withPageTimeout<{ metrics: CommunitySocialProofMetrics }>(getCommunitySocialProof(), { metrics: emptySocialProofMetrics })
  ]);
  leaderboardResult = leaderboardResponse;
  highlights = highlightsResult.tournament_highlights;
  announcements = announcementResult.announcements;
  clans = clanResult.clans;
  socialProof = socialProofResult.metrics;

  const leaderboard = leaderboardResult?.leaderboard ?? [];
  const summary = leaderboardResult?.summary;

  return (
    <AppShell active="community">
      <MotionSection className="grid gap-6" variant="page">
        <MotionSection className="overflow-hidden rounded-[1.6rem] border border-[#203244] bg-[#09131f] shadow-[0_36px_100px_rgba(4,10,20,0.28)]" variant="hero">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(320px,40%)]">
            <div className="relative p-5 text-white md:p-7">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.15),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(33,170,255,0.18),transparent_32%)]" />
              <div className="relative">
                <Badge tone="cyan">Community</Badge>
                <h1 className="mt-3 max-w-4xl break-words text-2xl font-black leading-tight [overflow-wrap:anywhere] md:text-4xl">
                  See who is winning and what is happening in the community.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  Check player rankings, match records, tournament results, clans, and recent highlights in one place.
                </p>
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <Reveal className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur" staggerIndex={0}>
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Player rankings</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">See public profiles, finished matches, and tournament results without digging around.</p>
                  </Reveal>
                  <Reveal className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur" staggerIndex={1}>
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Local scenes</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Browse players and teams by city, campus, region, or game.</p>
                  </Reveal>
                  <Reveal className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur" staggerIndex={2}>
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Recent winners</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Catch up on highlights from completed tournaments and standout players.</p>
                  </Reveal>
                </div>
              </div>
            </div>
            <div className="relative min-h-[320px] border-t border-white/10 lg:border-l lg:border-t-0">
              <Image alt="Skillsroom community artwork" className="object-cover" fill priority sizes="(min-width: 1024px) 40vw, 100vw" src={premiumArtwork.community} />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#09131f]/72" />
            </div>
          </div>
        </MotionSection>

        {params.error && (
          <Reveal className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger" variant="down">
            {params.error}
          </Reveal>
        )}

        <Reveal>
        <Panel>
          <PanelHeader eyebrow="Filters" title="Find players faster" description="Filter the leaderboard by game, city, campus, or region." />
          <form className="grid gap-3 p-4 md:grid-cols-5" method="GET">
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={filters.game_slug ?? ""} name="game_slug" placeholder="Game slug" />
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={filters.city ?? ""} name="city" placeholder="City" />
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={filters.campus ?? ""} name="campus" placeholder="Campus / community" />
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={filters.region ?? ""} name="region" placeholder="Region" />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
              <SubmitButton idleLabel="Apply" pendingLabel="Applying..." />
              <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href="/community">
                Clear
              </Link>
            </div>
          </form>
        </Panel>
        </Reveal>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal staggerIndex={0}><StatusPanel detail="Public profiles ranked" label="Players" tone="cyan" value={(summary?.ranked_players ?? 0).toString()} /></Reveal>
          <Reveal staggerIndex={1}><StatusPanel detail="Settled match history" label="Matches" tone="success" value={(summary?.completed_matches ?? 0).toString()} /></Reveal>
          <Reveal staggerIndex={2}><StatusPanel detail="Completed events entered" label="Tournaments" tone="warning" value={(summary?.completed_tournaments ?? 0).toString()} /></Reveal>
          <Reveal staggerIndex={3}><StatusPanel detail="Winner/podium signals" label="Podiums" tone="success" value={(summary?.podium_finishes ?? 0).toString()} /></Reveal>
        </div>

        <Reveal as="section" className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="overflow-hidden rounded-[1.5rem] border border-[#203244] bg-[#0a1521] shadow-[0_28px_80px_rgba(4,10,20,0.24)]">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(240px,40%)]">
              <div className="p-5 text-white">
                <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Why this page matters</p>
                <h2 className="mt-3 text-2xl font-black leading-tight">A strong community page gives people a reason to stay.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  When people can quickly see rankings, results, clans, and updates, the platform feels active and easier to come back to.
                </p>
              </div>
              <div className="relative min-h-[260px] border-t border-white/10 lg:border-l lg:border-t-0">
                <Image alt="Skillsroom tournament artwork" className="object-cover" fill sizes="(min-width: 1024px) 32vw, 100vw" src={premiumArtwork.tournaments} />
                <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#0a1521]/72" />
              </div>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="rounded-[1.5rem] border border-[#203244] bg-[#0a1521] p-5 text-white shadow-[0_28px_80px_rgba(4,10,20,0.24)]">
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Easy to browse</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">People should understand what they are seeing without guessing what each section means.</p>
            </div>
            <div className="rounded-[1.5rem] border border-[#203244] bg-[#0a1521] p-5 text-white shadow-[0_28px_80px_rgba(4,10,20,0.24)]">
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Easy to share</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">Good rankings and highlights are easier for players to send to friends, teams, and group chats.</p>
            </div>
          </div>
        </Reveal>

        <Reveal>
        <Panel>
          <PanelHeader
            eyebrow="Proof"
            title="Live platform proof"
            description="Live numbers from real rooms, tournaments, winners, and pending payouts."
            action={
              <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href="/community/proof">
                Open proof dashboard
              </Link>
            }
          />
          {socialProof ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatusPanel detail="Finished matches on the platform" label="Matches Completed" tone="success" value={socialProof.matches_completed.toString()} />
              <StatusPanel detail="Events that have been created or completed" label="Tournaments Hosted" tone="warning" value={socialProof.tournaments_hosted.toString()} />
              <StatusPanel detail="Approved room and tournament winners" label="Winners Crowned" tone="success" value={socialProof.winners_crowned.toString()} />
              <StatusPanel detail="Payouts still waiting in queue" label="Payout Queue" tone="warning" value={socialProof.payout_queue_count.toString()} />
            </div>
          ) : (
            <div className="p-4">
              <EmptyState title="Platform numbers unavailable" description="The latest platform numbers could not be loaded right now." />
            </div>
          )}
        </Panel>
        </Reveal>

        <Reveal>
        <Panel>
          <PublicSharePanel
            eyebrow="Share"
            panelTitle="Share the community board"
            panelDescription="Share rankings, highlights, and community activity to WhatsApp or social media with a clean preview."
            summary="Public rankings, recent winners, live stats, and community activity on Skillsroom."
            title="Skillsroom Community"
            url={shareUrl("/community")}
          />
        </Panel>
        </Reveal>

        <Reveal>
        <Panel>
          <PanelHeader
            eyebrow="Announcements"
            title="Platform and tournament news"
            description="Updates from Skillsroom and posts from tournament hosts."
            action={
              <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href="/community/announcements">
                Open news feed
              </Link>
            }
          />
          {announcements.length ? (
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {announcements.map((item) => (
                <Link
                  className="grid gap-3 rounded-md border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh"
                  href={`/community/announcements/${encodeURIComponent(item.id)}`}
                  key={item.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.priority === "critical" ? "danger" : item.priority === "high" ? "warning" : "cyan"}>{item.priority}</Badge>
                    <Badge tone="neutral">{item.category.replaceAll("_", " ")}</Badge>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-ink">{item.title}</h2>
                    <p className="mt-1 text-sm text-muted">{item.summary}</p>
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                    {item.scope === "tournament" ? item.tournament_title ?? "Tournament" : "Platform"} · {new Date(item.published_at ?? item.created_at).toLocaleDateString("en-NG")}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState description="Published community news will appear here once operators or tournament hosts post updates." title="No news yet" />
            </div>
          )}
        </Panel>
        </Reveal>

        <Reveal>
        <Panel>
          <PanelHeader
            eyebrow="Highlights"
            title="Recent winners and completed events"
            description="Approved tournament results and public highlights show up here."
            action={
              <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href="/community/highlights">
                Open highlights
              </Link>
            }
          />
          {highlights.length ? (
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              {highlights.map((item) => (
                <Link
                  className="grid gap-3 rounded-md border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh"
                  href={`/community/winners/tournaments/${encodeURIComponent(item.tournament_id)}`}
                  key={item.tournament_id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="success">Winner crowned</Badge>
                    <Badge tone="cyan">{item.game_name}</Badge>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-ink">{item.title}</h2>
                    <p className="mt-1 text-sm text-muted">{item.champion_entry_name ?? "Champion decided"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Format</p>
                      <p className="mt-1 font-bold text-ink">{item.format.replaceAll("_", " ")}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Entries</p>
                      <p className="mt-1 font-bold text-ink">{item.registered_entry_count}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState description="Completed tournaments with approved winners will appear here." title="No highlights yet" />
            </div>
          )}
        </Panel>
        </Reveal>

        <Reveal>
        <Panel>
          <PanelHeader
            eyebrow="Clans"
            title="Public clans and team profiles"
            description="See captains, game focus, team records, and public clan identity."
            action={
              <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href="/community/clans">
                Open clans
              </Link>
            }
          />
          {clans.length ? (
            <div className="grid gap-4 p-4 md:grid-cols-3">
              {clans.map((clan) => (
                <Link className="grid gap-3 rounded-md border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh" href={`/community/clans/${encodeURIComponent(clan.slug)}`} key={clan.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="cyan">{clan.tag ?? "Clan"}</Badge>
                    {clan.game_focus.slice(0, 2).map((game) => <Badge key={game} tone="neutral">{game}</Badge>)}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-ink">{clan.name}</h2>
                    <p className="mt-1 text-sm text-muted">{clan.captain_display_name || clan.captain_username || "Visible captain"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Record</p>
                      <p className="mt-1 font-mono font-bold text-ink">{clan.match_record.wins}-{clan.match_record.losses}-{clan.match_record.draws}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Reputation</p>
                      <p className="mt-1 font-mono font-bold text-ink">{clan.reputation_score}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState description="Clan profiles appear here after captains publish a public team identity." title="No public clans yet" />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Leaderboard" title="Top public players" description="Scores reflect wins, activity, tournament results, disputes, and no-shows." />
          {leaderboard.length ? (
            <DataTable
              columns={[
                { key: "rank", label: "Rank", render: (row) => <span className="font-mono text-lg font-black text-ink">#{row.rank}</span> },
                {
                  key: "username",
                  label: "Player",
                  render: (row) => (
                    <Link className="grid gap-1 hover:text-action" href={`/community/players/${encodeURIComponent(row.user_id)}`}>
                      <strong className="text-ink">{displayName(row)}</strong>
                      <span className="font-mono text-xs font-bold text-muted">@{row.username}</span>
                    </Link>
                  )
                },
                { key: "leaderboard_score", label: "Score", render: (row) => <span className="font-mono font-black text-ink">{row.leaderboard_score}</span> },
                { key: "primary_game_name", label: "Game", render: (row) => <span className="text-muted">{row.primary_game_name ?? "Any game"}</span> },
                { key: "city", label: "Scene", render: (row) => <span className="text-muted">{[row.city, row.campus].filter(Boolean).join(" / ") || row.region}</span> },
                { key: "wins", label: "Record", render: (row) => <span className="font-mono text-muted">{row.wins}-{row.losses}</span> },
                { key: "completed_matches", label: "Matches", render: (row) => <span className="font-mono text-muted">{row.completed_matches}</span> },
                { key: "tournament_wins", label: "Tourneys", render: (row) => <Badge tone={row.tournament_wins > 0 ? "success" : "neutral"}>{row.tournament_wins} wins</Badge> }
              ]}
              rowKey={(row) => row.user_id}
              rows={leaderboard}
            />
          ) : (
            <div className="p-4">
              <EmptyState description="Public players appear here after they complete profiles, choose public visibility, and build verified match or tournament history." title="No public rankings yet" />
            </div>
          )}
        </Panel>
        </Reveal>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Reveal>
          <Panel>
            <PanelHeader eyebrow="Activity" title="Community feed" description={user ? "Recent account activity loads after the public board." : "Sign in to see your private invites and account activity."} />
            <div className="p-4">
              <EmptyState description={user ? "Open notifications for private room activity while the community board stays lightweight." : "Public leaderboards are visible now. Sign in for your private invite feed."} title="Private activity deferred" />
            </div>
          </Panel>
          </Reveal>

          {user ? (
            <Reveal staggerIndex={1}>
            <Panel>
              <PanelHeader eyebrow="Invite" title="Invite a player to a room" description="Enter your room code and the player's Skillsroom username." />
              <form action={createRoomInviteAction} className="grid gap-3 p-4">
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm uppercase outline-none focus:border-action" name="match_room_code" placeholder="Room code, e.g. SR8K21" required />
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  maxLength={24}
                  minLength={3}
                  name="invitee_username"
                  pattern="[A-Za-z0-9_]+"
                  placeholder="Invitee username"
                  required
                />
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="message" placeholder="Message" />
                <SubmitButton idleLabel="Send invite" pendingLabel="Sending invite..." />
              </form>
            </Panel>
            </Reveal>
          ) : (
            <Reveal staggerIndex={1}>
            <Panel>
              <PanelHeader eyebrow="Join" title="Get on the board" description="Sign in to build your profile and appear in public rankings." />
              <div className="grid gap-3 p-4">
                <Link className="inline-flex min-h-control items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="/sign-in?redirect=/profile">
                  Sign in
                </Link>
              </div>
            </Panel>
            </Reveal>
          )}
        </div>
      </MotionSection>
    </AppShell>
  );
}
