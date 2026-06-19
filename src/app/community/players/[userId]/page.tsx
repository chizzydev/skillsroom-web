import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { ApiRequestError, getCommunityPlayerRanking, type LeaderboardRow } from "@/lib/match-room-api";
import { shareMetadata } from "@/lib/share-cards";

type PlayerRankPageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{
    game_slug?: string;
    city?: string;
    campus?: string;
    region?: string;
  }>;
};

function cleanFilter(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function displayName(row: LeaderboardRow) {
  return row.display_name || row.username;
}

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params;
  try {
    const ranking = await getCommunityPlayerRanking(userId);
    return shareMetadata({
      title: `${displayName(ranking.player)} on Skillsroom`,
      description: `Rank #${ranking.player.rank} player profile with match record and tournament results on Skillsroom.`,
      path: `/community/players/${encodeURIComponent(userId)}`
    });
  } catch {
    return shareMetadata({
      title: "Skillsroom Player Ranking",
      description: "Player profile, rank, and public match history on Skillsroom.",
      path: `/community/players/${encodeURIComponent(userId)}`
    });
  }
}

export default async function CommunityPlayerPage({ params, searchParams }: PlayerRankPageProps) {
  const { userId } = await params;
  const query = await searchParams;
  let ranking: Awaited<ReturnType<typeof getCommunityPlayerRanking>>;

  try {
    ranking = await getCommunityPlayerRanking(userId, {
      game_slug: cleanFilter(query.game_slug),
      city: cleanFilter(query.city),
      campus: cleanFilter(query.campus),
      region: cleanFilter(query.region)
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  const player = ranking.player;

  return (
    <AppShell active="community">
      <section className="grid gap-6">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(320px,38%)]">
            <div className="relative p-5 md:p-7 lg:p-9">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(33,170,255,0.18),transparent_36%)]" />
              <div className="relative">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge tone="cyan">Player ranking</Badge>
                  <Badge tone={player.rank <= 3 ? "success" : "neutral"}>Rank #{player.rank}</Badge>
                </div>
                <h1 className="mt-3 break-words text-3xl font-black leading-tight [overflow-wrap:anywhere] sm:text-4xl lg:text-5xl">
                  {displayName(player)}
                </h1>
                <p className="mt-2 font-mono text-sm font-bold text-slate-300">@{player.username}</p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  This ranking is based on match history, reputation, tournament finishes, and trust penalties.
                </p>
                <div className="mt-8 grid gap-3 xl:max-w-2xl xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Visible score</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Public rank turns verified history into something players can quickly read and compare.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Verified play</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Wins, losses, tournament finishes, and trust penalties all influence the same public record.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Scene context</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Game focus and location filters help people understand the environment behind the ranking.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative min-h-[300px] border-t border-white/10 xl:min-h-full xl:border-l xl:border-t-0">
              <Image alt="Premium Skillsroom community player artwork" className="object-cover" fill priority sizes="(min-width: 1280px) 38vw, 100vw" src="/marketing/skillsroom-premium/community-premium.png" />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#08131f]/80" />
              <div className="absolute inset-x-4 bottom-4 md:inset-x-6">
                <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Public competitor card</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">A simple way to show rank, reputation, and match history without exposing private admin data.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Public ranking score" label="Score" tone="cyan" value={player.leaderboard_score.toString()} />
          <StatusPanel detail={`${player.wins} wins / ${player.losses} losses`} label="Record" tone="success" value={`${player.wins}-${player.losses}`} />
          <StatusPanel detail="Settled matches" label="Matches" tone="success" value={player.completed_matches.toString()} />
          <StatusPanel detail="Winner placements" label="Tournament Wins" tone="warning" value={player.tournament_wins.toString()} />
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Panel>
            <PanelHeader eyebrow="Competition Stats" title="Public record" description="Only public, aggregate player stats are shown." />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <StatusPanel detail="Platform trust score" label="Reputation" tone="success" value={player.reputation_score.toString()} />
              <StatusPanel detail="Completed event entries" label="Tournaments" tone="cyan" value={player.completed_tournaments.toString()} />
              <StatusPanel detail="Top-three finishes" label="Podiums" tone="success" value={player.podium_finishes.toString()} />
              <StatusPanel detail={`${player.disputes_lost} disputes / ${player.no_shows} no-shows`} label="Trust Penalties" tone={player.disputes_lost || player.no_shows ? "warning" : "success"} value={(player.disputes_lost + player.no_shows).toString()} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Scene" title="Game and location" />
            <div className="grid gap-3 p-4 text-sm">
              <div className="rounded-2xl border border-line bg-surfaceWarm p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">Game</p>
                <p className="mt-2 font-black text-ink">{player.primary_game_name ?? "Any game"}</p>
                {player.primary_game_handle ? <p className="mt-1 font-mono text-xs font-bold text-muted">{player.primary_game_handle}</p> : null}
              </div>
              <div className="rounded-2xl border border-line bg-surfaceWarm p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">Location</p>
                <p className="mt-2 font-black text-ink">{[player.city, player.campus].filter(Boolean).join(" / ") || player.region}</p>
              </div>
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader eyebrow="Nearby" title="Players around this rank" description="A compact view of the surrounding leaderboard positions." />
          {ranking.nearby.length ? (
            <DataTable
              columns={[
                { key: "rank", label: "Rank", render: (row) => <span className="font-mono font-black text-ink">#{row.rank}</span> },
                {
                  key: "username",
                  label: "Player",
                  render: (row) => (
                    <Link className="font-bold text-ink hover:text-action" href={`/community/players/${encodeURIComponent(row.user_id)}`}>
                      {displayName(row)}
                    </Link>
                  )
                },
                { key: "leaderboard_score", label: "Score", render: (row) => <span className="font-mono text-muted">{row.leaderboard_score}</span> },
                { key: "wins", label: "Record", render: (row) => <span className="font-mono text-muted">{row.wins}-{row.losses}</span> },
                { key: "completed_matches", label: "Matches", render: (row) => <span className="font-mono text-muted">{row.completed_matches}</span> }
              ]}
              rows={ranking.nearby}
            />
          ) : null}
        </Panel>
      </section>
    </AppShell>
  );
}
