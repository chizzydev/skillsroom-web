import type { Metadata } from "next";
import Link from "next/link";
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
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan">{clan.tag ?? "Clan"}</Badge>
            {clan.game_focus.map((game) => (
              <Badge key={game} tone="neutral">{game}</Badge>
            ))}
          </div>
          <h1 className="mt-3 text-2xl font-black text-ink md:text-3xl">{clan.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:text-base">{clan.description ?? "Public clan profile on Skillsroom."}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-muted">
            <span>{[clan.city, clan.campus].filter(Boolean).join(" / ") || clan.region}</span>
            <span>Captain: {detail.captain?.label ?? "Visible captain"}</span>
            <span>Created {new Date(clan.created_at).toLocaleDateString("en-NG")}</span>
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
