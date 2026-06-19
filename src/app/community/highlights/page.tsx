import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { PublicSharePanel } from "@/components/community/PublicSharePanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { formatMinorMoney, listCommunityHighlights } from "@/lib/match-room-api";
import { shareMetadata, shareUrl } from "@/lib/share-cards";

export const metadata: Metadata = shareMetadata({
  title: "Skillsroom Highlights",
  description: "Recent winners, finished tournaments, and public highlights from the Skillsroom community.",
  path: "/community/highlights"
});

export default async function CommunityHighlightsPage() {
  let highlights: Awaited<ReturnType<typeof listCommunityHighlights>>["tournament_highlights"] = [];
  let loadError: string | null = null;

  try {
    const result = await listCommunityHighlights(12);
    highlights = result.tournament_highlights;
  } catch {
    loadError = "Unable to load public highlights.";
  }

  return (
    <AppShell active="community">
      <section className="grid gap-6">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(320px,38%)]">
            <div className="relative p-5 md:p-7 lg:p-9">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(33,170,255,0.18),transparent_36%)]" />
              <div className="relative">
                <Badge tone="cyan">Highlights</Badge>
                <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">See recent winners and finished events.</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  This page shows completed tournament results that are ready for people to view and share.
                </p>
                <div className="mt-8 grid gap-3 xl:max-w-2xl xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Recent results</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">See who won, what game it was, and how the event ended.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Confirmed winners</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Only completed events show up here after the results are confirmed.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Easy to share</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Open a result and send it to your friends, team, or group chat.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative min-h-[300px] border-t border-white/10 xl:min-h-full xl:border-l xl:border-t-0">
              <Image alt="Premium Skillsroom highlight artwork" className="object-cover" fill priority sizes="(min-width: 1280px) 38vw, 100vw" src="/marketing/skillsroom-premium/tournaments-premium.png" />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#08131f]/80" />
              <div className="absolute inset-x-4 bottom-4 md:inset-x-6">
                <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Latest winners</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">Catch up on the latest finished tournaments here.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loadError ? <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Completed events shown here" label="Highlights" tone="cyan" value={highlights.length.toString()} />
          <StatusPanel detail="Events with a named winner" label="Winners" tone="success" value={highlights.filter((item) => item.champion_entry_name).length.toString()} />
          <StatusPanel detail="Approved matches across these events" label="Matches" tone="warning" value={highlights.reduce((sum, item) => sum + item.completed_match_count, 0).toString()} />
          <StatusPanel detail="Games represented on this page" label="Games" tone="success" value={new Set(highlights.map((item) => item.game_slug)).size.toString()} />
        </div>

        <Panel>
          <PanelHeader eyebrow="Results" title="Tournament highlights" description="Open any card to see the public winner page." />
          {highlights.length ? (
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              {highlights.map((item) => (
                <Link
                  className="grid gap-4 rounded-[1.25rem] border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh"
                  href={`/community/winners/tournaments/${encodeURIComponent(item.tournament_id)}`}
                  key={item.tournament_id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="success">Winner crowned</Badge>
                    <Badge tone="cyan">{item.game_name}</Badge>
                    <Badge tone="neutral">{item.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-ink">{item.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {item.champion_entry_name ?? "Champion decided"}{item.runner_up_entry_name ? ` over ${item.runner_up_entry_name}` : ""}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Prize</p>
                      <p className="mt-1 font-bold text-ink">{formatMinorMoney(item.currency, item.projected_prize_minor)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Format</p>
                      <p className="mt-1 font-bold text-ink">{item.format.replaceAll("_", " ")}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Entries</p>
                      <p className="mt-1 font-bold text-ink">{item.registered_entry_count}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Approved matches</p>
                      <p className="mt-1 font-bold text-ink">{item.completed_match_count}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState description="Completed tournaments will appear here after results are finalized." title="No highlights yet" />
            </div>
          )}
        </Panel>

        <Panel>
          <PublicSharePanel
            eyebrow="Share"
            panelTitle="Share the highlights page"
            panelDescription="Use this when you want to send recent winners or finished events to other players."
            summary="Recent winners, finished tournaments, and public highlights from Skillsroom."
            title="Skillsroom Highlights"
            url={shareUrl("/community/highlights")}
          />
        </Panel>
      </section>
    </AppShell>
  );
}
