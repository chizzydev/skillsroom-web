import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MotionSection, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { getOrganizerSpace, type OrganizerEvent } from "@/lib/match-room-api";
import { shareMetadata } from "@/lib/share-cards";

export const revalidate = 120;

type OrganizerSpacePageProps = {
  params: Promise<{ organizerIdOrSlug: string }>;
};

const statusLabels: Record<string, string> = {
  published: "Published",
  registration_open: "Taking entries",
  registration_locked: "Entries locked",
  seeding: "Seeding",
  in_progress: "Live",
  awaiting_results: "Results due",
  under_review: "Review",
  disputed: "Dispute review",
  settlement_pending: "Prize review",
  completed: "Completed"
};

function statusLabel(status: string) {
  return statusLabels[status] ?? status.replaceAll("_", " ");
}

function organizerKindLabel(kind: string) {
  return kind === "clan" ? "Clan space" : "Host space";
}

function formatDate(value: string | null) {
  if (!value) return "Date to be announced";
  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    currency,
    maximumFractionDigits: 0,
    style: "currency"
  }).format(Math.max(0, amountMinor) / 100);
}

function eventTone(event: OrganizerEvent) {
  if (event.status === "in_progress") return "success" as const;
  if (event.status === "registration_open") return "cyan" as const;
  if (event.status === "completed") return "neutral" as const;
  if (event.status === "disputed" || event.status === "under_review") return "danger" as const;
  return "warning" as const;
}

export async function generateMetadata({ params }: OrganizerSpacePageProps): Promise<Metadata> {
  const { organizerIdOrSlug } = await params;
  try {
    const space = await getOrganizerSpace(organizerIdOrSlug);
    return shareMetadata({
      title: `${space.organizer.name} Organizer Space`,
      description: `${space.organizer.name} events, members, streams, updates, and highlights on Skillsroom.`,
      path: `/community/organizers/${encodeURIComponent(space.organizer.slug)}`
    });
  } catch {
    return shareMetadata({
      title: "Skillsroom Organizer Space",
      description: "Public organizer events, members, streams, updates, and highlights on Skillsroom.",
      path: `/community/organizers/${encodeURIComponent(organizerIdOrSlug)}`
    });
  }
}

