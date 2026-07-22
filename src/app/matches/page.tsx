import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MotionSection, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { getCurrentUser } from "@/lib/auth-bridge";
import type { MatchRoomStatus } from "@/lib/match-room-api";
import { joinMatchRoomAction } from "./actions";
import { loadRoomActivitySnapshot } from "./roomActivityData";
import { RoomActivityPanelClient } from "./RoomActivityPanelClient";

function countStatus(counts: Partial<Record<MatchRoomStatus, number>>, status: MatchRoomStatus) {
  return (counts[status] ?? 0).toString();
}

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ error?: string; queue?: string; cursor?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/matches");
  const { error, queue, cursor } = await searchParams;
  const activitySnapshot = await loadRoomActivitySnapshot({ queue, cursor });
  return (
    <AppShell active="matches">
      <MotionSection className="grid min-w-0 max-w-full gap-6 overflow-hidden" variant="page">
        <MotionSection className="min-w-0 max-w-full overflow-hidden rounded-lg border border-line bg-white p-4 shadow-panel sm:p-5 md:p-7" variant="hero">
          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <Badge tone="cyan">Match Rooms</Badge>
              <h1 className="mt-3 max-w-full text-2xl font-black leading-tight text-ink [overflow-wrap:anywhere] sm:text-4xl lg:text-5xl">Create, join, and track rooms.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted [overflow-wrap:anywhere] md:text-base">
                Track rooms from open entry through funding, play, result review, and settlement.
              </p>
            </div>
            <div className="grid w-full min-w-0 max-w-full gap-2 min-[380px]:grid-cols-2 lg:w-auto lg:min-w-[20rem]">
              <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-3 text-center text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="/matches/new" pendingLabel="Opening creator...">
                Create room
              </PendingLink>
              <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-center text-sm font-black text-ink hover:bg-surfaceHigh" href="#join-room">
                Join by code
              </a>
            </div>
          </div>
        </MotionSection>

        {(error || activitySnapshot.loadError) ? <TransientStatusBanner clearKeys={["error"]} durationMs={12000} message={error ?? activitySnapshot.loadError ?? ""} /> : null}

        <div className="grid min-w-0 max-w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal staggerIndex={0}><StatusPanel detail="Visible to lobby" label="Open" tone="cyan" value={countStatus(activitySnapshot.counts, "open")} /></Reveal>
          <Reveal staggerIndex={1}><StatusPanel detail="Manual transfer next" label="Awaiting Funding" tone="warning" value={countStatus(activitySnapshot.counts, "awaiting_funding")} /></Reveal>
          <Reveal staggerIndex={2}><StatusPanel detail="Payment proof check" label="Funding Review" tone="danger" value={countStatus(activitySnapshot.counts, "funding_review")} /></Reveal>
          <Reveal staggerIndex={3}><StatusPanel detail="Visible rooms" label="Tracked" tone="success" value={Object.values(activitySnapshot.counts).reduce((sum, value) => sum + (value ?? 0), 0).toString()} /></Reveal>
        </div>

        <Reveal>
          <RoomActivityPanelClient initialSnapshot={activitySnapshot} />
        </Reveal>

        <Reveal>
        <Panel id="join-room">
          <PanelHeader eyebrow="Join Code" title="Join a private room" description="Players can join a room only when their profile is complete and the room is open." />
          <form action={joinMatchRoomAction} className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm font-bold uppercase outline-none focus:border-action"
              name="room_code"
              placeholder="SR8K21"
              required
            />
            <SubmitButton idleLabel="Join room" pendingLabel="Joining room..." />
          </form>
        </Panel>
        </Reveal>
      </MotionSection>
    </AppShell>
  );
}
