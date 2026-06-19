import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { AppShell } from "@/components/layout/AppShell";
import { PlayerTrustCard } from "@/components/trust/PlayerTrustCard";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Timeline } from "@/components/ui/Timeline";
import { getCurrentUser, getGoogleLinkStatus } from "@/lib/auth-bridge";
import {
  formatEntryAmount,
  getMyCommunityClan,
  getMyReferralProgram,
  getPlayerTrustSummary,
  getProfileMe,
  listGameCatalog,
  type Game,
  type MatchPayout,
  type MatchRefund,
  type UserGameAccount
} from "@/lib/match-room-api";
import { updateProfileAction, upsertCommunityClanAction, upsertGameAccountAction, upsertPayoutProfileAction } from "./actions";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";

const premiumArtwork = {
  hero: "/marketing/skillsroom-premium/hero-premium.png",
  community: "/marketing/skillsroom-premium/community-premium.png"
} as const;

function accountTone(status: UserGameAccount["status"]) {
  if (status === "verified") return "success" as const;
  if (status === "rejected" || status === "disabled") return "danger" as const;
  return "cyan" as const;
}

function accountStatusLabel(status: UserGameAccount["status"]) {
  if (status === "verified") return "Verified";
  if (status === "rejected") return "Needs update";
  if (status === "disabled") return "Disabled";
  return "Saved";
}

function accountStatusDetail(status: UserGameAccount["status"]) {
  if (status === "verified") return "This handle has already been confirmed in admin review.";
  if (status === "rejected") return "Update this handle or UID if ops flagged a mismatch.";
  if (status === "disabled") return "This handle is no longer active for rooms.";
  return "This handle is usable in rooms now. Ops can still verify it later if evidence review needs extra confirmation.";
}

function missingLabel(value: string) {
  return value.replaceAll("_", " ");
}

function money(currency: string, amountMinor: number) {
  return formatEntryAmount({ currency, entry_amount_minor: amountMinor });
}

function settlementTone(status: string) {
  if (status === "completed") return "success" as const;
  if (status === "queued" || status === "payout_pending") return "warning" as const;
  if (status === "cancelled" || status === "failed") return "danger" as const;
  return "neutral" as const;
}

function roomLabel(row: MatchPayout | MatchRefund) {
  return row.room_title || row.room_code || "Match room";
}

