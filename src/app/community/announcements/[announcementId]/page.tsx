import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PublicSharePanel } from "@/components/community/PublicSharePanel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { getCommunityAnnouncement } from "@/lib/match-room-api";
import { shareMetadata, shareUrl } from "@/lib/share-cards";

export const revalidate = 300;

function tone(priority: string): BadgeTone {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "normal") return "cyan";
  return "neutral";
}

function safeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeDateLabel(value: unknown) {
  const date = typeof value === "string" || typeof value === "number" ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString("en-NG") : "Date unavailable";
}

function safeCategoryLabel(value: unknown) {
  return safeText(value, "announcement").replaceAll("_", " ");
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ announcementId: string }>;
}): Promise<Metadata> {
  const { announcementId } = await params;
  try {
    const result = await getCommunityAnnouncement(announcementId);
    const title = safeText(result.announcement.title, "Skillsroom update");
    const description = safeText(result.announcement.summary, "Community update from Skillsroom.");
    return shareMetadata({
      title,
      description,
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
  let item: Awaited<ReturnType<typeof getCommunityAnnouncement>>["announcement"] | null = null;
  try {
    const result = await getCommunityAnnouncement(announcementId);
    item = result.announcement;
  } catch {
    item = null;
  }

  if (!item) {
    return (
      <AppShell active="community">
        <section className="grid gap-6">
          <Panel>
            <PanelHeader
              eyebrow="Announcement"
              title="This update could not load"
              description="The announcement may have been moved, unpublished, or temporarily unavailable. You can still open the announcements feed to see the latest published updates."
            />
            <div className="flex flex-wrap gap-3 p-4">
              <Link
                className="inline-flex min-h-control items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover"
                href="/community/announcements"
              >
                Open announcements
              </Link>
              <Link
                className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
                href="/notifications"
              >
                Back to inbox
              </Link>
            </div>
          </Panel>
        </section>
      </AppShell>
    );
  }

  const title = safeText(item.title, "Skillsroom update");
  const summary = safeText(item.summary, "Community update from Skillsroom.");
  const body = safeText(item.body, summary);
  const paragraphs = body.split(/\r?\n\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const priority = safeText(item.priority, "normal");
  const scope = item.scope === "tournament" ? "tournament" : "platform";
  const author = safeText(item.author_display_name || item.author_username, "Skillsroom");

  return (
    <AppShell active="community">
      <section className="grid gap-6">
        <Panel>
          <PanelHeader
            eyebrow="Announcement"
            title={title}
            description={summary}
          />
          <div className="grid gap-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone(priority)}>{priority}</Badge>
              <Badge tone="neutral">{safeCategoryLabel(item.category)}</Badge>
              <Badge tone="cyan">{scope === "tournament" ? item.tournament_title ?? "Tournament" : "Platform"}</Badge>
            </div>
            <div className="grid gap-3 text-sm leading-7 text-ink">
              {paragraphs.map((paragraph, index) => (
                <p key={`${item.id}-${index}`}>{paragraph}</p>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-[0.12em] text-muted">
              <span>{safeDateLabel(item.published_at ?? item.created_at)}</span>
              <span>{author}</span>
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
            summary={summary}
            title={title}
            url={shareUrl(`/community/announcements/${encodeURIComponent(item.id)}`)}
          />
        </Panel>
      </section>
    </AppShell>
  );
}
