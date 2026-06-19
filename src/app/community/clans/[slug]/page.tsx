import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { getCommunityClan } from "@/lib/match-room-api";
import { shareMetadata } from "@/lib/share-cards";

type ClanDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ClanDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const detail = await getCommunityClan(slug);
    return shareMetadata({
      title: `${detail.clan.name} Clan Profile`,
      description: `${detail.clan.game_focus.join(", ")} team profile, captain, roster, record, and tournament history on Skillsroom.`,
      path: `/community/clans/${encodeURIComponent(detail.clan.slug)}`
    });
  } catch {
    return shareMetadata({
      title: "Skillsroom Clan Profile",
      description: "Public clan profile on Skillsroom.",
      path: `/community/clans/${encodeURIComponent(slug)}`
    });
  }
}

export default async function CommunityClanDetailPage({ params }: ClanDetailPageProps) {
  const { slug } = await params;
  let detail: Awaited<ReturnType<typeof getCommunityClan>> | null = null;

  try {
    detail = await getCommunityClan(slug);
  } catch {
    notFound();
  }

  const clan = detail.clan;

  return (
    <AppShell active="community">
      <section className="grid gap-6">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(320px,38%)]">
            <div className="relative p-5 md:p-7 lg:p-9">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(33,170,255,0.18),transparent_36%)]" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="cyan">{clan.tag ?? "Clan"}</Badge>
                  {clan.game_focus.map((game) => (
                    <Badge key={game} tone="neutral">{game}</Badge>
                  ))}
                </div>
                <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">{clan.name}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">{clan.description ?? "Public clan profile on Skillsroom."}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-slate-300">
                  <span>{[clan.city, clan.campus].filter(Boolean).join(" / ") || clan.region}</span>
                  <span>Captain: {detail.captain?.label ?? "Visible captain"}</span>
                  <span>Created {new Date(clan.created_at).toLocaleDateString("en-NG")}</span>
                </div>
                <div className="mt-8 grid gap-3 xl:max-w-2xl xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Roster identity</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Members, captain, and match reputation stay attached to one visible team record.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Verified history</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Tournament results here come from actual clan-linked entries, not guessed name matches.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Scene signal</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Location, game focus, and performance give the clan a more premium public presence.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative min-h-[300px] border-t border-white/10 xl:min-h-full xl:border-l xl:border-t-0">
              <Image alt="Premium Skillsroom clan profile artwork" className="object-cover" fill priority sizes="(min-width: 1280px) 38vw, 100vw" src="/marketing/skillsroom-premium/community-premium.png" />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#08131f]/80" />
              <div className="absolute inset-x-4 bottom-4 md:inset-x-6">
                <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Clan profile</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">A sharper public-facing team surface built for discovery, pride, and competitive credibility.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Active public roster" label="Members" tone="cyan" value={clan.member_count.toString()} />
          <StatusPanel detail="Clan reputation score" label="Reputation" tone="success" value={clan.reputation_score.toString()} />
          <StatusPanel detail="Completed clan-linked events" label="Tourneys" tone="warning" value={clan.completed_tournaments.toString()} />
          <StatusPanel detail="Match-side record" label="Record" tone="success" value={`${clan.match_record.wins}-${clan.match_record.losses}-${clan.match_record.draws}`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel>
            <PanelHeader eyebrow="Roster" title="Members" description="Public, moderation-safe clan members only." />
            {detail.members.length ? (
              <DataTable
                columns={[
                  {
                    key: "display_name",
                    label: "Player",
                    render: (row) => row.rank_path ? (
                      <Link className="grid gap-1 hover:text-action" href={row.rank_path}>
                        <strong className="text-ink">{row.display_name || row.username || "Player"}</strong>
                        {row.username ? <span className="font-mono text-xs font-bold text-muted">@{row.username}</span> : null}
                      </Link>
                    ) : (
                      <div className="grid gap-1">
                        <strong className="text-ink">{row.display_name || row.username || "Player"}</strong>
                        {row.username ? <span className="font-mono text-xs font-bold text-muted">@{row.username}</span> : null}
                      </div>
                    )
                  },
                  { key: "role", label: "Role", render: (row) => <Badge tone={row.role === "captain" ? "cyan" : "neutral"}>{row.role}</Badge> },
                  { key: "reputation_score", label: "Reputation", render: (row) => <span className="font-mono font-bold text-ink">{row.reputation_score ?? "-"}</span> },
                  { key: "campus", label: "Scene", render: (row) => <span className="text-muted">{[row.city, row.campus].filter(Boolean).join(" / ") || "Nigeria"}</span> }
                ]}
                rows={detail.members}
              />
            ) : (
              <div className="p-4">
                <EmptyState title="No public members yet" description="Clan members will appear here when active roster identities are visible." />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Snapshot" title="Competition signals" />
            <div className="grid gap-3 p-4">
              <StatusPanel detail="First-place finishes" label="Titles" tone="success" value={clan.tournament_wins.toString()} />
              <StatusPanel detail="Top-three finishes" label="Podiums" tone="warning" value={clan.podium_finishes.toString()} />
              <StatusPanel detail="Primary games" label="Focus" tone="cyan" value={clan.game_focus.length.toString()} />
              {detail.captain?.rank_path ? (
                <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href={detail.captain.rank_path}>
                  Open captain ranking
                </Link>
              ) : null}
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader eyebrow="History" title="Tournament history" description="Clan-linked tournament entries only. No guessed or name-matched history." />
          {detail.tournament_history.length ? (
            <DataTable
              columns={[
                {
                  key: "tournament_title",
                  label: "Tournament",
                  render: (row) => (
                    <Link className="grid gap-1 hover:text-action" href={`/tournaments/${encodeURIComponent(row.tournament_id)}`}>
                      <strong className="text-ink">{row.tournament_title}</strong>
                      <span className="text-xs font-bold text-muted">{row.tournament_game_name ?? "Game"} · {row.tournament_format.replaceAll("_", " ")}</span>
                    </Link>
                  )
                },
                { key: "entry_name", label: "Entry", render: (row) => <span className="font-bold text-ink">{row.entry_name}</span> },
                { key: "rank", label: "Place", render: (row) => <span className="font-mono text-muted">{row.rank ? `#${row.rank}` : "-"}</span> },
                { key: "record", label: "Record", render: (row) => <span className="font-mono text-muted">{row.wins}-{row.losses}-{row.draws}</span> },
                { key: "points", label: "Points", render: (row) => <span className="font-mono text-muted">{row.points}</span> }
              ]}
              rows={detail.tournament_history}
            />
          ) : (
            <div className="p-4">
              <EmptyState title="No clan-linked tournament history yet" description="Once the captain registers team tournament entries from this clan identity, verified history will appear here." />
            </div>
          )}
        </Panel>
      </section>
    </AppShell>
  );
}
