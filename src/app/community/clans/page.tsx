import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { listCommunityClans, type CommunityClanListItem } from "@/lib/match-room-api";
import { shareMetadata } from "@/lib/share-cards";

export const metadata: Metadata = shareMetadata({
  title: "Skillsroom Clans",
  description: "Public clan and team profiles with members, captain identity, game focus, and verified competition record.",
  path: "/community/clans"
});

type ClanListPageProps = {
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

function captainLabel(clan: CommunityClanListItem) {
  return clan.captain_display_name || clan.captain_username || "Captain";
}

export default async function CommunityClansPage({ searchParams }: ClanListPageProps) {
  const params = await searchParams;
  const filters = {
    game_slug: cleanFilter(params.game_slug),
    city: cleanFilter(params.city),
    campus: cleanFilter(params.campus),
    region: cleanFilter(params.region),
    limit: 48
  };

  let clans: CommunityClanListItem[] = [];
  let loadError: string | null = null;
  try {
    const result = await listCommunityClans(filters);
    clans = result.clans;
  } catch {
    loadError = "Unable to load clan profiles.";
  }

  const totals = clans.reduce(
    (acc, clan) => {
      acc.members += clan.member_count;
      acc.wins += clan.tournament_wins;
      acc.tournaments += clan.completed_tournaments;
      return acc;
    },
    { members: 0, wins: 0, tournaments: 0 }
  );

  return (
    <AppShell active="community">
      <section className="grid gap-6">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel md:p-7">
          <Badge tone="cyan">Clans</Badge>
          <h1 className="mt-3 text-2xl font-black text-ink md:text-3xl">Public clan and team profiles.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:text-base">
            Real member rosters, captain identity, game focus, and clan-linked tournament history live here.
          </p>
        </section>

        {loadError ? <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div> : null}

        <Panel>
          <PanelHeader eyebrow="Filters" title="Find a scene" description="Narrow the public clan board by game, city, campus, or region." />
          <form className="grid gap-3 p-4 md:grid-cols-5" method="GET">
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={filters.game_slug ?? ""} name="game_slug" placeholder="Game slug" />
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={filters.city ?? ""} name="city" placeholder="City" />
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={filters.campus ?? ""} name="campus" placeholder="Campus / community" />
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={filters.region ?? ""} name="region" placeholder="Region" />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
              <SubmitButton idleLabel="Apply" pendingLabel="Applying..." />
              <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href="/community/clans">
                Clear
              </Link>
            </div>
          </form>
        </Panel>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Public team identities" label="Clans" tone="cyan" value={clans.length.toString()} />
          <StatusPanel detail="Active roster spots" label="Members" tone="success" value={totals.members.toString()} />
          <StatusPanel detail="Completed clan-linked events" label="Tourneys" tone="warning" value={totals.tournaments.toString()} />
          <StatusPanel detail="First-place finishes" label="Titles" tone="success" value={totals.wins.toString()} />
        </div>

        <Panel>
          <PanelHeader eyebrow="Board" title="Public clans" description="Only public, moderation-safe clan profiles are listed." />
          {clans.length ? (
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              {clans.map((clan) => (
                <Link className="grid gap-4 rounded-md border border-line bg-white p-4 transition hover:border-action hover:bg-surfaceHigh" href={`/community/clans/${encodeURIComponent(clan.slug)}`} key={clan.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="cyan">{clan.tag ?? "Clan"}</Badge>
                    {clan.game_focus.slice(0, 2).map((game) => (
                      <Badge key={game} tone="neutral">{game}</Badge>
                    ))}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-ink">{clan.name}</h2>
                    <p className="mt-1 text-sm text-muted">{clan.description ?? "Public clan profile"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Captain</p>
                      <p className="mt-1 font-bold text-ink">{captainLabel(clan)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Scene</p>
                      <p className="mt-1 font-bold text-ink">{[clan.city, clan.campus].filter(Boolean).join(" / ") || clan.region}</p>
                    </div>
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
              <EmptyState title="No public clans yet" description="Clan profiles appear here after captains create a public team identity from their profile page." />
            </div>
          )}
        </Panel>
      </section>
    </AppShell>
  );
}
