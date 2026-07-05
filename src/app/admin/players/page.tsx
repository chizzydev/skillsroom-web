import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminShell } from "@/components/layout/AdminShell";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { listAdminGameAccounts, listLeaderboard, type AdminGameAccount, type LeaderboardRow } from "@/lib/match-room-api";
import { reviewGameAccountAction } from "./actions";

export const dynamic = "force-dynamic";

function disputeTone(row: LeaderboardRow) {
  if (row.disputes_lost > 1 || row.no_shows > 1) return "danger" as const;
  if (row.disputes_lost > 0 || row.no_shows > 0) return "warning" as const;
  return "success" as const;
}

function accountTone(status: AdminGameAccount["status"]) {
  if (status === "verified") return "success" as const;
  if (status === "rejected" || status === "disabled") return "danger" as const;
  return "warning" as const;
}

export default async function AdminPlayersPage({ searchParams }: { searchParams?: Promise<{ error?: string; game_account_reviewed?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/players");
  if (!canUseAdminSection(user, "players")) redirect("/admin");
  const canReviewGameAccounts = user?.role === "moderator" || user?.role === "admin" || user?.role === "owner";

  let leaderboard: LeaderboardRow[] = [];
  let gameAccounts: AdminGameAccount[] = [];
  let loadError: string | null = null;
  try {
    const [leaderboardResult, gameAccountResult] = await Promise.all([
      listLeaderboard(),
      listAdminGameAccounts("pending")
    ]);
    leaderboard = leaderboardResult.leaderboard;
    gameAccounts = gameAccountResult.game_accounts;
  } catch {
    loadError = "Unable to load player records right now.";
  }

  const readyPlayers = leaderboard.filter((row) => row.completed_matches > 0).length;
  const attentionNeeded = leaderboard.filter((row) => row.disputes_lost > 0 || row.no_shows > 0).length;
  const totalWins = leaderboard.reduce((sum, row) => sum + row.wins, 0);
  const pendingHandles = gameAccounts.filter((account) => account.status === "pending").length;

  return (
    <AdminShell active="players">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Check player handles, match history, disputes, and no-shows before making player decisions."
          eyebrow="Players"
          title="Player review"
        />

        {loadError ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div>
        ) : null}
        {params?.error ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{params.error}</div>
        ) : null}
        {params?.game_account_reviewed ? (
          <div className="rounded-md border border-success bg-successSoft p-4 text-sm font-bold text-success">
            Player handle review saved.
          </div>
        ) : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Players with records" label="Players" tone="cyan" value={leaderboard.length.toString()} />
          <StatusPanel detail="Completed matches" label="Active Records" tone="success" value={readyPlayers.toString()} />
          <StatusPanel detail="Disputes or no-shows" label="Needs Attention" tone={attentionNeeded > 0 ? "warning" : "success"} value={attentionNeeded.toString()} />
          <StatusPanel detail="Waiting for review" label="Pending Handles" tone={pendingHandles > 0 ? "warning" : "success"} value={pendingHandles.toString()} />
        </div>

        <Panel>
          <PanelHeader
            description="Approve the handle only when the screenshot, lobby proof, or community confirmation looks believable."
            eyebrow="Game Handle"
            title="Handles waiting for review"
          />
          {gameAccounts.length ? (
            <DataTable
              columns={[
                {
                  key: "username",
                  label: "Player",
                  render: (row) => (
                    <div>
                      <strong className="block text-ink">{row.username ?? row.display_name ?? "Unnamed player"}</strong>
                      <span className="block text-xs text-muted">{row.user_email ?? row.user_id}</span>
                    </div>
                  )
                },
                { key: "handle", label: "Handle", render: (row) => <span className="font-mono font-bold text-ink">{row.handle}</span> },
                { key: "external_uid", label: "UID", render: (row) => <span className="font-mono text-muted">{row.external_uid ?? "Not supplied"}</span> },
                { key: "status", label: "Status", render: (row) => <Badge tone={accountTone(row.status)}>{row.status}</Badge> },
                {
                  key: "id",
                  label: canReviewGameAccounts ? "Review" : "Access",
                  render: (row) => (
                    canReviewGameAccounts ? (
                    <form action={reviewGameAccountAction} className="grid min-w-48 gap-2">
                      <input name="game_account_id" type="hidden" value={row.id} />
                      <input
                        className="min-h-9 rounded-md border border-line bg-white px-3 text-xs outline-none focus:border-action"
                        name="verification_notes"
                        placeholder="Review note"
                      />
                      <div className="flex flex-wrap gap-2">
                        <FormActionButton className="text-xs" idleLabel="Verify" name="status" pendingLabel="Verifying..." size="sm" value="verified" />
                        <FormActionButton className="text-xs" idleLabel="Reject" name="status" pendingLabel="Rejecting..." size="sm" value="rejected" variant="danger" />
                      </div>
                    </form>
                    ) : (
                      <span className="text-xs font-bold leading-5 text-muted">Support can view this, but only community managers and above can approve or reject handles.</span>
                    )
                  )
                }
              ]}
              rows={gameAccounts}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState
                description="New handle submissions will appear here after players add them from their profile."
                title="No handles waiting"
              />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            description="Use this to quickly understand player history before making a decision."
            eyebrow="Directory"
            title="Reputation leaderboard"
          />
          <p className="px-4 pt-4 text-sm font-bold text-muted">Total wins tracked: {totalWins}</p>
          {leaderboard.length ? (
            <DataTable
              columns={[
                { key: "username", label: "Player", render: (row) => <strong className="text-ink">{row.username}</strong> },
                { key: "reputation_score", label: "Rep", render: (row) => <span className="font-mono font-bold text-ink">{row.reputation_score}</span> },
                { key: "completed_matches", label: "Matches", render: (row) => <span className="font-mono font-bold text-muted">{row.completed_matches}</span> },
                { key: "wins", label: "Record", render: (row) => <span className="font-mono font-bold text-ink">{row.wins}-{row.losses}</span> },
                { key: "disputes_lost", label: "Disputes", render: (row) => <Badge tone={disputeTone(row)}>{row.disputes_lost} lost</Badge> },
                { key: "no_shows", label: "No-shows", render: (row) => <Badge tone={row.no_shows > 0 ? "warning" : "success"}>{row.no_shows}</Badge> }
              ]}
              rows={leaderboard}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState
                description="Player records appear after profiles and match history exist."
                title="No player records yet"
              />
            </div>
          )}
        </Panel>
      </section>
    </AdminShell>
  );
}
