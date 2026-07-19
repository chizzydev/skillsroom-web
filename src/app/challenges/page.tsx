import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CatalogRulesetFields } from "@/components/catalog/CatalogRulesetFields";
import { ChallengeMarketplaceFilterForm, type ChallengeVisibilityFilter } from "@/components/challenges/ChallengeMarketplaceFilterForm";
import { MotionSection, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { getCurrentUser } from "@/lib/auth-bridge";
import { fallbackRoomIssueRules } from "@/lib/room-issue-rules";
import {
  displayEnumLabel,
  formatMinorMoney,
  getProfileMe,
  listGameCatalog,
  listMatchChallenges,
  type Game,
  type MatchChallengeListRow,
  type MatchChallengeSkillLevel,
  type MatchChallengeVisibility,
  type MatchRuleset,
  type PlayerTrustBadge
} from "@/lib/match-room-api";
import { acceptMatchChallengeAction, createMatchChallengeAction } from "../matches/actions";

type ChallengeSearchParams = {
  mode?: string;
  game_slug?: string;
  platform?: string;
  region?: string;
  skill_level?: string;
  visibility?: string;
  error?: string;
  created?: string;
};

const skillLevels: { value: MatchChallengeSkillLevel; label: string }[] = [
  { value: "any", label: "Any skill" },
  { value: "beginner", label: "Beginner" },
  { value: "casual", label: "Casual" },
  { value: "competitive", label: "Competitive" },
  { value: "expert", label: "Expert" }
];

const visibilityOptions: { value: MatchChallengeVisibility; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "private", label: "Private" }
];

const defaultPlatforms = ["Mobile", "PlayStation", "Xbox", "PC", "Cross-play"];
const defaultRegions = ["Nigeria", "West Africa", "Africa", "Europe", "North America", "Any region"];

function cleanFilter(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.toLowerCase();
  if (normalized === "any" || normalized === "all" || normalized === "any region" || normalized === "all regions") return undefined;
  return trimmed ? trimmed : undefined;
}

function parseSkillLevel(value: string | undefined): MatchChallengeSkillLevel | undefined {
  return skillLevels.some((item) => item.value === value) ? value as MatchChallengeSkillLevel : undefined;
}

function parseVisibility(value: string | undefined): MatchChallengeVisibility | undefined {
  return visibilityOptions.some((item) => item.value === value) ? value as MatchChallengeVisibility : undefined;
}

function parseVisibilityFilter(value: string | undefined): ChallengeVisibilityFilter {
  return value === "public" || value === "private" || value === "mine" ? value : "";
}

function visibilityFilterLabel(value: ChallengeVisibilityFilter) {
  if (value === "mine") return "Mine";
  if (value === "public") return "Public";
  if (value === "private") return "Private";
  return null;
}

function formatDateTime(value: string | null) {
  if (!value) return "No expiry";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No expiry";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function timeLeft(value: string | null) {
  if (!value) return "Open until accepted";
  const msLeft = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(msLeft) || msLeft <= 0) return "Expired";
  const hours = Math.ceil(msLeft / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h left`;
  return `${Math.ceil(hours / 24)}d left`;
}

function trustLabel(score: number) {
  if (score >= 1150) return "Very strong";
  if (score >= 1000) return "Strong";
  if (score >= 850) return "Fair";
  return "New player";
}

function trustBadgeTone(tone: PlayerTrustBadge["tone"]) {
  if (tone === "strong") return "success" as const;
  if (tone === "good") return "cyan" as const;
  if (tone === "watch") return "warning" as const;
  return "neutral" as const;
}

function percentLabel(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}%` : "New";
}

