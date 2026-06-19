import { ImageResponse } from "next/og";
import { listCommunityHighlights } from "@/lib/match-room-api";
import { shareCardShell, shareCardSize } from "@/lib/share-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = shareCardSize;
export const contentType = "image/png";

export default async function Image() {
  let title = "Recent winners and finished events";
  let subtitle = "Completed tournaments, winners, and public highlights from Skillsroom.";
  let metrics = [
    { label: "Highlights", value: "Live" },
    { label: "Public", value: "Safe" }
  ];

  try {
    const result = await listCommunityHighlights(4);
    if (result.tournament_highlights.length) {
      const first = result.tournament_highlights[0];
      title = first.title;
      subtitle = `${first.champion_entry_name ?? "Champion decided"} in ${first.game_name}.`;
      metrics = [
        { label: "Matches", value: first.completed_match_count.toString() },
        { label: "Entries", value: first.registered_entry_count.toString() },
        { label: "Format", value: first.format.replaceAll("_", " ") }
      ];
    }
  } catch {}

  return new ImageResponse(
    shareCardShell({
      eyebrow: "Community Highlights",
      title,
      subtitle,
      accent: "#38bdf8",
      metrics,
      footer: "Public winner and event feed"
    }),
    size
  );
}
