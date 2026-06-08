import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PublicSharePanel } from "@/components/community/PublicSharePanel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { listCommunityAnnouncements, type CommunityAnnouncement } from "@/lib/match-room-api";
import { shareMetadata, shareUrl } from "@/lib/share-cards";

export const metadata: Metadata = shareMetadata({
  title: "Skillsroom Community Announcements",
  description: "Platform news, tournament updates, maintenance notices, and winner posts from Skillsroom.",
  path: "/community/announcements"
});

function tone(priority: CommunityAnnouncement["priority"]): BadgeTone {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "normal") return "cyan";
  return "neutral";
}

function scopeLabel(item: CommunityAnnouncement) {
  return item.scope === "tournament" ? item.tournament_title ?? "Tournament update" : "Platform";
}

export default async function CommunityAnnouncementsPage() {
  let announcements: CommunityAnnouncement[] = [];
  let loadError: string | null = null;

  try {
    const result = await listCommunityAnnouncements({ limit: 40 });
    announcements = result.announcements;
  } catch {
    loadError = "Unable to load community announcements right now.";
  }

  return (
    <AppShell active="community">
      <section className="grid gap-6">
        <Panel>
          <PanelHeader
            eyebrow="Community News"
            title="Announcements and tournament updates"
            description="Only published platform notices and public-safe tournament updates appear here."
          />
        </Panel>

        {loadError ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div>
        ) : null}

        {announcements.length ? (
          <div className="grid gap-4">
            {announcements.map((item) => (
              <Link
                className="grid gap-3 rounded-md border border-line bg-white p-5 shadow-tight transition hover:border-action hover:bg-surfaceHigh"
                href={`/community/announcements/${encodeURIComponent(item.id)}`}
                key={item.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={tone(item.priority)}>{item.priority}</Badge>
                  <Badge tone="neutral">{item.category.replaceAll("_", " ")}</Badge>
                  <Badge tone="cyan">{scopeLabel(item)}</Badge>
                </div>
                <div>
                  <h2 className="text-xl font-black text-ink">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{item.summary}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  <span>{new Date(item.published_at ?? item.created_at).toLocaleString("en-NG")}</span>
                  <span>{item.author_display_name || item.author_username || "Skillsroom"}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Panel>
            <div className="p-4">
              <EmptyState
                title="No published announcements yet"
                description="Platform news, maintenance notices, and tournament updates will appear here after publishing."
              />
            </div>
          </Panel>
        )}

        <Panel>
          <PublicSharePanel
            eyebrow="Share"
            panelTitle="Share the news feed"
            panelDescription="Made for quick forwarding when platform updates or tournament notices need reach on mobile."
            summary="Platform news, tournament updates, maintenance notices, and winner posts from Skillsroom."
            title="Skillsroom Community Announcements"
            url={shareUrl("/community/announcements")}
          />
        </Panel>
      </section>
    </AppShell>
  );
}