function trustBadgesForChallenge(challenge: MatchChallengeListRow): PlayerTrustBadge[] {
  const badges: PlayerTrustBadge[] = [
    {
      key: "verified_profile",
      label: "Verified profile",
      value: challenge.creator_profile_verified ? "Ready" : "Needs setup",
      tone: challenge.creator_profile_verified ? "strong" : "watch",
      public_note: challenge.creator_profile_verified ? "This player has finished player setup." : "This player still has profile steps to finish."
    },
    {
      key: "verified_game_handle",
      label: "Game handle check",
      value: challenge.creator_game_handle_verified ? "Verified" : "Saved",
      tone: challenge.creator_game_handle_verified ? "strong" : "good",
      public_note: challenge.creator_game_handle_verified ? "This player has a checked game handle." : "This player has a saved game handle. Skillsroom can check it during room review."
    },
    {
      key: "completed_matches",
      label: "Completed matches",
      value: challenge.creator_completed_matches.toString(),
      tone: challenge.creator_completed_matches >= 20 ? "strong" : challenge.creator_completed_matches >= 5 ? "good" : "new",
      public_note: "Settled match history on Skillsroom."
    },
    {
      key: "dispute_rate",
      label: "Dispute rate",
      value: `${challenge.creator_dispute_rate}%`,
      tone: challenge.creator_dispute_rate <= 2 ? "strong" : challenge.creator_dispute_rate <= 10 ? "good" : "watch",
      public_note: "Lower is better."
    },
    {
      key: "no_show_rate",
      label: "No-show rate",
      value: `${challenge.creator_no_show_rate}%`,
      tone: challenge.creator_no_show_rate <= 2 ? "strong" : challenge.creator_no_show_rate <= 10 ? "good" : "watch",
      public_note: "Lower is better."
    },
    {
      key: "funding_reliability",
      label: "Payment reliability",
      value: percentLabel(challenge.creator_funding_reliability),
      tone: challenge.creator_funding_reliability === null ? "new" : challenge.creator_funding_reliability >= 95 ? "strong" : challenge.creator_funding_reliability >= 80 ? "good" : "watch",
      public_note: "Checked payment proof history."
    },
    {
      key: "evidence_quality",
      label: "Proof quality",
      value: percentLabel(challenge.creator_evidence_quality),
      tone: challenge.creator_evidence_quality === null ? "new" : challenge.creator_evidence_quality >= 95 ? "strong" : challenge.creator_evidence_quality >= 80 ? "good" : "watch",
      public_note: "Useful proof attached to past result submissions."
    }
  ];

  if (challenge.creator_trust_warning) {
    badges.push({
      key: "extra_review",
      label: "Extra review",
      value: "Active",
      tone: "watch",
      public_note: "Skillsroom may review this player's activity more closely."
    });
  }

  return badges;
}

function creatorName(challenge: MatchChallengeListRow) {
  return challenge.creator_display_name || challenge.creator_username || "Skillsroom player";
}

function rulesetName(challenge: MatchChallengeListRow) {
  return challenge.ruleset_title || "Standard rules";
}

function missingSetupLabel(key: string) {
  if (key === "username") return "Choose a username.";
  if (key === "age_confirmation") return "Confirm your age.";
  if (key === "primary_game_account") return "Add your main game handle.";
  return displayEnumLabel(key);
}

function modeLinkClass(active: boolean) {
  return [
    "inline-flex min-h-12 min-w-0 items-center justify-center rounded-full px-3 text-sm font-black transition sm:px-4",
    active
      ? "bg-navy-950 text-white shadow-panel"
      : "border border-line bg-white text-muted hover:bg-surfaceHigh hover:text-ink"
  ].join(" ");
}

