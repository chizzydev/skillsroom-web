import { redirect } from "next/navigation";
import Link from "next/link";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { AppShell } from "@/components/layout/AppShell";
import { PlayerTrustCard } from "@/components/trust/PlayerTrustCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { Timeline } from "@/components/ui/Timeline";
import { getCurrentUser, getGoogleLinkStatus } from "@/lib/auth-bridge";
import { getMyCommunityClan, getMyReferralProgram, getPlayerTrustSummary, getProfileMe, type UserGameAccount } from "@/lib/match-room-api";
import { updateProfileAction, upsertCommunityClanAction, upsertGameAccountAction } from "./actions";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";

function accountTone(status: UserGameAccount["status"]) {
  if (status === "verified") return "success" as const;
  if (status === "rejected" || status === "disabled") return "danger" as const;
  return "warning" as const;
}

function missingLabel(value: string) {
  return value.replaceAll("_", " ");
}

type ProfilePageProps = {
  searchParams?: Promise<{
    error?: string;
    game_account_saved?: string;
    clan_saved?: string;
    google_linked?: string;
    google_link_error?: string;
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
  let loadError: string | null = null;

  try {
    const [profileResult, trustResult, clanResult, referralResult, googleResult] = await Promise.all([
      getProfileMe(),
      getPlayerTrustSummary(user.id),
      getMyCommunityClan(),
      getMyReferralProgram(),
      getGoogleLinkStatus()
    ]);
    profileData = profileResult;
    trustData = trustResult.trust;
    clanData = clanResult;
    referralData = referralResult;
    googleLinkStatus = googleResult;
  } catch {
    loadError = "Unable to load your player profile.";
  }

  const profile = profileData?.profile ?? null;
  const clan = clanData?.clan ?? null;
  const clanMembers = clanData?.members ?? [];
  const clanHistory = clanData?.tournament_history ?? [];
  const referralSummary = referralData?.summary ?? { total: 0, pending_activation: 0, reward_issued: 0, reward_held: 0 };
  const referrals = referralData?.referrals ?? [];
  const gameAccounts = profileData?.game_accounts ?? [];
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
      label: "COD Mobile account",
      detail: gameAccounts.some((account) => account.is_primary && account.status !== "disabled")
        ? "Primary game handle is connected."
        : "Add your COD Mobile handle before entering rooms.",
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
        <section className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-tight md:p-5">
          <Badge tone="cyan">Player Profile</Badge>
          <h1 className="mt-3 text-2xl font-black text-ink md:text-3xl">Trusted Player Identity</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
            Your profile connects login, COD Mobile handle, reputation, and review history so rooms can be settled with less confusion.
          </p>
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
        {params?.game_account_saved ? (
          <div className="rounded-md border border-success bg-successSoft p-4 text-sm font-bold text-success">
            COD Mobile handle saved. Admins can now verify it during room review.
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
                <div className="rounded-lg border border-dashed border-line bg-surfaceWarm p-6">
                  <p className="text-lg font-black text-ink">Trust profile unavailable</p>
                  <p className="mt-2 text-sm leading-6 text-muted">Sign in again or complete your profile to refresh trust signals.</p>
                </div>
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
                <Button type="submit">Save profile</Button>
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
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue={Array.isArray(clan?.game_focus) ? clan?.game_focus.join(", ") : ""} name="game_focus" placeholder="cod-mobile, efootball, fifa-24" required />
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
                <Button type="submit">{clan ? "Save clan profile" : "Create clan profile"}</Button>
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
              <GoogleAuthButton action="/api/auth/google/link" label="Link Google account" redirectTo="/profile" />
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            description="Your COD handle is what players use to find you in-game. It is separate from your Skillsroom login."
            eyebrow="Game Accounts"
            title="Connected COD Mobile handles"
          />
          {gameAccounts.length ? (
            <DataTable
              columns={[
                { key: "handle", label: "Handle", render: (row) => <span className="font-mono font-bold text-ink">{row.handle}</span> },
                { key: "platform", label: "Platform", render: (row) => <span className="text-muted">{row.platform}</span> },
                { key: "region", label: "Region", render: (row) => <span className="text-muted">{row.region}</span> },
                { key: "is_primary", label: "Primary", render: (row) => <Badge tone={row.is_primary ? "cyan" : "neutral"}>{row.is_primary ? "Primary" : "Secondary"}</Badge> },
                { key: "status", label: "Status", render: (row) => <Badge tone={accountTone(row.status)}>{row.status}</Badge> }
              ]}
              rows={gameAccounts}
            />
          ) : (
            <div className="p-4">
              <div className="rounded-md border border-dashed border-line bg-surfaceWarm p-6">
                <p className="text-lg font-black text-ink">No COD Mobile handle connected</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Add the exact COD Mobile name players see in-game. If you know your UID or Player ID, add it too.
                </p>
              </div>
            </div>
          )}
          <form action={upsertGameAccountAction} className="grid gap-4 border-t border-line p-4 md:grid-cols-2" id="game-accounts">
            <label className="grid gap-2 text-sm font-bold text-ink">
              COD Mobile handle
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
              COD Mobile UID / Player ID
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
              <span className="font-black text-ink">Primary account:</span> this COD Mobile handle will be used for room matching,
              opponent checks, screenshots, and admin evidence review.
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Save COD handle</Button>
            </div>
          </form>
        </Panel>
      </section>
    </AppShell>
  );
}
