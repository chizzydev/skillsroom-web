import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminShell } from "@/components/layout/AdminShell";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { PendingLink } from "@/components/ui/PendingLink";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import {
  getAdminLadderSnapshot,
  listAdminLadderSnapshots,
  listGameCatalog,
  type Game,
  type LadderEntryReviewStatus,
  type LadderSnapshotStatus,
  type PlayerLadderSnapshot,
  type PlayerLadderSnapshotEntry
} from "@/lib/match-room-api";
import {
  publishLadderSnapshotAction,
  refreshLadderSnapshotAction,
  resetLadderSnapshotAction,
  reviewLadderEntryAction
} from "./actions";

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function scopeLabel(snapshot: PlayerLadderSnapshot) {
  const game = snapshot.game_name ?? "All games";
  return snapshot.city ? `${game} in ${snapshot.city}` : game;
}

function statusTone(status: LadderSnapshotStatus): BadgeTone {
  if (status === "published") return "success";
  if (status === "reset") return "danger";
  return "warning";
}

function reviewTone(status: LadderEntryReviewStatus): BadgeTone {
  if (status === "visible") return "success";
  if (status === "held") return "warning";
  return "danger";
}

function playerName(entry: PlayerLadderSnapshotEntry) {
  return entry.display_name_snapshot || entry.username_snapshot || "Skillsroom player";
}

function gameOptions(games: Game[]) {
  return games.filter((game) => game.status === "active").slice(0, 20);
}