type ProfilePageProps = {
  searchParams?: Promise<{
    error?: string;
    game_account_saved?: string;
    clan_saved?: string;
    google_linked?: string;
    google_link_error?: string;
    payout_profile_saved?: string;
    profile_updated?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect=/profile");

  let profileData: Awaited<ReturnType<typeof getProfileMe>> | null = null;
  let trustData: Awaited<ReturnType<typeof getPlayerTrustSummary>>["trust"] | null = null;
  let clanData: Awaited<ReturnType<typeof getMyCommunityClan>> | null = null;
  let referralData: Awaited<ReturnType<typeof getMyReferralProgram>> | null = null;
  let googleLinkStatus: Awaited<ReturnType<typeof getGoogleLinkStatus>> | null = null;
  let games: Game[] = [];
  let loadError: string | null = null;

  try {
    const [profileResult, trustResult, clanResult, referralResult, googleResult, catalogResult] = await Promise.all([
      getProfileMe(),
      getPlayerTrustSummary(user.id),
      getMyCommunityClan(),
      getMyReferralProgram(),
      getGoogleLinkStatus(),
      listGameCatalog()
    ]);
    profileData = profileResult;
    trustData = trustResult.trust;
    clanData = clanResult;
    referralData = referralResult;
    googleLinkStatus = googleResult;
    games = catalogResult.games;
  } catch {
    loadError = "Unable to load your player profile.";
  }

  const profile = profileData?.profile ?? null;
  const clan = clanData?.clan ?? null;
  const clanMembers = clanData?.members ?? [];
  const clanHistory = clanData?.tournament_history ?? [];
  const payoutProfile = profileData?.payout_profile ?? null;
  const payoutHistory = profileData?.payout_history ?? [];
  const refundHistory = profileData?.refund_history ?? [];
  const referralSummary = referralData?.summary ?? { total: 0, pending_activation: 0, reward_issued: 0, reward_held: 0 };
  const referrals = referralData?.referrals ?? [];
  const gameAccounts = profileData?.game_accounts ?? [];
  const gameMap = new Map(games.map((game) => [game.id, game]));
  const betaLeadGame = games.find((game) => game.slug === "free-fire") ?? games[0] ?? null;
  const completion = profileData?.completion;
  const defaultUsername = profile?.username ?? user.email?.split("@")[0]?.replace(/[^A-Za-z0-9_]/g, "").slice(0, 24) ?? "";
  const completionItems = [
    { label: "Account created", detail: "Your login account is active.", status: "done" as const },
    {
      label: "Profile details",
      detail: profile?.username ? "Username and profile visibility are set." : "Choose a username, region, and profile visibility.",
      status: profile?.username ? "done" as const : "current" as const
    },
    {
      label: "Primary game account",
      detail: gameAccounts.some((account) => account.is_primary && account.status !== "disabled")
        ? "Primary game handle is connected."
        : "Add your main in-game handle before entering rooms.",
      status: gameAccounts.some((account) => account.is_primary && account.status !== "disabled")
        ? "done" as const
        : profile?.username
          ? "current" as const
          : "pending" as const
    },
    {
      label: "Ready for rooms",
      detail: completion?.complete ? "Your profile can support room activity." : "Complete the missing checks before serious room activity.",
      status: completion?.complete ? "done" as const : "pending" as const
    }
  ];

  return (
    <AppShell active="profile">
      <section className="grid min-w-0 gap-5">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#24364a] bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(320px,40%)]">
            <div className="relative p-4 md:p-6 lg:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(33,170,255,0.18),transparent_36%)]" />
              <div className="relative">
                <Badge tone="cyan">Player Profile</Badge>
                <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">Trusted player identity.</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  Your profile connects login, game handles, reputation, payout readiness, and review history so rooms and tournaments can move with less friction.
                </p>
                <div className="mt-8 grid gap-3 xl:max-w-2xl xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Identity</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Keep one public-facing name tied to rooms, disputes, rankings, and clan activity.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Trust</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Reputation and review history stay close to the same player record instead of being fragmented.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Readiness</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">Complete the critical checks once, then use the profile across matches and tournament operations.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative min-h-[300px] border-t border-white/10 xl:min-h-full xl:border-l xl:border-t-0">
              <Image alt="Premium Skillsroom player identity artwork" className="object-cover" fill priority sizes="(min-width: 1280px) 40vw, 100vw" src={premiumArtwork.hero} />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#08131f]/80" />
              <div className="absolute inset-x-4 bottom-4 grid gap-3 md:inset-x-6">
                <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Profile value</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">Handles, payouts, referrals, and community identity live together so trust compounds over time.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loadError ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div>
        ) : null}
        {params?.error ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{params.error}</div>
        ) : null}
        {params?.profile_updated ? (
          <div className="rounded-md border border-success bg-successSoft p-4 text-sm font-bold text-success">
            Profile details saved.
          </div>
        ) : null}
        {params?.payout_profile_saved ? (
          <div className="rounded-md border border-success bg-successSoft p-4 text-sm font-bold text-success">
            Payout instructions saved for future winner payouts and refunds.
          </div>
        ) : null}
        {params?.game_account_saved ? (
          <div className="rounded-md border border-success bg-successSoft p-4 text-sm font-bold text-success">
            Game account saved. Admins can now verify it during room review.
          </div>
        ) : null}
        {params?.clan_saved ? (
          <div className="rounded-md border border-success bg-successSoft p-4 text-sm font-bold text-success">
            Clan profile saved.
          </div>
        ) : null}
        {params?.google_linked ? (
          <div className="rounded-md border border-success bg-successSoft p-4 text-sm font-bold text-success">
            Google sign-in is now linked to your Skillsroom account.
          </div>
        ) : null}
        {params?.google_link_error ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            Could not link that Google account. It may already be linked to another Skillsroom account.
          </div>
        ) : null}

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel>
            <PanelHeader eyebrow="Trust Card" title="Player summary" description="This is the identity and reputation context attached to your room activity." />
            <div className="p-4">
              {trustData ? (
                <PlayerTrustCard trust={trustData} />
              ) : (
                <EmptyState description="Sign in again or complete your profile to refresh trust signals." title="Trust profile unavailable" />
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Completion" title="Readiness" />
            <div className="grid gap-3 p-4">
              <StatusPanel
                detail={completion?.missing.length ? completion.missing.map(missingLabel).join(", ") : "All checks passed"}
                label="Profile"
                tone={completion?.complete ? "success" : "warning"}
                value={completion?.complete ? "Ready" : "Open"}
              />
              <Timeline items={completionItems} />
            </div>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel>
            <PanelHeader
              description="Set the identity players and admins will see around rooms, evidence, and disputes."
              eyebrow="Profile Details"
              title="Edit identity"
            />
            <form action={updateProfileAction} className="grid gap-4 p-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Username
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  defaultValue={defaultUsername}
                  maxLength={24}
                  minLength={3}
                  name="username"
                  pattern="[A-Za-z0-9_]+"
                  required
                />
                <span className="text-xs leading-5 text-muted">Letters, numbers, and underscores only. This is your Skillsroom username.</span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Public name
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  defaultValue={profile?.display_name ?? profile?.username ?? ""}
                  maxLength={80}
                  name="display_name"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Region
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  defaultValue={profile?.region ?? "NG"}
                  maxLength={40}
                  name="region"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                City
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  defaultValue={profile?.city ?? ""}
                  maxLength={80}
                  name="city"
                  placeholder="Lagos"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Campus / community
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  defaultValue={profile?.campus ?? ""}
                  maxLength={120}
                  name="campus"
                  placeholder="UNILAG, FUTA, Yaba, Discord clan"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Timezone
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  defaultValue={profile?.timezone ?? "Africa/Lagos"}
                  maxLength={80}
                  name="timezone"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Visibility
                <select
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  defaultValue={profile?.visibility ?? "room_participants"}
                  name="visibility"
                >
                  <option value="room_participants">Room participants</option>
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink md:col-span-2">
                Bio
                <textarea
                  className="min-h-24 rounded-md border border-line bg-white px-3 py-3 text-sm outline-none focus:border-action"
                  defaultValue={profile?.bio ?? ""}
                  maxLength={180}
                  name="bio"
                  placeholder="Short player note, clan, or preferred match style."
                />
              </label>
              <label className="flex items-start gap-3 rounded-md border border-line bg-surfaceWarm p-4 text-sm font-bold text-ink md:col-span-2">
                <input className="mt-1 size-4 accent-action" defaultChecked={Boolean(profile?.age_confirmed_at)} name="age_confirmed" type="checkbox" />
                <span>
                  I confirm I am old enough to use Skillsroom.
                  <span className="mt-1 block text-xs font-medium leading-5 text-muted">
                    This is required before creating or joining match rooms.
                  </span>
                </span>
              </label>
              <div className="md:col-span-2">
                <SubmitButton idleLabel="Save profile" pendingLabel="Saving profile..." />
              </div>
            </form>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="History" title="Reputation record" />
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
              <StatusPanel detail="Platform score" label="Reputation" tone="success" value={(profile?.reputation_score ?? 1000).toString()} />
              <StatusPanel detail="Settled matches" label="Completed" tone="cyan" value={(profile?.completed_matches ?? 0).toString()} />
              <StatusPanel detail={`${profile?.wins ?? 0} wins / ${profile?.losses ?? 0} losses`} label="Record" tone="success" value={`${profile?.wins ?? 0}-${profile?.losses ?? 0}`} />
              <StatusPanel detail="Lost disputes" label="Disputes" tone={(profile?.disputes_lost ?? 0) > 0 ? "warning" : "success"} value={(profile?.disputes_lost ?? 0).toString()} />
            </div>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel id="payout-profile">
            <PanelHeader
              eyebrow="Payout Instructions"
              title="Winner and refund destination"
              description="Ops uses this snapshot when a room result is approved or a refund is queued, so keep it current."
            />
            <form action={upsertPayoutProfileAction} className="grid gap-4 p-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Account name
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  defaultValue={payoutProfile?.recipient_name ?? profile?.display_name ?? profile?.username ?? ""}
                  maxLength={120}
                  name="recipient_name"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank name
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  defaultValue={payoutProfile?.bank_name ?? ""}
                  maxLength={120}
                  name="bank_name"
                  placeholder="OPay, PalmPay, GTBank"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Account number
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action"
                  defaultValue={payoutProfile?.account_number ?? ""}
                  inputMode="numeric"
                  maxLength={20}
                  name="account_number"
                  pattern="[0-9]{6,20}"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank code
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                  defaultValue={payoutProfile?.bank_code ?? ""}
                  maxLength={40}
                  name="bank_code"
                  placeholder="Optional routing or bank code"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Currency
                <input
                  className="min-h-11 rounded-md border border-line bg-white px-3 text-sm uppercase outline-none focus:border-action"
                  defaultValue={payoutProfile?.currency ?? "NGN"}
                  maxLength={8}
                  name="currency"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink md:col-span-2">
                Payout note
                <textarea
                  className="min-h-24 rounded-md border border-line bg-white px-3 py-3 text-sm outline-none focus:border-action"
                  defaultValue={payoutProfile?.payout_note ?? ""}
                  maxLength={240}
                  name="payout_note"
                  placeholder="Optional note for ops, like preferred bank account label."
                />
              </label>
              <div className="rounded-md border border-cyan bg-cyanSoft p-4 text-sm leading-6 text-muted md:col-span-2">
                The latest approved room result snapshots these instructions into the payout queue, so later profile edits do not rewrite older ops records.
              </div>
              <div className="md:col-span-2">
                <SubmitButton idleLabel="Save payout instructions" pendingLabel="Saving payout instructions..." />
              </div>
            </form>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Ops Snapshot" title="Current payout card" />
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
              <StatusPanel
                detail={payoutProfile?.bank_name ?? "Add the bank you want ops to use"}
                label="Destination"
                tone={payoutProfile ? "success" : "warning"}
                value={payoutProfile ? "Ready" : "Missing"}
              />
              <StatusPanel
                detail={payoutProfile?.recipient_name ?? "Account holder name"}
                label="Recipient"
                tone={payoutProfile ? "cyan" : "warning"}
                value={payoutProfile?.account_number_masked ?? "Not set"}
              />
              <StatusPanel
                detail="Queued winner payouts tied to your account"
                label="Payouts"
                tone="success"
                value={payoutHistory.length.toString()}
              />
              <StatusPanel
                detail="Queued or completed refunds tied to your account"
                label="Refunds"
                tone="warning"
                value={refundHistory.length.toString()}
              />
            </div>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-2" id="settlement-history">
          <Panel>
            <PanelHeader eyebrow="Payout History" title="Winner settlement timeline" description="Every queued or completed winner payout that has been attached to your account." />
            {payoutHistory.length ? (
              <DataTable
                columns={[
                  {
                    key: "room",
                    label: "Room",
                    render: (row) => (
                      <div className="grid gap-1">
                        <strong className="text-ink">{roomLabel(row)}</strong>
                        {row.room_code ? <span className="font-mono text-xs font-bold text-muted">{row.room_code}</span> : null}
                      </div>
                    )
                  },
                  { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.amount_minor)}</span> },
                  { key: "instruction_status", label: "Instructions", render: (row) => <Badge tone={row.instruction_status === "ready" ? "success" : "warning"}>{row.instruction_status}</Badge> },
                  { key: "status", label: "Status", render: (row) => <Badge tone={settlementTone(row.status)}>{row.status}</Badge> },
                  { key: "created_at", label: "Queued", render: (row) => <span className="text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> }
                ]}
                rows={payoutHistory}
              />
            ) : (
              <div className="p-4 text-sm leading-6 text-muted">No winner payout has been queued for this account yet.</div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Refund History" title="Refund settlement timeline" description="Refund records stay visible here so you can see what ops has queued or completed." />
            {refundHistory.length ? (
              <DataTable
                columns={[
                  {
                    key: "room",
                    label: "Room",
                    render: (row) => (
                      <div className="grid gap-1">
                        <strong className="text-ink">{roomLabel(row)}</strong>
                        {row.room_code ? <span className="font-mono text-xs font-bold text-muted">{row.room_code}</span> : null}
                      </div>
                    )
                  },
                  { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.amount_minor)}</span> },
                  { key: "reason", label: "Reason", render: (row) => <span className="text-muted">{row.reason}</span> },
                  { key: "status", label: "Status", render: (row) => <Badge tone={settlementTone(row.status)}>{row.status}</Badge> },
                  { key: "created_at", label: "Queued", render: (row) => <span className="text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> }
                ]}
                rows={refundHistory}
              />
            ) : (
              <div className="p-4 text-sm leading-6 text-muted">No refund has been queued for this account yet.</div>
            )}
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel id="clan-profile">
            <PanelHeader
              eyebrow="Clan Profile"
              title={clan ? "Manage your clan identity" : "Create your clan identity"}
              description="This is the persistent team/clan profile that public standings and future team tournament history will attach to."
            />
            <form action={upsertCommunityClanAction} className="grid gap-4 p-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Clan name
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={clan?.name ?? ""} maxLength={80} name="name" placeholder="Skillsroom Lagos" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Tag
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm uppercase outline-none focus:border-action" defaultValue={clan?.tag ?? ""} maxLength={12} name="tag" placeholder="SRL" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Region
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={clan?.region ?? profile?.region ?? "NG"} maxLength={40} name="region" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                City
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={clan?.city ?? profile?.city ?? ""} maxLength={80} name="city" placeholder="Lagos" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Campus / community
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={clan?.campus ?? profile?.campus ?? ""} maxLength={120} name="campus" placeholder="UNILAG, FUTA, Yaba" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Visibility
                <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={clan?.visibility ?? "public"} name="visibility">
                  <option value="public">Public</option>
                  <option value="invite_only">Invite only</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink md:col-span-2">
                Game focus
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={Array.isArray(clan?.game_focus) ? clan?.game_focus.join(", ") : ""} name="game_focus" placeholder="free-fire, valorant, ea-sports-fc-mobile" required />
                <span className="text-xs leading-5 text-muted">Use game slugs, separated by commas.</span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink md:col-span-2">
                Description
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-3 text-sm outline-none focus:border-action" defaultValue={clan?.description ?? ""} maxLength={500} name="description" placeholder="What this clan plays, where it competes, and how it shows up." />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Avatar URL
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={clan?.avatar_url ?? ""} maxLength={500} name="avatar_url" placeholder="https://..." />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Banner URL
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={clan?.banner_url ?? ""} maxLength={500} name="banner_url" placeholder="https://..." />
              </label>
              <div className="md:col-span-2">
                <SubmitButton idleLabel={clan ? "Save clan profile" : "Create clan profile"} pendingLabel={clan ? "Saving clan profile..." : "Creating clan profile..."} />
              </div>
            </form>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Clan Snapshot" title="Public team signals" />
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
              <StatusPanel detail="Active members on the public roster" label="Members" tone="cyan" value={clanMembers.length.toString()} />
              <StatusPanel detail="Current clan reputation score" label="Reputation" tone="success" value={(clan?.reputation_score ?? 1000).toString()} />
              <StatusPanel detail="Completed clan-linked tournaments" label="Tourneys" tone="warning" value={(clanHistory.length || 0).toString()} />
              <StatusPanel detail="Future team tournament entries by you will attach here automatically." label="Linkage" tone="success" value={clan ? "Ready" : "Open"} />
              {clan ? (
                <Link className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh" href={`/community/clans/${encodeURIComponent(clan.slug)}`}>
                  Open public clan page
                </Link>
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel>
            <PanelHeader
              eyebrow="Referral Program"
              title="Invite serious players"
              description="Referral rewards stay non-money for now and only unlock after the invited player completes real setup and activity."
            />
            <div className="grid gap-4 p-4">
              <div className="rounded-md border border-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Referral code</p>
                <p className="mt-2 break-all font-mono text-2xl font-black text-ink">{referralData?.referral_code ?? "Loading"}</p>
                <p className="mt-2 text-sm text-muted break-all">{referralData?.referral_path ? new URL(referralData.referral_path, appUrl).toString() : "Referral link unavailable."}</p>
              </div>
              {referrals.length ? (
                <DataTable
                  columns={[
                    {
                      key: "referred_display_name",
                      label: "Player",
                      render: (row) => (
                        <div className="grid gap-1">
                          <strong className="text-ink">{row.referred_display_name || row.referred_username || "Referred player"}</strong>
                          {row.referred_username ? <span className="font-mono text-xs font-bold text-muted">@{row.referred_username}</span> : null}
                        </div>
                      )
                    },
                    { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "reward_issued" ? "success" : row.status === "reward_held" ? "warning" : "neutral"}>{row.status.replaceAll("_", " ")}</Badge> },
                    { key: "issued_rewards", label: "Rewards", render: (row) => <span className="text-xs font-bold text-muted">{row.issued_rewards.length ? row.issued_rewards.join(", ").replaceAll("_", " ") : "Pending activation"}</span> }
                  ]}
                  rows={referrals.slice(0, 6)}
                />
              ) : (
                <div className="rounded-md border border-dashed border-line bg-surfaceWarm p-5 text-sm leading-6 text-muted">
                  Referred players will appear here after they sign up with your code.
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Rewards" title="Current status" />
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
              <StatusPanel detail="Tracked referred signups" label="Total" tone="cyan" value={referralSummary.total.toString()} />
              <StatusPanel detail="Need setup or first real activity" label="Pending" tone="warning" value={referralSummary.pending_activation.toString()} />
              <StatusPanel detail="Non-money rewards unlocked" label="Issued" tone="success" value={referralSummary.reward_issued.toString()} />
              <StatusPanel detail="Held for moderation review" label="Held" tone={referralSummary.reward_held ? "warning" : "success"} value={referralSummary.reward_held.toString()} />
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            description="Use Google as a fast sign-in method while keeping your existing Skillsroom account, rooms, profile, and reputation."
            eyebrow="Account Access"
            title="Google sign-in"
            action={<Badge tone={googleLinkStatus?.linked ? "success" : "neutral"}>{googleLinkStatus?.linked ? "Linked" : "Optional"}</Badge>}
          />
          <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:items-center">
            <div className="rounded-md border border-line bg-white p-4">
              <p className="text-sm font-black text-ink">
                {googleLinkStatus?.linked ? "Google is connected" : "Link Google to this account"}
              </p>
              <p className="mt-2 break-words text-sm leading-6 text-muted">
                {googleLinkStatus?.linked
                  ? `You can sign in with ${googleLinkStatus.email ?? "your linked Google account"}.`
                  : "After linking, you can use either email/password or Google to access this same account."}
              </p>
            </div>
            {googleLinkStatus?.linked ? (
              <div className="rounded-md border border-success bg-successSoft p-4 text-sm font-bold text-success">
                Linked and ready for future sign-ins.
              </div>
            ) : (
              <GoogleAuthButton action="/api/auth/identity/link" label="Link Google account" redirectTo="/profile" />
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            description="Your in-game handles are what players use to find you during rooms and tournaments. They stay separate from your Skillsroom login."
            eyebrow="Game Accounts"
            title="Connected game accounts"
          />
          {gameAccounts.length ? (
            <div className="border-b border-line px-4 py-4 text-sm leading-6 text-muted">
              Saved handles stay attached to your profile across supported games. Older accounts can still appear here if
              you used them in previous seasons or before the catalog widened beyond a single title.
            </div>
          ) : null}
          {gameAccounts.length ? (
            <DataTable
              columns={[
                { key: "game_name", label: "Game", render: (row) => <span className="text-sm font-bold text-ink">{gameMap.get(row.game_id)?.name ?? row.game_id}</span> },
                { key: "handle", label: "Handle", render: (row) => <span className="font-mono font-bold text-ink">{row.handle}</span> },
                { key: "platform", label: "Platform", render: (row) => <span className="text-muted">{row.platform}</span> },
                { key: "region", label: "Region", render: (row) => <span className="text-muted">{row.region}</span> },
                { key: "is_primary", label: "Primary", render: (row) => <Badge tone={row.is_primary ? "cyan" : "neutral"}>{row.is_primary ? "Primary" : "Secondary"}</Badge> },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <div className="grid gap-1">
                      <Badge tone={accountTone(row.status)}>{accountStatusLabel(row.status)}</Badge>
                      <span className="text-xs leading-5 text-muted">{accountStatusDetail(row.status)}</span>
                    </div>
                  )
                }
              ]}
              rows={gameAccounts}
            />
          ) : (
            <div className="p-4">
              <div className="rounded-md border border-dashed border-line bg-surfaceWarm p-6">
                <p className="text-lg font-black text-ink">No game account connected</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Add the exact in-game name players see in your selected title. If you know the UID, Player ID, Riot ID, Epic name, or equivalent, add it too.
                </p>
              </div>
            </div>
          )}
          <form action={upsertGameAccountAction} className="grid gap-4 border-t border-line p-4 md:grid-cols-2" id="game-accounts">
            <label className="grid gap-2 text-sm font-bold text-ink">
              Game
              <select
                className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                defaultValue={betaLeadGame?.slug ?? ""}
                name="game_slug"
                required
              >
                {games.map((game) => (
                  <option key={game.id} value={game.slug}>
                    {game.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              In-game handle
              <input
                className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                maxLength={80}
                minLength={2}
                name="handle"
                placeholder="Your in-game name"
                required
              />
              <span className="text-xs leading-5 text-muted">This is not your email or Skillsroom username.</span>
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              External player ID
              <input
                className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                maxLength={120}
                name="external_uid"
                placeholder="Optional, but best for verification"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Region
              <input
                className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                defaultValue={profile?.region ?? "NG"}
                maxLength={40}
                name="region"
                required
              />
            </label>
            <div className="rounded-md border border-cyan bg-cyanSoft p-4 text-sm leading-6 text-muted">
              <span className="font-black text-ink">Primary account:</span> this handle will be used for room matching,
              opponent checks, screenshots, and admin evidence review in the selected game.
            </div>
            <div className="md:col-span-2">
              <SubmitButton idleLabel="Save game account" pendingLabel="Saving game account..." />
            </div>
          </form>
        </Panel>
      </section>
    </AppShell>
  );
}
