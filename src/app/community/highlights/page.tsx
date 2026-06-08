import type { Metadata } from "next";
import Link from "next/link";
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
  description: "Approved tournament winners, verified finished events, and public-safe competition highlights.",
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
        <section className="min-w-0 rounded-lg border border-line bg-white p-5 shadow-panel md:p-7">
          <Badge tone="cyan">Highlights</Badge>
          <h1 className="mt-3 text-2xl font-black text-ink md:text-3xl">Completed events worth sharing.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:text-base">
            This feed only shows approved, public-safe tournament finishes. No unresolved disputes. No fake payout claims.
          </p>
        </section>

        {loadError ? <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Completed or prize-ready events" label="Highlights" tone="cyan" value={highlights.length.toString()} />
          <StatusPanel detail="Champion stories surfaced" label="Winners" tone="success" value={highlights.filter((item) => item.champion_entry_name).length.toString()} />
          <StatusPanel detail="Approved competition history" label="Matches" tone="warning" value={highlights.reduce((sum, item) => sum + item.completed_match_count, 0).toString()} />
          <StatusPanel detail="Public event reach" label="Games" tone="success" value={new Set(highlights.map((item) => item.game_slug)).size.toString()} />
        </div>

        <Panel>
          <PanelHeader eyebrow="Public Feed" title="Tournament highlights" description="Every card leads to a share-ready public winner page." />
          {highlights.length ? (
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              {highlights.map((item) => (
                <Link
                  className="grid gap-4 rounded-md border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh"
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
              <EmptyState description="Completed tournaments with public-safe placements will appear here once operators finalize results." title="No highlights yet" />
            </div>
          )}
        </Panel>

        <Panel>
          <PublicSharePanel
            eyebrow="Share"
            panelTitle="Share the highlights feed"
            panelDescription="This page is tuned for mobile sharing when you want people to open approved winner stories fast."
            summary="Approved tournament winners, verified finished events, and public-safe competition highlights on Skillsroom."
            title="Skillsroom Highlights"
            url={shareUrl("/community/highlights")}
          />
        </Panel>
      </section>
    </AppShell>
  );
}
