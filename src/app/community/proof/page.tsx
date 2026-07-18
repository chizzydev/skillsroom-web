import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PublicSharePanel } from "@/components/community/PublicSharePanel";
import { MotionSection, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import {
  formatMinorMoney,
  getCommunitySocialProof,
  getTournamentWinnerPage,
  listCommunityClans,
  listCommunityHighlights,
  type CommunityClanListItem,
  type CommunitySocialProofMetrics,
  type CommunityTournamentHighlightCard,
  type CommunityTournamentWinnerPage
} from "@/lib/match-room-api";
import { shareMetadata, shareUrl } from "@/lib/share-cards";

export const metadata: Metadata = shareMetadata({
  title: "Skillsroom Proof",
  description: "Verified winners, completed matches, active clans, tournament history, and public result cards from Skillsroom.",
  path: "/community/proof"
});
export const revalidate = 60;

type PublicMatchProofCard = {
  id: string;
  roundName: string;
  winner: string;
  eventTitle: string;
  gameName: string | null;
  resultSummary: string | null;
  sharePath: string;
};

function formatMinor(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value / 100);
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function cleanStatus(value: string) {
  return value.replaceAll("_", " ");
}

function playerLabel(item: CommunityTournamentHighlightCard) {
  return item.champion_display_name || item.champion_username || item.champion_entry_name || "Verified winner";
}

function clanScene(clan: CommunityClanListItem) {
  return [clan.city, clan.campus].filter(Boolean).join(" / ") || clan.region;
}

function whatsappHref(title: string, summary: string, path: string) {
  return `https://wa.me/?text=${encodeURIComponent(`${title}\n${summary}\n${shareUrl(path)}`)}`;
}

function proofScore(metrics: CommunitySocialProofMetrics) {
  const trustEvents = metrics.matches_completed + metrics.winners_crowned + metrics.disputes_resolved + metrics.entries_checked_in;
  if (trustEvents >= 1000) return "Strong";
  if (trustEvents >= 100) return "Growing";
  if (trustEvents > 0) return "Early";
  return "Starting";
}

function MetricBand({ metrics }: { metrics: CommunitySocialProofMetrics }) {
  const resolutionRate = percent(metrics.disputes_resolved, Math.max(metrics.disputes_resolved, metrics.matches_completed));

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal staggerIndex={0}><StatusPanel detail="Approved or finished rooms" label="Completed matches" tone="success" value={metrics.matches_completed.toString()} /></Reveal>
        <Reveal staggerIndex={1}><StatusPanel detail="Approved match and tournament winners" label="Verified winners" tone="success" value={metrics.winners_crowned.toString()} /></Reveal>
        <Reveal staggerIndex={2}><StatusPanel detail="Reviewed result cases" label="Review decisions" tone="warning" value={metrics.disputes_resolved.toString()} /></Reveal>
        <Reveal staggerIndex={3}><StatusPanel detail="Dispute/review activity compared with completed matches" label="Review coverage" tone="cyan" value={resolutionRate} /></Reveal>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal staggerIndex={0}><StatusPanel detail="Rooms created on Skillsroom" label="Rooms created" tone="cyan" value={metrics.rooms_created.toString()} /></Reveal>
        <Reveal staggerIndex={1}><StatusPanel detail="Tournaments created or completed" label="Tournaments" tone="warning" value={metrics.tournaments_hosted.toString()} /></Reveal>
        <Reveal staggerIndex={2}><StatusPanel detail="Public clans created" label="Clans" tone="success" value={metrics.clans_created.toString()} /></Reveal>
        <Reveal staggerIndex={3}><StatusPanel detail="Player and match check-ins" label="Check-ins" tone="warning" value={metrics.entries_checked_in.toString()} /></Reveal>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal staggerIndex={0}><StatusPanel detail="Prizes reserved from approved records" label="Prize reservations" tone="success" value={metrics.prize_reservations_count.toString()} /></Reveal>
        <Reveal staggerIndex={1}><StatusPanel detail="Reserved prize value" label="Reserved value" tone="success" value={formatMinor(metrics.prize_reservations_minor)} /></Reveal>
        <Reveal staggerIndex={2}><StatusPanel detail="Winner payouts waiting for review/payment" label="Payout queue" tone="warning" value={`${metrics.payout_queue_count} / ${formatMinor(metrics.payout_queue_minor)}`} /></Reveal>
        <Reveal staggerIndex={3}><StatusPanel detail="Refunds waiting for review/payment" label="Refund queue" tone="danger" value={`${metrics.refund_queue_count} / ${formatMinor(metrics.refund_queue_minor)}`} /></Reveal>
      </div>
    </div>
  );
}

