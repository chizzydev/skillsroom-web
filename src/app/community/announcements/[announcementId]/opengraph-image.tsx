import { ImageResponse } from "next/og";
import { getCommunityAnnouncement } from "@/lib/match-room-api";
import { shareCardShell, shareCardSize } from "@/lib/share-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = shareCardSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ announcementId: string }> }) {
  const { announcementId } = await params;
  let title = "Skillsroom update";
  let subtitle = "Published community update from Skillsroom.";
  let metrics = [{ label: "Status", value: "Published" }];

  try {
    const result = await getCommunityAnnouncement(announcementId);
    const item = result.announcement;
    title = item.title;
    subtitle = item.summary;
    metrics = [
      { label: "Priority", value: item.priority },
      { label: "Category", value: item.category.replaceAll("_", " ") },
      { label: "Scope", value: item.scope === "tournament" ? "Tournament" : "Platform" }
    ];
  } catch {}

  return new ImageResponse(
    shareCardShell({
      eyebrow: "Announcement",
      title,
      subtitle,
      accent: "#38bdf8",
      metrics,
      footer: "Public community update"
    }),
    size
  );
}
