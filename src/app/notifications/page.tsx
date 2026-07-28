import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { RealtimePatchStatus } from "@/components/realtime/RealtimePatchStatus";
import { Badge } from "@/components/ui/Badge";
import { getCurrentUser } from "@/lib/auth-bridge";
import { getNotificationBootstrap, type NotificationPreference } from "@/lib/match-room-api";
import { NotificationsLiveSections, type NotificationBootstrap } from "./NotificationsLiveSections";

function emptyNotificationPreferences(userId: string): NotificationPreference {
  return {
    user_id: userId,
    in_app_enabled: true,
    in_app_sound_enabled: true,
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

  return (
    <AppShell active="notifications">
      <section className="grid gap-6">
        <section className="motion-premium-panel overflow-hidden rounded-[1.35rem] border border-[#24364a] bg-[#08131f] p-5 text-white shadow-[0_30px_90px_rgba(4,10,20,0.28)] md:p-7 lg:p-9">
          <div className="max-w-3xl">
            <Badge tone="cyan">Inbox</Badge>
            <h1 className="mt-4 max-w-full break-words text-3xl font-black leading-tight [overflow-wrap:anywhere] sm:text-4xl">
              Notifications and requests.
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-300 md:text-base">
              Room invites, DM requests, match updates, wallet movement, and tournament activity live here.
            </p>
          </div>
        </section>

        <LiveUpdateStream autoConnect eventTypePrefixes={["notification.", "room.invite.", "chat.dm.request."]} label="Inbox live" quiet refreshTargetLabel="inbox" />
        <RealtimePatchStatus label="Inbox" targets={["notifications", "room", "chat"]} />

        {(error || loadError) && (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {error ?? loadError}
          </div>
        )}

        <NotificationsLiveSections initialBootstrap={bootstrap} userId={user.id} />
      </section>
    </AppShell>
  );
}
