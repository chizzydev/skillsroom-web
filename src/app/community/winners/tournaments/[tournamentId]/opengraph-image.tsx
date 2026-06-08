import { ImageResponse } from "next/og";
import { formatMinorMoney, getTournamentWinnerPage } from "@/lib/match-room-api";
import { shareCardShell, shareCardSize } from "@/lib/share-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = shareCardSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  let title = "Tournament winner crowned";
  let subtitle = "Approved public tournament finish on Skillsroom.";
  let metrics = [{ label: "Status", value: "Verified" }];

  try {
    const winnerPage = await getTournamentWinnerPage(tournamentId);
    title = winnerPage.winner.player_label;
    subtitle = `${winnerPage.winner.entry_name} won ${winnerPage.tournament.title}.`;
    metrics = [
      { label: "Game", value: winnerPage.tournament.game_name ?? "Skillsroom" },
      { label: "Prize", value: formatMinorMoney(winnerPage.tournament.currency, winnerPage.tournament.projected_prize_minor) },
      { label: "Format", value: winnerPage.tournament.format.replaceAll("_", " ") },
      { label: "Entries", value: winnerPage.tournament.registered_entry_count.toString() }
    ];
  } catch {}

  return new ImageResponse(
    shareCardShell({
      eyebrow: "Tournament Winner",
      title,
      subtitle,
      accent: "#22c55e",
      metrics,
      footer: "Approved tournament result"
    }),
    size
  );
}
