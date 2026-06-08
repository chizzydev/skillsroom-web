import { ImageResponse } from "next/og";
import { getCommunityPlayerRanking } from "@/lib/match-room-api";
import { shareCardShell, shareCardSize } from "@/lib/share-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = shareCardSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  let title = "Skillsroom player ranking";
  let subtitle = "Public competitor profile with verified competition record.";
  let metrics = [{ label: "Rank", value: "Live" }];

  try {
    const ranking = await getCommunityPlayerRanking(userId);
    const player = ranking.player;
    title = player.display_name || player.username;
    subtitle = `${player.primary_game_name ?? "Skillsroom"} competitor with ${player.completed_matches} completed matches and ${player.tournament_wins} tournament wins.`;
    metrics = [
      { label: "Rank", value: `#${player.rank}` },
      { label: "Score", value: player.leaderboard_score.toString() },
      { label: "Record", value: `${player.wins}-${player.losses}` },
      { label: "Scene", value: player.campus || player.city || player.region }
    ];
  } catch {}

  return new ImageResponse(
    shareCardShell({
      eyebrow: "Leaderboard Rank",
      title,
      subtitle,
      accent: "#22c55e",
      metrics,
      footer: "Verified public player profile"
    }),
    size
  );
}