export default async function AdminLaddersPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string; snapshot_id?: string }>;
}) {
  const user = await getCurrentUser();
  if (!canUseAdminSection(user, "ladders")) redirect("/sign-in?redirect=/admin/ladders");

  const params = await searchParams;
  const canReset = user?.role === "admin" || user?.role === "owner";
  let games: Game[] = [];
  let snapshots: PlayerLadderSnapshot[] = [];
  let selectedSnapshot: PlayerLadderSnapshot | null = null;
  let entries: PlayerLadderSnapshotEntry[] = [];
  const loadErrors: string[] = [];

  try {
    const [catalog, snapshotPage] = await Promise.all([
      listGameCatalog(),
      listAdminLadderSnapshots({ limit: 40 })
    ]);
    games = catalog.games;
    snapshots = snapshotPage.snapshots;
  } catch {
    loadErrors.push("Ladder controls could not be loaded.");
  }

  const selectedId = params.snapshot_id || snapshots[0]?.id;
  if (selectedId) {
    try {
      const detail = await getAdminLadderSnapshot(selectedId);
      selectedSnapshot = detail.snapshot;
      entries = detail.entries;
    } catch {
      loadErrors.push("The selected ladder could not be loaded.");
    }
  }

  return (
    <AdminShell active="ladders">
      <div className="grid gap-6">
        <AdminPageHeader
          eyebrow="Ladders"
          title="Ladder review and resets"
          description="Refresh daily or weekly ladders, review suspicious player rows, and reset a ladder when public results should pause until review is complete."
          actions={
            <PendingLink className="inline-flex min-h-10 items-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/ladders" pendingLabel="Opening player page...">
              Player view
            </PendingLink>
          }
        />

        {params.error ? <TransientStatusBanner clearKeys={["error"]} durationMs={12000} message={params.error} tone="danger" /> : null}
        {params.success ? <TransientStatusBanner clearKeys={["success"]} durationMs={12000} message={params.success} tone="success" /> : null}
        {loadErrors.map((error) => <TransientStatusBanner key={error} message={error} tone="danger" />)}

        <Panel>
          <PanelHeader eyebrow="Refresh" title="Create current ladder record" description="Refresh saves today or this week exactly as it stands now, then publishes it for player views." />
          <form action={refreshLadderSnapshotAction} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="grid gap-2 text-sm font-black text-ink">
              Period
              <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="period" defaultValue="daily">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black text-ink">
              Game
              <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="game_slug" defaultValue="">
                <option value="">All games</option>
                {gameOptions(games).map((game) => <option key={game.slug} value={game.slug}>{game.name}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black text-ink">
              City
              <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" maxLength={80} name="city" placeholder="Optional city" />
            </label>
            <label className="grid gap-2 text-sm font-black text-ink xl:col-span-2">
              Review note
              <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" maxLength={500} name="note" placeholder="Optional note for admin history" />
            </label>
            <div className="md:col-span-2 xl:col-span-5">
              <FormActionButton idleLabel="Refresh ladder" pendingLabel="Refreshing..." />
            </div>
          </form>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <Panel>
            <PanelHeader eyebrow="History" title="Saved ladder records" description="Published records are available to players. Reset records stay available here for review." />
            {snapshots.length ? (
              <DataTable
                rows={snapshots}
                rowKey={(row) => row.id}
                columns={[
                  { key: "scope", label: "Scope", render: (row) => <PendingLink className="font-black text-ink hover:text-action" href={`/admin/ladders?snapshot_id=${row.id}`} pendingLabel="Opening...">{scopeLabel(row)}</PendingLink> },
                  { key: "period", label: "Period", render: (row) => <Badge tone="cyan">{row.period}</Badge> },
                  { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
                  { key: "entries", label: "Players", render: (row) => <span className="font-mono text-sm font-black text-ink">{row.visible_entry_count}/{row.entry_count}</span> },
                  { key: "generated", label: "Generated", render: (row) => <span className="text-xs font-bold text-muted">{dateLabel(row.generated_at)}</span> }
                ]}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState title="No saved ladders yet" description="Refresh the daily or weekly ladder to create the first saved record." />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Review"
              title={selectedSnapshot ? scopeLabel(selectedSnapshot) : "Select a ladder"}
              description={selectedSnapshot ? `${selectedSnapshot.period} ladder from ${dateLabel(selectedSnapshot.period_start)}.` : "Choose a saved ladder record to review player rows."}
            />
            {selectedSnapshot ? (
              <div className="grid gap-4 p-4">
                <div className="grid gap-3 rounded-md border border-line bg-surfaceHigh p-3 md:grid-cols-4">
                  <div>
                    <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Status</p>
                    <div className="mt-2"><Badge tone={statusTone(selectedSnapshot.status)}>{selectedSnapshot.status}</Badge></div>
                  </div>
                  <div>
                    <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Visible</p>
                    <p className="mt-2 font-mono text-lg font-black text-ink">{selectedSnapshot.visible_entry_count}</p>
                  </div>
                  <div>
                    <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Held</p>
                    <p className="mt-2 font-mono text-lg font-black text-warning">{selectedSnapshot.held_entry_count}</p>
                  </div>
                  <div>
                    <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-dim">Hidden</p>
                    <p className="mt-2 font-mono text-lg font-black text-danger">{selectedSnapshot.hidden_entry_count}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <form action={publishLadderSnapshotAction} className="grid gap-2 rounded-md border border-line bg-white p-3">
                    <input name="snapshot_id" type="hidden" value={selectedSnapshot.id} />
                    <input className="min-h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" maxLength={500} name="note" placeholder="Optional publish note" />
                    <FormActionButton disabled={selectedSnapshot.status === "published"} idleLabel="Publish" pendingLabel="Publishing..." size="sm" />
                  </form>
                  {canReset ? (
                    <form action={resetLadderSnapshotAction} className="grid gap-2 rounded-md border border-line bg-white p-3">
                      <input name="snapshot_id" type="hidden" value={selectedSnapshot.id} />
                      <input className="min-h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" maxLength={500} name="reason" placeholder="Reason for reset" required />
                      <FormActionButton disabled={selectedSnapshot.status === "reset"} idleLabel="Reset ladder" pendingLabel="Resetting..." size="sm" variant="danger" />
                    </form>
                  ) : null}
                </div>

                {entries.length ? (
                  <DataTable
                    rows={entries}
                    rowKey={(row) => row.id}
                    columns={[
                      { key: "rank", label: "Rank", render: (row) => <span className="font-mono text-sm font-black text-ink">#{row.rank}</span> },
                      { key: "player", label: "Player", render: (row) => <div><p className="font-black text-ink">{playerName(row)}</p><p className="text-xs font-bold text-muted">{row.game_name_snapshot} / {row.city_snapshot || row.region_snapshot || "Online"}</p></div> },
                      { key: "score", label: "Score", render: (row) => <span className="font-mono text-sm font-black text-ink">{row.score}</span> },
                      { key: "status", label: "Review", render: (row) => <Badge tone={reviewTone(row.review_status)}>{row.review_status}</Badge> },
                      {
                        key: "actions",
                        label: "Action",
                        render: (row) => (
                          <form action={reviewLadderEntryAction} className="grid gap-2">
                            <input name="snapshot_id" type="hidden" value={selectedSnapshot.id} />
                            <input name="entry_id" type="hidden" value={row.id} />
                            <input className="min-h-9 rounded-md border border-line bg-white px-2 text-xs outline-none focus:border-action" maxLength={500} name="note" placeholder="Review note" />
                            <div className="flex flex-wrap gap-1">
                              <FormActionButton idleLabel="Show" name="decision" pendingLabel="Saving..." size="sm" value="show" variant="secondary" />
                              <FormActionButton idleLabel="Hold" name="decision" pendingLabel="Saving..." size="sm" value="hold" variant="secondary" />
                              <FormActionButton idleLabel="Hide" name="decision" pendingLabel="Saving..." size="sm" value="hide" variant="danger" />
                            </div>
                          </form>
                        )
                      }
                    ]}
                  />
                ) : (
                  <AdminEmptyState title="No players in this ladder" description="There were no approved wins for this period and filter when the ladder was refreshed." />
                )}
              </div>
            ) : (
              <div className="p-4">
                <AdminEmptyState title="No ladder selected" description="Refresh or select a saved ladder to review entries." />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
