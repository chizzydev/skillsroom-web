import { ImageResponse } from "next/og";
import { listCommunityAnnouncements } from "@/lib/match-room-api";
import { shareCardShell, shareCardSize } from "@/lib/share-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = shareCardSize;
export const contentType = "image/png";

export default async function Image() {
  let title = "Skillsroom announcements";
  let subtitle = "Platform news, tournament updates, and public-safe community notices.";
  let metrics = [
    { label: "News", value: "Live" },
    { label: "Public", value: "Safe" }
  ];

  try {
    const result = await listCommunityAnnouncements({ limit: 3 });
    if (result.announcements.length) {
      const first = result.announcements[0];
      title = first.title;
      subtitle = first.summary;
      metrics = [
        { label: "Priority", value: first.priority },
        { label: "Scope", value: first.scope === "tournament" ? "Tournament" : "Platform" },
        { label: "Feed", value: result.announcements.length.toString() }
      ];
    }
  } catch {}

  return new ImageResponse(
    shareCardShell({
      eyebrow: "Community News",
      title,
      subtitle,
      accent: "#38bdf8",
      metrics,
      footer: "Published platform and tournament updates"
    }),
    size
  );
}
