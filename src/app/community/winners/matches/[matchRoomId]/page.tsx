import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PublicSharePanel } from "@/components/community/PublicSharePanel";
import { Badge } from "@/components/ui/Badge";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { ApiRequestError, formatMinorMoney, getMatchWinnerPage } from "@/lib/match-room-api";
import { shareMetadata, shareUrl } from "@/lib/share-cards";

type MatchWinnerPageProps = {
  params: Promise<{ matchRoomId: string }>;
};

export async function generateMetadata({ params }: MatchWinnerPageProps): Promise<Metadata> {
  const { matchRoomId } = await params;
  try {
    const winnerPage = await getMatchWinnerPage(matchRoomId);
    return shareMetadata({
      title: `${winnerPage.winner.label} won ${winnerPage.room.title ?? winnerPage.room.room_code}`,
      description: `Approved room result in ${winnerPage.room.game_name ?? "Skillsroom"} with verified review status.`,
      path: `/community/winners/matches/${encodeURIComponent(matchRoomId)}`
    });
  } catch {
    return shareMetadata({
      title: "Skillsroom Match Winner",
      description: "Approved room winner and public-safe result summary.",
      path: `/community/winners/matches/${encodeURIComponent(matchRoomId)}`
    });
  }
}

export default async function MatchWinnerPage({ params }: MatchWinnerPageProps) {
  const { matchRoomId } = await params;

  let winnerPage: Awaited<ReturnType<typeof getMatchWinnerPage>>;
  try {
    winnerPage = await getMatchWinnerPage(matchRoomId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  return (
    <AppShell active="community">
      <section className="grid gap-6">
        <section className="min-w-0 rounded-lg border border-line bg-white p-5 shadow-panel md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">{winnerPage.result.status_label}</Badge>
            {winnerPage.room.game_name ? <Badge tone="cyan">{winnerPage.room.game_name}</Badge> : null}
          </div>
          <h1 className="mt-3 text-2xl font-black text-ink md:text-3xl">{winnerPage.winner.label}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
            Approved winner for {winnerPage.room.title ?? winnerPage.room.room_code} inside the Skillsroom result review flow.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href="/community/highlights">
              Community highlights
            </Link>
            {winnerPage.winner.rank_path ? (
              <Link className="inline-flex min-h-control items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href={winnerPage.winner.rank_path}>
                Open player ranking
              </Link>
            ) : null}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Entry amount per player" label="Stake" tone="warning" value={formatMinorMoney(winnerPage.room.currency, winnerPage.room.entry_amount_minor)} />
          <StatusPanel detail="Approved review timestamp" label="Approved" tone="success" value={winnerPage.result.approved_at ? new Date(winnerPage.result.approved_at).toLocaleDateString("en-NG") : "Review"} />
          <StatusPanel detail="Room state" label="Status" tone="cyan" value={winnerPage.room.status.replaceAll("_", " ")} />
          <StatusPanel detail="Ruleset" label="Mode" tone="success" value={winnerPage.room.ruleset_title ?? "Custom"} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel>
            <PanelHeader eyebrow="Result" title="Approved summary" description="Public-safe result details only. Evidence and admin notes stay private." />
            <div className="grid gap-3 p-4">
              <div className="rounded-md border border-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Score</p>
                <p className="mt-2 font-black text-ink">{winnerPage.result.score_summary}</p>
              </div>
              <div className="rounded-md border border-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Opponent</p>
                <p className="mt-2 font-black text-ink">{winnerPage.opponent?.label ?? "Verified opponent"}</p>
              </div>
            </div>
          </Panel>

          <Panel>
            <PublicSharePanel
              summary={`Approved winner for ${winnerPage.room.title ?? winnerPage.room.room_code} in ${winnerPage.room.game_name ?? "Skillsroom"}.`}
              title={`${winnerPage.winner.label} won ${winnerPage.room.title ?? winnerPage.room.room_code}`}
              url={shareUrl(winnerPage.share_path)}
            />
          </Panel>
        </div>
      </section>
    </AppShell>
  );
}