function ChallengeCard({
  challenge,
  currentUserId,
  profileReady
}: {
  challenge: MatchChallengeListRow;
  currentUserId: string;
  profileReady: boolean;
}) {
  const isMine = challenge.creator_user_id === currentUserId;
  const entry = formatMinorMoney(challenge.currency, challenge.entry_amount_minor);
  const creatorRecord = `${challenge.creator_wins}W - ${challenge.creator_losses}L`;
  const trustBadges = trustBadgesForChallenge(challenge);

  return (
    <article className="grid min-w-0 gap-4 border-b border-line bg-white p-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-5">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge tone={isMine ? "warning" : "cyan"}>{isMine ? "Your challenge" : "Open challenge"}</Badge>
          {challenge.visibility === "private" ? <Badge tone="neutral">Private</Badge> : null}
          <span className="rounded-full border border-line bg-surfaceHigh px-3 py-1 text-xs font-black text-muted">{timeLeft(challenge.expires_at)}</span>
        </div>
        <h2 className="mt-3 max-w-full text-xl font-black leading-tight text-ink [overflow-wrap:anywhere]">
          {challenge.title || `${challenge.game_name} challenge`}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {challenge.game_name} - {rulesetName(challenge)} - {challenge.platform} - {challenge.region}
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-line bg-surfaceHigh p-3">
            <dt className="text-xs font-black uppercase tracking-[0.12em] text-muted">Entry</dt>
            <dd className="mt-1 font-black text-ink">{entry}</dd>
          </div>
          <div className="rounded-md border border-line bg-surfaceHigh p-3">
            <dt className="text-xs font-black uppercase tracking-[0.12em] text-muted">Skill</dt>
            <dd className="mt-1 font-black text-ink">{displayEnumLabel(challenge.skill_level)}</dd>
          </div>
          <div className="rounded-md border border-line bg-surfaceHigh p-3">
            <dt className="text-xs font-black uppercase tracking-[0.12em] text-muted">Player trust</dt>
            <dd className="mt-1 font-black text-ink">{trustLabel(challenge.creator_trust_score)} ({challenge.creator_trust_score})</dd>
          </div>
          <div className="rounded-md border border-line bg-surfaceHigh p-3">
            <dt className="text-xs font-black uppercase tracking-[0.12em] text-muted">Record</dt>
            <dd className="mt-1 font-black text-ink">{creatorRecord}</dd>
          </div>
        </dl>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {trustBadges.map((item) => (
            <div className="rounded-md border border-line bg-surfaceHigh p-3" key={item.key}>
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[0.68rem] font-black uppercase tracking-[0.12em] text-muted">{item.label}</span>
                <Badge tone={trustBadgeTone(item.tone)}>{item.value}</Badge>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-bold text-muted">
          Created by {creatorName(challenge)}. Expires {formatDateTime(challenge.expires_at)}.
        </p>
      </div>
      <div className="grid min-w-[11rem] gap-2">
        {isMine ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
            href={`/matches/${challenge.match_room_id}`}
          >
            Open room
          </Link>
        ) : (
          <form action={acceptMatchChallengeAction}>
            <input name="challenge_id" type="hidden" value={challenge.id} />
            <SubmitButton
              disabled={!profileReady}
              fullWidth
              idleLabel={profileReady ? "Accept challenge" : "Finish profile first"}
              pendingLabel="Accepting..."
            />
          </form>
        )}
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-muted hover:bg-surfaceHigh hover:text-ink"
          href={`/matches/${challenge.match_room_id}`}
        >
          View details
        </Link>
      </div>
    </article>
  );
}

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<ChallengeSearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/challenges");

  const params = await searchParams;
  const selectedGameSlug = cleanFilter(params.game_slug);
  const selectedPlatform = cleanFilter(params.platform);
  const selectedRegion = cleanFilter(params.region);
  const selectedSkillLevel = parseSkillLevel(params.skill_level);
  const selectedVisibilityFilter = parseVisibilityFilter(params.visibility);
  const selectedVisibility = selectedVisibilityFilter === "mine" ? undefined : parseVisibility(selectedVisibilityFilter);
  const selectedScope = selectedVisibilityFilter === "mine" ? "mine" : undefined;
  const pageMode = params.mode === "create" ? "create" : "browse";

  let games: Game[] = [];
  let rulesets: MatchRuleset[] = [];
  let challenges: MatchChallengeListRow[] = [];
  let profileReady = false;
  let missingProfileItems: string[] = [];
  let loadError: string | null = null;

  try {
    const [catalog, profile, challengePage] = await Promise.all([
      listGameCatalog(),
      getProfileMe("summary"),
      listMatchChallenges({
        game_slug: selectedGameSlug,
        platform: selectedPlatform,
        region: selectedRegion,
        skill_level: selectedSkillLevel,
        visibility: selectedVisibility,
        scope: selectedScope,
        limit: 36
      })
    ]);
    games = catalog.games;
    rulesets = catalog.rulesets;
    challenges = challengePage.challenges;
    profileReady = Boolean(profile.completion.complete);
    missingProfileItems = profile.completion.missing ?? [];
  } catch {
    loadError = "Challenges are temporarily unavailable. Try this page again in a moment.";
  }

  const selectedGame = games.find((game) => game.slug === (selectedGameSlug ?? "free-fire")) ?? games[0] ?? null;
  const selectedRulesets = selectedGame ? rulesets.filter((ruleset) => ruleset.game_id === selectedGame.id) : [];
  const selectedRuleset = selectedRulesets[0] ?? null;
  const ownOpenCount = challenges.filter((challenge) => challenge.creator_user_id === user.id).length;
  const publicOpenCount = challenges.filter((challenge) => challenge.visibility === "public").length;
  const activeMarketplaceFilters = [
    visibilityFilterLabel(selectedVisibilityFilter),
    selectedGameSlug ? games.find((game) => game.slug === selectedGameSlug)?.name ?? selectedGameSlug : null,
    selectedPlatform,
    selectedRegion,
    selectedSkillLevel ? skillLevels.find((option) => option.value === selectedSkillLevel)?.label ?? displayEnumLabel(selectedSkillLevel) : null
  ].filter(Boolean);

  return (
    <AppShell active="challenges">
      <MotionSection className="grid min-w-0 max-w-full gap-6 overflow-hidden" variant="page">
        <MotionSection className="min-w-0 max-w-full overflow-hidden rounded-lg border border-navy-800 bg-navy-950 p-4 text-white shadow-panel sm:p-5 md:p-7" variant="hero">
          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <Badge tone="cyan" className="border-cyan/30 bg-cyan/10 text-cyan">Challenge Marketplace</Badge>
              <h1 className="mt-3 max-w-full text-3xl font-black leading-tight text-white [overflow-wrap:anywhere] sm:text-4xl lg:text-5xl">
                Find a challenge to play now.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 [overflow-wrap:anywhere] md:text-base">
                Browse H2H challenges by game, entry, platform, region, skill level, and player trust. Create one for everyone or keep it private for a player you invite.
              </p>
            </div>
            <div className="grid w-full min-w-0 grid-cols-3 gap-2 lg:w-auto lg:min-w-[28rem]">
              <div className="min-w-0 rounded-md border border-white/10 bg-white/5 p-3">
                <p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-300">Open</p>
                <p className="mt-1 truncate text-2xl font-black text-white">{challenges.length}</p>
              </div>
              <div className="min-w-0 rounded-md border border-white/10 bg-white/5 p-3">
                <p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-300">Public</p>
                <p className="mt-1 truncate text-2xl font-black text-white">{publicOpenCount}</p>
              </div>
              <div className="min-w-0 rounded-md border border-white/10 bg-white/5 p-3">
                <p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-300">Yours</p>
                <p className="mt-1 truncate text-2xl font-black text-white">{ownOpenCount}</p>
              </div>
            </div>
          </div>
        </MotionSection>

        {(params.error || loadError) ? (
          <TransientStatusBanner clearKeys={["error"]} durationMs={12000} message={params.error ?? loadError ?? ""} />
        ) : null}
        {params.created ? (
          <TransientStatusBanner clearKeys={["created"]} durationMs={12000} message="Challenge created. Players can now accept it from this page." tone="success" />
        ) : null}

        {!profileReady ? (
          <Reveal>
            <Panel>
              <PanelHeader
                eyebrow="Player setup"
                title="Finish your profile to create or accept challenges"
                description={missingProfileItems.length ? missingProfileItems.map(missingSetupLabel).join(" ") : "Add your player details before joining money rooms."}
                action={(
                  <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="/profile?sections=full#game-accounts">
                    Open profile setup
                  </Link>
                )}
              />
            </Panel>
          </Reveal>
        ) : null}

        <Reveal>
          <nav aria-label="Challenge sections" className="grid min-w-0 grid-cols-2 gap-3">
            <Link className={modeLinkClass(pageMode === "browse")} href="/challenges">
              Browse
            </Link>
            <Link className={modeLinkClass(pageMode === "create")} href="/challenges?mode=create">
              Post challenge
            </Link>
          </nav>
        </Reveal>

        {pageMode === "create" ? (
          <Reveal>
            <Panel>
                <PanelHeader
                  eyebrow="Create"
                  title="Post a challenge"
                  description="Set the game, entry, platform, region, skill level, and how long players have to accept."
                />
                {selectedGame && selectedRuleset ? (
                  <form action={createMatchChallengeAction} className="grid gap-4 p-4">
                    <input name="commission_bps" type="hidden" value="1000" />
                    <CatalogRulesetFields
                      games={games}
                      initialGameSlug={selectedGame.slug}
                      initialRulesetSlug={selectedRuleset.slug}
                      rulesets={rulesets}
                    />
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      Entry amount (NGN)
                      <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="2000" min="100" name="entry_amount_naira" required step="100" type="number" />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      Title
                      <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" maxLength={120} name="title" placeholder="Free Fire H2H tonight" />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-bold text-ink">
                        Visibility
                        <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="visibility" defaultValue="public">
                          {visibilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-bold text-ink">
                        Skill level
                        <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="skill_level" defaultValue="any">
                          {skillLevels.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-bold text-ink">
                        Platform
                        <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" list="challenge-platforms" name="platform" placeholder="Mobile" required />
                      </label>
                      <label className="grid gap-2 text-sm font-bold text-ink">
                        Region
                        <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" list="challenge-regions" name="region" placeholder="Nigeria" required />
                      </label>
                    </div>
                    <label className="grid gap-2 text-sm font-bold text-ink">
                      Expiry
                      <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="expiry_hours" defaultValue="24">
                        <option value="1">1 hour</option>
                        <option value="6">6 hours</option>
                        <option value="12">12 hours</option>
                        <option value="24">24 hours</option>
                        <option value="72">3 days</option>
                        <option value="168">7 days</option>
                      </select>
                    </label>
                    <datalist id="challenge-platforms">
                      {defaultPlatforms.map((item) => <option key={item} value={item} />)}
                    </datalist>
                    <datalist id="challenge-regions">
                      {defaultRegions.map((item) => <option key={item} value={item} />)}
                    </datalist>
                    <div className="rounded-md border border-cyan-200 bg-cyanSoft p-4">
                      <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-cyan">Fair play rules</p>
                      <p className="mt-2 text-sm font-bold leading-6 text-ink">
                        Accepted challenges become rooms with rules for late opponents, no-shows, disconnects, timeouts, and unclear proof.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {fallbackRoomIssueRules.map((rule) => (
                          <span className="rounded-full border border-cyan/20 bg-white px-3 py-1 text-xs font-black text-cyan" key={rule.key}>{rule.title}</span>
                        ))}
                      </div>
                    </div>
                    <SubmitButton disabled={!profileReady} idleLabel={profileReady ? "Post challenge" : "Finish profile first"} pendingLabel="Posting..." />
                  </form>
                ) : (
                  <div className="p-4">
                    <div className="rounded-md border border-dashed border-line bg-surfaceWarm p-6">
                      <h2 className="text-lg font-black text-ink">No active game available</h2>
                      <p className="mt-2 text-sm leading-6 text-muted">A challenge needs an active game and ruleset before it can be posted.</p>
                    </div>
                  </div>
                )}
              </Panel>
            </Reveal>
        ) : (
          <Reveal>
            <Panel id="open-challenges" className="scroll-mt-6">
                <PanelHeader
                  eyebrow="Marketplace"
                  title="Open H2H challenges"
                  description="Filter by the kind of match you want to play now."
                />
                <ChallengeMarketplaceFilterForm
                  games={games}
                  selectedGameSlug={selectedGameSlug}
                  selectedPlatform={selectedPlatform}
                  selectedRegion={selectedRegion}
                  selectedSkillLevel={selectedSkillLevel}
                  selectedVisibility={selectedVisibilityFilter}
                  skillLevels={skillLevels}
                  platforms={defaultPlatforms}
                  regions={defaultRegions}
                />
                <div id="challenge-results" className="flex min-w-0 scroll-mt-4 flex-col gap-2 border-b border-line bg-surfaceHigh px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-bold text-ink">
                    Showing {challenges.length.toLocaleString()} open {challenges.length === 1 ? "challenge" : "challenges"}
                  </p>
                  <p className="leading-6">
                    {activeMarketplaceFilters.length ? `Filters: ${activeMarketplaceFilters.join(" / ")}` : "No filters selected"}
                  </p>
                </div>
                {challenges.length ? (
                  <div className="divide-y divide-line">
                    {challenges.map((challenge) => (
                      <ChallengeCard challenge={challenge} currentUserId={user.id} key={challenge.id} profileReady={profileReady} />
                    ))}
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="rounded-md border border-dashed border-line bg-surfaceWarm p-6">
                      <h2 className="text-lg font-black text-ink">No open challenge found</h2>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        Try clearing the filters or post a challenge with your preferred game, platform, region, and entry.
                      </p>
                    </div>
                  </div>
                )}
              </Panel>
            </Reveal>
        )}
      </MotionSection>
    </AppShell>
  );
}
