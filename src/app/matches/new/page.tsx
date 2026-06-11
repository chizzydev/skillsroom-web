import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { CatalogRulesetFields } from "@/components/catalog/CatalogRulesetFields";
import { Badge } from "@/components/ui/Badge";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Timeline } from "@/components/ui/Timeline";
import { getCurrentUser } from "@/lib/auth-bridge";
import { listGameCatalog, type Game, type MatchRuleset } from "@/lib/match-room-api";
import { createMatchRoomAction } from "../actions";

const steps = [
  { label: "Draft", detail: "Room is created privately with the selected game and ruleset.", status: "current" as const },
  { label: "Open", detail: "Share code or publish to lobby after confirming details.", status: "pending" as const },
  { label: "Opponent joins", detail: "Room moves to awaiting funding when player B joins.", status: "pending" as const },
  { label: "Funding review", detail: "Both entries must be checked before play starts.", status: "pending" as const }
];

export default async function NewMatchPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/matches/new");
  const { error } = await searchParams;
  let games: Game[] = [];
  let rulesets: MatchRuleset[] = [];
  let loadError: string | null = null;

  try {
    const catalog = await listGameCatalog();
    games = catalog.games;
    rulesets = catalog.rulesets;
  } catch {
    loadError = "Unable to load available games and rulesets.";
  }

  const selectedGame = games.find((game) => game.slug === "free-fire") ?? games[0] ?? null;
  const selectedRulesets = selectedGame ? rulesets.filter((ruleset) => ruleset.game_id === selectedGame.id) : [];
  const selectedRuleset = selectedRulesets[0] ?? null;

  return (
    <AppShell active="matches">
      <section className="grid gap-6">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel md:p-7">
          <Badge tone="cyan">Create Room</Badge>
          <h1 className="mt-3 text-3xl font-black text-ink md:text-5xl">Set up a verified match room.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:text-base">
            Skillsroom rooms are game-aware from the first step: choose the title, lock the ruleset, set the entry, and keep every state change auditable.
          </p>
        </section>

        {(error || loadError) && (
          <div className="flex flex-col gap-3 rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger sm:flex-row sm:items-center sm:justify-between">
            <span>{error ?? loadError}</span>
            {error?.toLowerCase().includes("primary game account") ? (
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-danger bg-white px-4 text-sm font-black text-danger shadow-tight"
                href="/profile#game-accounts"
              >
                Add primary game account
              </Link>
            ) : null}
          </div>
        )}

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel>
            <PanelHeader eyebrow="Room Details" title={selectedRuleset?.title ?? "Create match room"} />
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
                <SubmitButton idleLabel="Create draft" pendingLabel="Creating draft..." />
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

          <Panel>
            <PanelHeader eyebrow="Lifecycle" title="What happens next" />
            <div className="p-4">
              <Timeline items={steps} />
            </div>
          </Panel>
        </div>
      </section>
    </AppShell>
  );
}
