import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { CatalogRulesetFields } from "@/components/catalog/CatalogRulesetFields";
import { MotionSection, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Timeline } from "@/components/ui/Timeline";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { getCurrentUser } from "@/lib/auth-bridge";
import { getProfileMe, listGameCatalog, type Game, type MatchRuleset } from "@/lib/match-room-api";
import { createMatchRoomAction } from "../actions";

const steps = [
  { label: "Create", detail: "Room is created with the selected game, ruleset, and entry amount.", status: "current" as const },
  { label: "Share code", detail: "Send the room code to the second player so they can join.", status: "pending" as const },
  { label: "Opponent joins", detail: "Room moves to awaiting funding when player B joins.", status: "pending" as const },
  { label: "Funding review", detail: "Both entries must be checked before play starts.", status: "pending" as const }
];

function missingSetupLabel(key: string) {
  if (key === "username") return "Choose a username in Profile.";
  if (key === "age_confirmation") return "Confirm your age in Profile.";
  if (key === "primary_game_account") return "Add your main in-game handle in Profile.";
  return key.replaceAll("_", " ");
}

export default async function NewMatchPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/matches/new");
  const { error } = await searchParams;
  let games: Game[] = [];
  let rulesets: MatchRuleset[] = [];
  let profileReady = false;
  let missingProfileItems: string[] = [];
  let loadError: string | null = null;

  try {
    const [catalog, profile] = await Promise.all([
      listGameCatalog(),
      getProfileMe("summary")
    ]);
    games = catalog.games;
    rulesets = catalog.rulesets;
    profileReady = Boolean(profile.completion.complete);
    missingProfileItems = profile.completion.missing ?? [];
  } catch {
    loadError = "Unable to confirm your player setup and available games.";
  }

  const selectedGame = games.find((game) => game.slug === "free-fire") ?? games[0] ?? null;
  const selectedRulesets = selectedGame ? rulesets.filter((ruleset) => ruleset.game_id === selectedGame.id) : [];
  const selectedRuleset = selectedRulesets[0] ?? null;

  return (
    <AppShell active="matches">
      <MotionSection className="grid gap-6" variant="page">
        <MotionSection className="rounded-lg border border-line bg-white p-5 shadow-panel md:p-7" variant="hero">
          <Badge tone="cyan">Create Room</Badge>
          <h1 className="mt-3 text-3xl font-black text-ink md:text-5xl">Create a match room.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:text-base">
            Choose the game, ruleset, and entry amount. Skillsroom will create a joinable room code for the second player.
          </p>
        </MotionSection>

        {(error || loadError) ? (
          <Reveal className="grid gap-3" variant="down">
            <TransientStatusBanner clearKeys={["error"]} durationMs={12000} message={error ?? loadError ?? ""} />
            {error?.toLowerCase().includes("primary game account") || error?.toLowerCase().includes("complete your player profile") ? (
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-danger bg-white px-4 text-sm font-black text-danger shadow-tight"
                href="/profile#game-accounts"
              >
                Add primary game account
              </Link>
            ) : null}
          </Reveal>
        ) : null}

        <Reveal>
        <Panel>
          <PanelHeader
            eyebrow="Ready check"
            title={profileReady ? "Player setup ready" : "Finish your player setup first"}
            description={profileReady
              ? "Your profile has the player identity checks needed for match rooms."
              : "Before you create or join money rooms, Skillsroom needs your username, age confirmation, and at least one primary game account saved on your profile."}
          />
          <div className="p-4">
            <div className={[
              "relative overflow-hidden rounded-[1.5rem] border p-5 shadow-panel md:p-6",
              profileReady ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-cyan/30 bg-navy-950 text-white"
            ].join(" ")}>
              {!profileReady ? <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.24),transparent_32%),radial-gradient(circle_at_90%_15%,rgba(16,185,129,0.18),transparent_28%)]" /> : null}
              <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <span className={[
                    "inline-flex rounded-full border px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.18em]",
                    profileReady ? "border-emerald-200 bg-white text-emerald-700" : "border-white/20 bg-white text-navy-950"
                  ].join(" ")}>
                    {profileReady ? "Ready" : "Stand by"}
                  </span>
                  <h2 className="mt-4 text-2xl font-black md:text-3xl">{profileReady ? "Profile checks passed" : "Profile setup required"}</h2>
                  <p className={["mt-3 max-w-3xl text-sm leading-6 md:text-base", profileReady ? "text-emerald-900" : "text-slate-200"].join(" ")}>
                    {profileReady
                      ? "Rooms can be created with your saved username, age confirmation, and primary game account."
                      : missingProfileItems.length
                        ? missingProfileItems.map(missingSetupLabel).join(" ")
                        : "Add your game handle in Profile and mark it as your primary account. Once that is done, come back here and room creation will go through normally."}
                  </p>
                </div>
                {profileReady ? (
                  <span className="inline-flex min-h-11 items-center justify-center rounded-md border border-emerald-200 bg-white px-5 text-sm font-black text-emerald-700">
                    Ready to create
                  </span>
                ) : (
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-action px-5 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover"
                    href="/profile#game-accounts"
                  >
                    Open profile setup
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Panel>
        </Reveal>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Reveal>
          <Panel>
            <PanelHeader eyebrow="Room Details" title="Set up your room" />
            {selectedGame && selectedRuleset ? (
            <form action={createMatchRoomAction} className="grid gap-4 p-4 md:grid-cols-2">
              <input name="commission_bps" type="hidden" value="1000" />
              <CatalogRulesetFields
                games={games}
                initialGameSlug={selectedGame.slug}
                initialRulesetSlug={selectedRuleset.slug}
                rulesets={rulesets}
              />
              <label className="grid gap-2 text-sm font-bold text-ink">
                Entry amount (NGN)
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" min="100" name="entry_amount_naira" required step="100" type="number" defaultValue="2000" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Commission
                <input className="min-h-11 rounded-md border border-line bg-surfaceHigh px-3 text-sm" readOnly value="10%" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink md:col-span-2">
                Title
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="title" placeholder="Room title" />
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <SubmitButton disabled={!profileReady} idleLabel={profileReady ? "Create room" : "Finish profile setup first"} pendingLabel="Creating room..." />
                {!profileReady ? (
                  <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/profile#game-accounts">
                    Open Profile
                  </Link>
                ) : null}
              </div>
            </form>
            ) : (
              <div className="p-4">
                <div className="rounded-md border border-dashed border-line bg-surfaceWarm p-6">
                  <h2 className="text-lg font-black text-ink">No active ruleset available</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">A match room needs an active game and ruleset before it can be created.</p>
                </div>
              </div>
            )}
          </Panel>
          </Reveal>

          <Reveal staggerIndex={1}>
          <Panel>
            <PanelHeader eyebrow="Lifecycle" title="What happens next" />
            <div className="p-4">
              <Timeline items={steps} />
            </div>
          </Panel>
          </Reveal>
        </div>
      </MotionSection>
    </AppShell>
  );
}
