import { ImageResponse } from "next/og";
import { listLeaderboard } from "@/lib/match-room-api";
import { shareCardShell, shareCardSize } from "@/lib/share-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = shareCardSize;
export const contentType = "image/png";

export default async function Image() {
  let title = "Skillsroom public leaderboards";
  let subtitle = "Verified player rankings by game, city, campus, and competition record.";
  let metrics = [{ label: "Ranks", value: "Live" }];

  try {
    const result = await listLeaderboard({ limit: 3 });
    if (result.leaderboard.length) {
      const player = result.leaderboard[0];
      title = `${player.display_name || player.username} leads the board`;
      subtitle = `${player.primary_game_name ?? "Skillsroom"} rankings with verified public competition data.`;
      metrics = [
        { label: "Score", value: player.leaderboard_score.toString() },
        { label: "Record", value: `${player.wins}-${player.losses}` },
        { label: "Scene", value: player.campus || player.city || player.region }
      ];
    }
  } catch {}

  return new ImageResponse(
    shareCardShell({
      eyebrow: "Community Leaderboard",
      title,
      subtitle,
      accent: "#38bdf8",
      metrics,
      footer: "Public verified player rankings"
    }),
    size
  );
}
