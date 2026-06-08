import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PublicSharePanel } from "@/components/community/PublicSharePanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { ApiRequestError, formatMinorMoney, getTournamentWinnerPage } from "@/lib/match-room-api";
import { shareMetadata, shareUrl } from "@/lib/share-cards";

type TournamentWinnerPageProps = {
  params: Promise<{ tournamentId: string }>;
};

export async function generateMetadata({ params }: TournamentWinnerPageProps): Promise<Metadata> {
  const { tournamentId } = await params;
  try {
    const winnerPage = await getTournamentWinnerPage(tournamentId);
    return shareMetadata({
      title: `${winnerPage.winner.player_label} won ${winnerPage.tournament.title}`,
      description: `${winnerPage.winner.result_label} in ${winnerPage.tournament.game_name ?? "Skillsroom"} competition.`,
      path: `/community/winners/tournaments/${encodeURIComponent(tournamentId)}`
    });
  } catch {
    return shareMetadata({
      title: "Skillsroom Tournament Winner",
      description: "Approved tournament winner and verified public result summary.",
      path: `/community/winners/tournaments/${encodeURIComponent(tournamentId)}`
    });
  }
}

export default async function TournamentWinnerPage({ params }: TournamentWinnerPageProps) {
  const { tournamentId } = await params;

  let winnerPage: Awaited<ReturnType<typeof getTournamentWinnerPage>>;
  try {
    winnerPage = await getTournamentWinnerPage(tournamentId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  return (
    <AppShell active="community">
      <section className="grid gap-6">
        <section className="min-w-0 rounded-lg border border-line bg-white p-5 shadow-panel md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">{winnerPage.winner.result_label}</Badge>
            {winnerPage.tournament.game_name ? <Badge tone="cyan">{winnerPage.tournament.game_name}</Badge> : null}
          </div>
          <h1 className="mt-3 text-2xl font-black text-ink md:text-3xl">{winnerPage.winner.player_label}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
            {winnerPage.winner.entry_name} won {winnerPage.tournament.title} under approved Skillsroom tournament results.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href="/community/highlights">
              Back to highlights
            </Link>
            {winnerPage.winner.rank_path ? (
              <Link className="inline-flex min-h-control items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href={winnerPage.winner.rank_path}>
                Open player ranking
              </Link>
            ) : null}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Projected public prize pool" label="Prize" tone="success" value={formatMinorMoney(winnerPage.tournament.currency, winnerPage.tournament.projected_prize_minor)} />
          <StatusPanel detail="Tournament format" label="Format" tone="cyan" value={winnerPage.tournament.format.replaceAll("_", " ")} />
          <StatusPanel detail="Registered entries" label="Field" tone="warning" value={winnerPage.tournament.registered_entry_count.toString()} />
          <StatusPanel detail="Ranked placements retained" label="Placements" tone="success" value={winnerPage.standings_count.toString()} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel>
            <PanelHeader eyebrow="Podium" title="Top placements" description="Only approved, public-safe final placements are shown here." />
            <div className="grid gap-3 p-4">
              {winnerPage.placements.map((placement) => (
                <div className="rounded-md border border-line bg-white p-4" key={placement.entry_id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={placement.rank === 1 ? "success" : placement.rank === 2 ? "cyan" : "warning"}>#{placement.rank ?? "?"}</Badge>
                    <strong className="text-ink">{placement.entry_name}</strong>
                  </div>
                  <p className="mt-2 text-sm text-muted">{placement.player?.display_name || placement.player?.username || "Verified competitor"}</p>
                  <p className="mt-2 text-sm font-bold text-ink">Record: {placement.record}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Event" title="Public summary" />
            <div className="grid gap-3 p-4 text-sm">
              <div className="rounded-md border border-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Competition</p>
                <p className="mt-2 font-black text-ink">{winnerPage.tournament.title}</p>
              </div>
              <div className="rounded-md border border-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Mode</p>
                <p className="mt-2 font-black text-ink">{winnerPage.tournament.entry_type.replaceAll("_", " ")}</p>
              </div>
              {winnerPage.host_labels.length ? (
                <div className="rounded-md border border-line bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Hosts</p>
                  <p className="mt-2 font-bold text-ink">{winnerPage.host_labels.map((item) => item.label).join(", ")}</p>
                </div>
              ) : null}
            </div>
          </Panel>
        </div>

        <Panel>
          <PublicSharePanel
            summary={`${winnerPage.winner.entry_name} won ${winnerPage.tournament.title} in ${winnerPage.tournament.game_name ?? "Skillsroom"}.`}
            title={`${winnerPage.winner.player_label} won ${winnerPage.tournament.title}`}
            url={shareUrl(`/community/winners/tournaments/${encodeURIComponent(winnerPage.tournament.id)}`)}
          />
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Notable Matches" title="Approved route to victory" description="Recent decisive matches from this finished event." />
          {winnerPage.notable_matches.length ? (
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {winnerPage.notable_matches.map((match) => (
                <div className="rounded-md border border-line bg-white p-4" key={match.match_id}>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{match.round_name}</p>
                  <p className="mt-2 font-black text-ink">{match.winner_entry_name}</p>
                  <p className="mt-2 text-sm text-muted">{match.result_summary ?? "Approved result retained in the tournament audit."}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {match.winner_match_path ? (
                      <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href={match.winner_match_path}>
                        Open match winner page
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState description="Approved match highlights will appear here when completed rounds carry public-safe result summaries." title="No notable matches yet" />
            </div>
          )}
        </Panel>
      </section>
    </AppShell>
  );
}
