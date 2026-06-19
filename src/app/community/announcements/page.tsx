import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { PublicSharePanel } from "@/components/community/PublicSharePanel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
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
        <section className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(320px,38%)]">
            <div className="relative p-5 md:p-7 lg:p-9">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(33,170,255,0.18),transparent_36%)]" />
              <div className="relative">
                <Badge tone="cyan">Community News</Badge>
                <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">Announcements and tournament updates</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  This is where published platform updates and tournament news appear.
                </p>
                <div className="mt-8 grid gap-3 xl:max-w-2xl xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Platform updates</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Read the latest important updates from Skillsroom here.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Tournament news</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Tournament posts stay easy to read without showing private admin details.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Easy to read on phone</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">It should still read clearly when someone opens it from a shared link.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative min-h-[300px] border-t border-white/10 xl:min-h-full xl:border-l xl:border-t-0">
              <Image alt="Premium Skillsroom announcements artwork" className="object-cover" fill priority sizes="(min-width: 1280px) 38vw, 100vw" src="/marketing/skillsroom-premium/community-premium.png" />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#08131f]/80" />
              <div className="absolute inset-x-4 bottom-4 md:inset-x-6">
                <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Latest posts</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">Check the newest platform and tournament updates here.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loadError ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div>
        ) : null}

        {announcements.length ? (
          <div className="grid gap-4">
            {announcements.map((item) => (
              <Link
                className="grid gap-3 rounded-[1.25rem] border border-line bg-white p-5 shadow-tight transition hover:border-action hover:bg-surfaceHigh"
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
