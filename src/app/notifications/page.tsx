import { redirect } from "next/navigation";
import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { RealtimePatchStatus } from "@/components/realtime/RealtimePatchStatus";
import { Badge } from "@/components/ui/Badge";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getCurrentUser } from "@/lib/auth-bridge";
import { getNotificationBootstrap, type NotificationPreference } from "@/lib/match-room-api";
import { updateNotificationPreferencesAction } from "./actions";
import { NotificationsLiveSections, type NotificationBootstrap } from "./NotificationsLiveSections";

const premiumArtwork = {
  community: "/marketing/skillsroom-premium/community-premium.png"
} as const;

function emptyNotificationPreferences(userId: string): NotificationPreference {
  return {
    user_id: userId,
    in_app_enabled: true,
    email_enabled: false,
    sms_enabled: false,
    room_invites_enabled: true,
    match_updates_enabled: true,
    marketing_enabled: false
  };
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/notifications");
  const { error } = await searchParams;

  let bootstrap: NotificationBootstrap = {
    notifications: [],
    invites: [],
    requests: [],
    preferences: emptyNotificationPreferences(user.id)
  };
  let loadError: string | null = null;

  try {
    bootstrap = await getNotificationBootstrap();
  } catch {
    loadError = "Unable to load notifications.";
  }

  const preferences = bootstrap.preferences;

  return (
    <AppShell active="notifications">
      <section className="grid gap-6">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(300px,38%)]">
            <div className="relative p-5 md:p-7 lg:p-9">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(33,170,255,0.18),transparent_36%)]" />
              <div className="relative">
                <Badge tone="warning">Inbox</Badge>
                <h1 className="mt-3 max-w-full break-words text-3xl font-black leading-tight [overflow-wrap:anywhere] sm:text-4xl lg:text-5xl">
                  Your inbox and invites.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  This is where you see new invites, direct message requests, and match updates first.
                </p>
                <div className="mt-8 grid gap-3 xl:max-w-2xl xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Quick actions</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Reply to invites, open DMs, and deal with new updates from one place.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Live updates</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">New activity shows up here clearly instead of getting lost.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Your settings</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Choose how you want Skillsroom to reach you.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative min-h-[300px] border-t border-white/10 xl:min-h-full xl:border-l xl:border-t-0">
              <Image alt="Premium community communications artwork" className="object-cover" fill priority sizes="(min-width: 1280px) 38vw, 100vw" src={premiumArtwork.community} />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#08131f]/80" />
              <div className="absolute inset-x-4 bottom-4 grid gap-3 md:inset-x-6">
                <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">What you can do here</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">Check unread updates, respond to invites, and manage message alerts.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <LiveUpdateStream autoConnect={false} eventTypePrefixes={["notification.", "room.invite.", "chat.dm.request."]} label="Inbox live" refreshTargetLabel="inbox" />
        <RealtimePatchStatus label="Inbox" targets={["notifications", "room", "chat"]} />

        {(error || loadError) && (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {error ?? loadError}
          </div>
        )}

        <NotificationsLiveSections initialBootstrap={bootstrap} userId={user.id} />

        <Panel>
          <PanelHeader eyebrow="Preferences" title="Notification settings" />
          <form action={updateNotificationPreferencesAction} className="grid gap-3 p-4">
            {[
              ["in_app_enabled", "In-app notifications", preferences.in_app_enabled],
              ["email_enabled", "Email", preferences.email_enabled],
              ["sms_enabled", "SMS", preferences.sms_enabled],
              ["room_invites_enabled", "Room invites", preferences.room_invites_enabled],
              ["match_updates_enabled", "Match updates", preferences.match_updates_enabled],
              ["marketing_enabled", "Marketing", preferences.marketing_enabled]
            ].map(([name, label, checked]) => (
              <label className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm font-bold text-ink" key={String(name)}>
                <span className="min-w-0 break-words">{label}</span>
                <input className="shrink-0" defaultChecked={Boolean(checked)} name={String(name)} type="checkbox" />
              </label>
            ))}
            <SubmitButton idleLabel="Save preferences" pendingLabel="Saving preferences..." />
          </form>
        </Panel>
      </section>
    </AppShell>
  );
}
