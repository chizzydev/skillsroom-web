import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PublicSharePanel } from "@/components/community/PublicSharePanel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { getCommunityAnnouncement } from "@/lib/match-room-api";
import { shareMetadata, shareUrl } from "@/lib/share-cards";

export const revalidate = 300;

function tone(priority: "low" | "normal" | "high" | "critical"): BadgeTone {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "normal") return "cyan";
  return "neutral";
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ announcementId: string }>;
}): Promise<Metadata> {
  const { announcementId } = await params;
  try {
    const result = await getCommunityAnnouncement(announcementId);
    return shareMetadata({
      title: result.announcement.title,
      description: result.announcement.summary,
      path: `/community/announcements/${announcementId}`
    });
  } catch {
    return shareMetadata({
      title: "Skillsroom Announcement",
      description: "Community update from Skillsroom.",
      path: `/community/announcements/${announcementId}`
    });
  }
}

export default async function CommunityAnnouncementDetailPage({
  params
}: {
  params: Promise<{ announcementId: string }>;
}) {
  const { announcementId } = await params;
  const result = await getCommunityAnnouncement(announcementId);
  const item = result.announcement;

  return (
    <AppShell active="community">
      <section className="grid gap-6">
        <Panel>
          <PanelHeader
            eyebrow="Announcement"
            title={item.title}
            description={item.summary}
          />
          <div className="grid gap-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone(item.priority)}>{item.priority}</Badge>
              <Badge tone="neutral">{item.category.replaceAll("_", " ")}</Badge>
              <Badge tone="cyan">{item.scope === "tournament" ? item.tournament_title ?? "Tournament" : "Platform"}</Badge>
            </div>
            <div className="grid gap-3 text-sm leading-7 text-ink">
              {item.body.split(/\r?\n\r?\n/).map((paragraph, index) => (
                <p key={`${item.id}-${index}`}>{paragraph}</p>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-[0.12em] text-muted">
              <span>{new Date(item.published_at ?? item.created_at).toLocaleString("en-NG")}</span>
              <span>{item.author_display_name || item.author_username || "Skillsroom"}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {item.cta_url && item.cta_label ? (
                <a
                  className="inline-flex min-h-control items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover"
                  href={item.cta_url}
                >
                  {item.cta_label}
                </a>
              ) : null}
              {item.scope === "tournament" && item.tournament_id ? (
                <Link
                  className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
                  href={`/tournaments/${encodeURIComponent(item.tournament_id)}`}
                >
                  Open tournament
                </Link>
              ) : null}
            </div>
          </div>
        </Panel>
        <Panel>
          <PublicSharePanel
            summary={item.summary}
            title={item.title}
            url={shareUrl(`/community/announcements/${encodeURIComponent(item.id)}`)}
          />
        </Panel>
      </section>
    </AppShell>
  );
}