function TournamentProofCard({ item, index }: { item: CommunityTournamentHighlightCard; index: number }) {
  const title = `${playerLabel(item)} won ${item.title}`;
  const summary = `${item.game_name} result on Skillsroom with ${item.completed_match_count} approved match${item.completed_match_count === 1 ? "" : "es"}.`;
  const path = `/community/winners/tournaments/${encodeURIComponent(item.tournament_id)}`;

  return (
    <Reveal staggerIndex={index}>
      <article className="grid h-full gap-4 rounded-[1.25rem] border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Verified winner</Badge>
          <Badge tone="cyan">{item.game_name}</Badge>
          <Badge tone="neutral">{cleanStatus(item.status)}</Badge>
        </div>
        <div>
          <h2 className="text-lg font-black text-ink">{item.title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {playerLabel(item)}{item.runner_up_entry_name ? ` finished ahead of ${item.runner_up_entry_name}` : " finished top of the event"}.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Prize</p>
            <p className="mt-1 font-bold text-ink">{formatMinorMoney(item.currency, item.projected_prize_minor)}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Entries</p>
            <p className="mt-1 font-bold text-ink">{item.registered_entry_count}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Approved matches</p>
            <p className="mt-1 font-bold text-ink">{item.completed_match_count}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Format</p>
            <p className="mt-1 font-bold text-ink">{cleanStatus(item.format)}</p>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-3 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href={path}>
            Open result
          </Link>
          <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-black text-ink hover:bg-surfaceHigh" href={whatsappHref(title, summary, path)} rel="noreferrer" target="_blank">
            WhatsApp
          </a>
        </div>
      </article>
    </Reveal>
  );
}

function MatchProofCard({ item, index }: { item: PublicMatchProofCard; index: number }) {
  const title = `${item.winner} won ${item.roundName}`;
  const summary = item.resultSummary || `Approved match from ${item.eventTitle} on Skillsroom.`;

  return (
    <Reveal staggerIndex={index}>
      <article className="grid h-full gap-4 rounded-[1.25rem] border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Public result</Badge>
          {item.gameName ? <Badge tone="cyan">{item.gameName}</Badge> : null}
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{item.eventTitle}</p>
          <h3 className="mt-2 text-lg font-black text-ink">{item.winner}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">{item.roundName} - {summary}</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-navy-900 px-3 text-sm font-black text-white hover:bg-ink" href={item.sharePath}>
            Open match
          </Link>
          <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-black text-ink hover:bg-surfaceHigh" href={whatsappHref(title, summary, item.sharePath)} rel="noreferrer" target="_blank">
            WhatsApp
          </a>
        </div>
      </article>
    </Reveal>
  );
}

function ClanProofCard({ clan, index }: { clan: CommunityClanListItem; index: number }) {
  const title = `${clan.name} on Skillsroom`;
  const summary = `${clan.member_count} member${clan.member_count === 1 ? "" : "s"}, ${clan.completed_tournaments} completed event${clan.completed_tournaments === 1 ? "" : "s"}, ${clan.tournament_wins} title${clan.tournament_wins === 1 ? "" : "s"}.`;
  const path = `/community/clans/${encodeURIComponent(clan.slug)}`;

  return (
    <Reveal staggerIndex={index}>
      <article className="grid h-full gap-4 rounded-[1.25rem] border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="cyan">{clan.tag ?? "Clan"}</Badge>
          {clan.game_focus.slice(0, 2).map((game) => <Badge key={game} tone="neutral">{game}</Badge>)}
        </div>
        <div>
          <h3 className="text-lg font-black text-ink">{clan.name}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">{clan.description ?? "Public clan profile with team activity and records."}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Members</p>
            <p className="mt-1 font-bold text-ink">{clan.member_count}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Scene</p>
            <p className="mt-1 font-bold text-ink">{clanScene(clan)}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Record</p>
            <p className="mt-1 font-mono font-bold text-ink">{clan.match_record.wins}-{clan.match_record.losses}-{clan.match_record.draws}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Titles</p>
            <p className="mt-1 font-bold text-ink">{clan.tournament_wins}</p>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-navy-900 px-3 text-sm font-black text-white hover:bg-ink" href={path}>
            Open clan
          </Link>
          <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-black text-ink hover:bg-surfaceHigh" href={whatsappHref(title, summary, path)} rel="noreferrer" target="_blank">
            WhatsApp
          </a>
        </div>
      </article>
    </Reveal>
  );
}

async function loadWinnerPages(highlights: CommunityTournamentHighlightCard[]) {
  const winnerResults = await Promise.allSettled(
    highlights.slice(0, 6).map((item) => getTournamentWinnerPage(item.tournament_id))
  );

  return winnerResults
    .filter((result): result is PromiseFulfilledResult<CommunityTournamentWinnerPage> => result.status === "fulfilled")
    .map((result) => result.value);
}

function matchProofCards(winnerPages: CommunityTournamentWinnerPage[]): PublicMatchProofCard[] {
  const cards = new Map<string, PublicMatchProofCard>();

  for (const page of winnerPages) {
    for (const match of page.notable_matches) {
      if (!match.winner_match_path) continue;
      cards.set(match.match_id, {
        id: match.match_id,
        roundName: match.round_name,
        winner: match.winner_entry_name,
        eventTitle: page.tournament.title,
        gameName: page.tournament.game_name,
        resultSummary: match.result_summary,
        sharePath: match.winner_match_path
      });
    }
  }

  return [...cards.values()].slice(0, 6);
}

export default async function CommunityProofPage() {
  let metrics: CommunitySocialProofMetrics | null = null;
  let highlights: CommunityTournamentHighlightCard[] = [];
  let clans: CommunityClanListItem[] = [];
  let loadError: string | null = null;

  const [metricsResult, highlightResult, clanResult] = await Promise.allSettled([
    getCommunitySocialProof(),
    listCommunityHighlights(12),
    listCommunityClans({ limit: 6 })
  ]);

  if (metricsResult.status === "fulfilled") metrics = metricsResult.value.metrics;
  if (highlightResult.status === "fulfilled") highlights = highlightResult.value.tournament_highlights;
  if (clanResult.status === "fulfilled") clans = clanResult.value.clans;

  if (!metrics || highlightResult.status === "rejected" || clanResult.status === "rejected") {
    loadError = "Some public proof could not be loaded right now.";
  }

  const winnerPages = await loadWinnerPages(highlights);
  const matchCards = matchProofCards(winnerPages);
  const featuredHighlights = highlights.slice(0, 6);
  const finishedTournamentCount = highlights.filter((item) => item.status === "completed").length;
  const approvedMatchCount = highlights.reduce((sum, item) => sum + item.completed_match_count, 0);
  const activeClanCount = clans.filter((clan) => clan.member_count > 0 || clan.completed_tournaments > 0 || clan.match_record.wins + clan.match_record.losses + clan.match_record.draws > 0).length;

  return (
    <AppShell active="community">
      <MotionSection className="grid gap-6" variant="page">
        <MotionSection className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]" variant="hero">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(320px,38%)]">
            <div className="relative p-5 md:p-7 lg:p-9">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(33,170,255,0.18),transparent_36%)]" />
              <div className="relative">
                <Badge tone="cyan">Public proof</Badge>
                <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">See who played, won, and got reviewed.</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  Verified winners, completed matches, active clans, tournament history, and shareable result cards from Skillsroom.
                </p>
                <div className="mt-8 grid gap-3 xl:max-w-3xl xl:grid-cols-3">
                  <Reveal className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur" staggerIndex={0}>
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Verified winners</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Winner cards link to public result pages after review is complete.</p>
                  </Reveal>
                  <Reveal className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur" staggerIndex={1}>
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Proof over noise</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Private proof files stay private, while approved outcomes are easy to share.</p>
                  </Reveal>
                  <Reveal className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur" staggerIndex={2}>
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Growth ready</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Every public card has a clean link and WhatsApp share flow.</p>
                  </Reveal>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link className="inline-flex min-h-control items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="/challenges">
                    Create challenge
                  </Link>
                  <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-white/20 bg-white/10 px-4 text-sm font-black text-white hover:bg-white/15" href="/community/highlights">
                    See highlights
                  </Link>
                </div>
              </div>
            </div>
            <div className="relative min-h-[300px] border-t border-white/10 xl:min-h-full xl:border-l xl:border-t-0">
              <Image alt="Skillsroom public proof artwork" className="object-cover" fill priority sizes="(min-width: 1280px) 38vw, 100vw" src="/marketing/skillsroom-premium/hero-premium.jpg" />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#08131f]/80" />
              <div className="absolute inset-x-4 bottom-4 md:inset-x-6">
                <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Proof level</p>
                  <p className="mt-2 text-2xl font-black text-white">{metrics ? proofScore(metrics) : "Loading"}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-200">Based on completed matches, winners, reviews, and check-ins.</p>
                </div>
              </div>
            </div>
          </div>
        </MotionSection>

        {loadError ? <Reveal className="rounded-md border border-warning bg-orange-50 p-4 text-sm font-bold text-warning" variant="down">{loadError}</Reveal> : null}

        {metrics ? <MetricBand metrics={metrics} /> : (
          <Panel>
            <div className="p-4">
              <EmptyState title="Proof numbers unavailable" description="The public proof numbers could not be loaded right now." />
            </div>
          </Panel>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Reveal staggerIndex={0}><StatusPanel detail="Tournament result cards on this page" label="Result cards" tone="success" value={featuredHighlights.length.toString()} /></Reveal>
          <Reveal staggerIndex={1}><StatusPanel detail="Public match cards from approved event paths" label="Match cards" tone="cyan" value={matchCards.length.toString()} /></Reveal>
          <Reveal staggerIndex={2}><StatusPanel detail="Finished events in the highlight feed" label="Finished events" tone="warning" value={finishedTournamentCount.toString()} /></Reveal>
          <Reveal staggerIndex={3}><StatusPanel detail="Clan cards with public activity" label="Active clans" tone="success" value={activeClanCount.toString()} /></Reveal>
        </div>

        <Reveal>
          <Panel>
            <PanelHeader
              eyebrow="Verified winners"
              title="Public result cards"
              description="These cards link to public winner pages and can be shared directly to WhatsApp."
            />
            {featuredHighlights.length ? (
              <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                {featuredHighlights.map((item, index) => <TournamentProofCard index={index} item={item} key={item.tournament_id} />)}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState description="Winner result cards appear here after tournaments are completed and ready for public viewing." title="No public result cards yet" />
              </div>
            )}
          </Panel>
        </Reveal>

        <Reveal>
          <Panel>
            <PanelHeader
              eyebrow="Completed matches"
              title="Approved match proof"
              description="Match cards come from approved public result paths, not from private proof files."
            />
            {matchCards.length ? (
              <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                {matchCards.map((item, index) => <MatchProofCard index={index} item={item} key={item.id} />)}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState description="Approved match cards will appear here when completed event matches have public result links." title="No match cards yet" />
              </div>
            )}
          </Panel>
        </Reveal>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Reveal>
            <Panel>
              <PanelHeader
                eyebrow="Clans"
                title="Active clans"
                description="Public clan cards help teams show activity, records, and local scene presence."
              />
              {clans.length ? (
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  {clans.map((clan, index) => <ClanProofCard clan={clan} index={index} key={clan.id} />)}
                </div>
              ) : (
                <div className="p-4">
                  <EmptyState description="Clan cards appear here after captains create public clan profiles." title="No public clans yet" />
                </div>
              )}
            </Panel>
          </Reveal>

          <Reveal>
            <Panel>
              <PanelHeader eyebrow="Disputes" title="Review stats" description="Skillsroom should grow by showing that results can be checked, challenged, and resolved." />
              <div className="grid gap-3 p-4">
                <div className="rounded-[1.25rem] border border-line bg-white p-4">
                  <Badge tone="warning">Review</Badge>
                  <h2 className="mt-3 text-2xl font-black text-ink">{metrics?.disputes_resolved ?? 0}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted">Result reviews and dispute decisions are counted only after the team records a decision.</p>
                </div>
                <div className="rounded-[1.25rem] border border-line bg-white p-4">
                  <Badge tone="success">Fair play</Badge>
                  <h2 className="mt-3 text-2xl font-black text-ink">{approvedMatchCount}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted">Approved matches represented by the current public tournament history feed.</p>
                </div>
                <div className="rounded-[1.25rem] border border-line bg-surfaceWarm p-4">
                  <h2 className="text-base font-black text-ink">What stays private</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">Screenshots, videos, admin notes, payment proof, and sensitive player details are not exposed on public proof pages.</p>
                </div>
              </div>
            </Panel>
          </Reveal>
        </div>

        <Reveal>
          <Panel>
            <PanelHeader eyebrow="Tournament history" title="Recent public history" description="Finished event records keep proof visible after the event day passes." />
            {highlights.length ? (
              <div className="grid gap-3 p-4">
                {highlights.map((item) => (
                  <Link className="grid gap-3 rounded-md border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh md:grid-cols-[minmax(0,1fr)_auto]" href={`/community/winners/tournaments/${encodeURIComponent(item.tournament_id)}`} key={item.tournament_id}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="success">{playerLabel(item)}</Badge>
                        <Badge tone="cyan">{item.game_name}</Badge>
                        <Badge tone="neutral">{cleanStatus(item.format)}</Badge>
                      </div>
                      <h3 className="mt-3 text-base font-black text-ink">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {item.completed_match_count} approved match{item.completed_match_count === 1 ? "" : "es"} · {item.registered_entry_count} entries · {formatMinorMoney(item.currency, item.projected_prize_minor)} prize record
                      </p>
                    </div>
                    <span className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-black text-ink shadow-tight">
                      Open
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState description="Tournament history appears here after completed events are ready for public viewing." title="No tournament history yet" />
              </div>
            )}
          </Panel>
        </Reveal>

        <Reveal>
          <Panel>
            <PanelHeader
              eyebrow="Payouts"
              title="What these money numbers mean"
              description="Public proof stays honest while payment automation is still being prepared."
            />
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div className="rounded-[1.25rem] border border-line bg-white p-4">
                <h2 className="text-base font-black text-ink">Visible now</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Prize reservations, payout queues, and refund queues come from real payment and review records.
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-line bg-white p-4">
                <h2 className="text-base font-black text-ink">Still hidden</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Completed payout totals stay hidden until provider-confirmed payment checks are fully connected.
                </p>
              </div>
            </div>
          </Panel>
        </Reveal>

        <Reveal>
          <Panel>
            <PublicSharePanel
              eyebrow="Share"
              panelTitle="Share the proof page"
              panelDescription="Use this when you want to show verified winners, match proof, clan activity, and tournament history."
              summary="Verified winners, completed matches, active clans, tournament history, and public result cards from Skillsroom."
              title="Skillsroom Public Proof"
              url={shareUrl("/community/proof")}
            />
          </Panel>
        </Reveal>
      </MotionSection>
    </AppShell>
  );
}