export default async function OrganizerSpacePage({ params }: OrganizerSpacePageProps) {
  const { organizerIdOrSlug } = await params;
  let space: Awaited<ReturnType<typeof getOrganizerSpace>> | null = null;

  try {
    space = await getOrganizerSpace(organizerIdOrSlug);
  } catch {
    notFound();
  }

  const organizer = space.organizer;
  const location = [organizer.city, organizer.campus].filter(Boolean).join(" / ") || organizer.region || "Online";
  const leader = organizer.captain_display_name || organizer.captain_username || "Visible organizer";
  const primaryEvents = space.events.slice(0, 5);

  return (
    <AppShell active="community">
      <MotionSection className="grid gap-6" variant="page">
        <MotionSection
          className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]"
          style={organizer.banner_url ? { backgroundImage: `linear-gradient(90deg, rgba(8,19,31,0.94), rgba(8,19,31,0.76)), url(${organizer.banner_url})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
          variant="hero"
        >
          <div className="grid gap-6 p-5 md:p-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-9">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="cyan">{organizerKindLabel(organizer.kind)}</Badge>
                {organizer.tag ? <Badge tone="neutral">{organizer.tag}</Badge> : null}
                <Badge tone="success">Public page</Badge>
              </div>

              <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
                <div
                  aria-label={`${organizer.name} image`}
                  className="h-24 w-24 shrink-0 rounded-[1.35rem] border border-white/15 bg-white/10 bg-cover bg-center shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
                  style={organizer.avatar_url ? { backgroundImage: `url(${organizer.avatar_url})` } : undefined}
                />
                <div className="min-w-0">
                  <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">{organizer.name}</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                    {organizer.description ?? "A public Skillsroom organizer space for events, members, streams, updates, and highlights."}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold text-slate-300">
                <span>{location}</span>
                <span>Led by {leader}</span>
                <span>Joined {formatDate(organizer.created_at)}</span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {organizer.game_focus.length ? organizer.game_focus.map((game) => <Badge key={game} tone="neutral">{game}</Badge>) : <Badge tone="neutral">All games</Badge>}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="inline-flex min-h-control items-center justify-center rounded-md bg-action px-5 text-sm font-black text-white shadow-tight hover:bg-actionDark" href="#events">
                  View events
                </Link>
                {organizer.kind === "clan" ? (
                  <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-white/20 bg-white/10 px-5 text-sm font-black text-white hover:bg-white/15" href={`/community/clans/${encodeURIComponent(organizer.slug)}`}>
                    Open clan profile
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="grid content-start gap-3 rounded-[1.25rem] border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Today</p>
              {primaryEvents.length ? primaryEvents.map((event) => (
                <Link key={event.tournament_id} className="rounded-md border border-white/10 bg-[#09131f]/70 p-3 hover:bg-[#102338]" href={`/tournaments/${encodeURIComponent(event.tournament_id)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm leading-5 text-white">{event.title}</strong>
                    <Badge tone={eventTone(event)}>{statusLabel(event.status)}</Badge>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-300">{event.game_name} - {formatDate(event.starts_at)}</p>
                </Link>
              )) : (
                <p className="text-sm leading-6 text-slate-300">No public event is open right now.</p>
              )}
            </div>
          </div>
        </MotionSection>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Public events connected to this organizer" label="Events" tone="cyan" value={space.record.events_hosted.toString()} />
          <StatusPanel detail="Finished public events" label="Completed" tone="success" value={space.record.completed_events.toString()} />
          <StatusPanel detail="First-place finishes" label="Wins" tone="warning" value={space.record.tournament_wins.toString()} />
          <StatusPanel detail="Match record" label="Record" tone="neutral" value={`${space.record.match_wins}-${space.record.match_losses}-${space.record.match_draws}`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Panel id="events">
            <PanelHeader eyebrow="Events" title="Public events" description="Open, live, and completed events connected to this organizer." />
            {space.events.length ? (
              <div className="divide-y divide-line">
                {space.events.map((event) => (
                  <Link key={event.tournament_id} className="grid gap-3 p-4 hover:bg-white sm:grid-cols-[minmax(0,1fr)_170px]" href={`/tournaments/${encodeURIComponent(event.tournament_id)}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={eventTone(event)}>{statusLabel(event.status)}</Badge>
                        <Badge tone="neutral">{event.role_label}</Badge>
                      </div>
                      <h2 className="mt-2 text-lg font-black leading-tight text-ink">{event.title}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted">{event.game_name} - {event.format.replaceAll("_", " ")}</p>
                    </div>
                    <div className="grid gap-1 text-sm font-bold text-muted sm:text-right">
                      <span>{event.registered_entry_count} entries</span>
                      <span>{formatMoney(event.prize_pool_minor, event.currency)} prize</span>
                      <span>{formatDate(event.starts_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState title="No public events yet" description="Events will appear here when this organizer hosts or joins public tournaments." />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Members" title={organizer.kind === "clan" ? "Clan members" : "Event hosts"} description="Only public, safe profiles are shown." />
            {space.members.length ? (
              <div className="divide-y divide-line">
                {space.members.map((member) => (
                  <div key={member.user_id} className="grid gap-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block truncate text-sm text-ink">{member.display_name || member.username || "Player"}</strong>
                        {member.username ? <span className="font-mono text-xs font-bold text-muted">@{member.username}</span> : null}
                      </div>
                      <Badge tone={member.role === "captain" || member.role === "creator" ? "cyan" : "neutral"}>{member.role}</Badge>
                    </div>
                    <p className="text-xs font-semibold text-muted">{[member.city, member.campus].filter(Boolean).join(" / ") || "Public player"} {member.reputation_score !== null ? `- ${member.reputation_score} reputation` : ""}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState title="No public members yet" description="Members and co-hosts appear here when their public profiles are visible." />
              </div>
            )}
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel>
            <PanelHeader eyebrow="Streams" title="Livestreams" description="Watch links from public events." />
            {space.livestreams.length ? (
              <div className="grid gap-3 p-4">
                {space.livestreams.map((stream) => (
                  <a key={stream.id} className="rounded-md border border-line bg-white p-4 hover:border-action/40" href={stream.stream_url} rel="noreferrer" target="_blank">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={stream.is_featured ? "success" : "neutral"}>{stream.provider}</Badge>
                      {stream.tournament_title ? <Badge tone="cyan">{stream.tournament_title}</Badge> : null}
                    </div>
                    <strong className="mt-3 block text-sm leading-5 text-ink">{stream.title}</strong>
                  </a>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState title="No streams yet" description="Public livestream links will appear here when events add them." />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Updates" title="Announcements" description="Published updates from public events." />
            {space.announcements.length ? (
              <div className="grid gap-3 p-4">
                {space.announcements.map((announcement) => (
                  <Link key={announcement.id} className="rounded-md border border-line bg-white p-4 hover:border-action/40" href={`/community/announcements/${encodeURIComponent(announcement.id)}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={announcement.priority === "critical" ? "danger" : announcement.priority === "high" ? "warning" : "neutral"}>{announcement.category}</Badge>
                      <span className="text-xs font-bold text-muted">{formatDate(announcement.published_at)}</span>
                    </div>
                    <strong className="mt-3 block text-sm leading-5 text-ink">{announcement.title}</strong>
                    <p className="mt-2 text-xs leading-5 text-muted">{announcement.summary}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState title="No updates yet" description="Published event updates from this organizer will appear here." />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Highlights" title="Finished events" description="Completed events and winners." />
            {space.highlights.length ? (
              <div className="grid gap-3 p-4">
                {space.highlights.map((highlight) => (
                  <Link key={highlight.tournament_id} className="rounded-md border border-line bg-white p-4 hover:border-action/40" href={`/community/winners/tournaments/${encodeURIComponent(highlight.tournament_id)}`}>
                    <Badge tone="success">{highlight.game_name}</Badge>
                    <strong className="mt-3 block text-sm leading-5 text-ink">{highlight.title}</strong>
                    <p className="mt-2 text-xs leading-5 text-muted">
                      Winner: {highlight.champion_entry_name ?? "Awaiting winner"} - {highlight.completed_match_count} matches - {formatMoney(highlight.projected_prize_minor, "NGN")}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState title="No highlights yet" description="Finished events and winners will appear here after public results are ready." />
              </div>
            )}
          </Panel>
        </div>

        <Reveal>
          <Panel>
            <PanelHeader eyebrow="Share" title="Organizer page" description="Use this page as the public home for events, members, streams, updates, and highlights." />
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="break-all font-mono text-sm font-bold text-muted">{organizer.share_path}</p>
              <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href={organizer.share_path}>
                Open public link
              </Link>
            </div>
          </Panel>
        </Reveal>
      </MotionSection>
    </AppShell>
  );
}
