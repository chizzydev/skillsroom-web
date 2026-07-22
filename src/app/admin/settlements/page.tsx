import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStepUpPanel } from "@/components/admin/AdminStepUpPanel";
import { AdminShell } from "@/components/layout/AdminShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { Badge } from "@/components/ui/Badge";
import { CopyTextButton } from "@/components/ui/CopyTextButton";
import { DataTable } from "@/components/ui/DataTable";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { adminErrorMessageFromQuery } from "@/lib/admin-action-errors";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import {
  ApiRequestError,
  formatEntryAmount,
  listPayouts,
  listRefunds,
  listSettlements,
  listTournamentPayouts,
  listTournamentRefunds,
  listTournamentSettlements,
  type MatchPayout,
  type MatchRefund,
  type MatchSettlement,
  type TournamentPayout,
  type TournamentRefund,
  type TournamentSettlement
} from "@/lib/match-room-api";
import {
  completePayoutAction,
  completeRefundAction,
  completeTournamentPayoutAction,
  completeTournamentRefundAction,
  reserveRefundsAction,
  reserveSettlementAction,
  updatePayoutInstructionsAction,
  updateRefundInstructionsAction,
  updateTournamentPayoutInstructionsAction,
  updateTournamentRefundInstructionsAction
} from "./actions";
import { AdminSettlementsLiveQueues, type AdminSettlementsSnapshot } from "./AdminSettlementsLiveQueues";

export const dynamic = "force-dynamic";

function money(currency: string, amountMinor: number) {
  return formatEntryAmount({ currency, entry_amount_minor: amountMinor });
}

function loadErrorMessage(label: string, error: unknown) {
  if (error instanceof ApiRequestError) {
    const requestId = error.requestId ? ` Request ID: ${error.requestId}` : "";
    return `${label} could not load. ${error.message}${requestId}`;
  }
  if (error instanceof Error) return `${label} could not load. ${error.message}`;
  return `${label} could not load.`;
}

function playerLabel(row: {
  display_name?: string | null;
  username?: string | null;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
  user_id: string;
}) {
  return row.display_name || row.username || row.primary_game_handle || row.primary_game_external_uid || row.user_id;
}

function winnerLabel(row: MatchSettlement) {
  return row.winner_display_name || row.winner_username || row.winner_primary_game_handle || row.winner_primary_game_external_uid || row.winner_user_id;
}

function tournamentWinnerLabel(row: TournamentPayout) {
  return row.entry_display_name || row.display_name || row.username || row.primary_game_handle || row.primary_game_external_uid || row.user_id;
}

function tournamentRefundLabel(row: TournamentRefund) {
  return row.entry_display_name || row.display_name || row.username || row.primary_game_handle || row.primary_game_external_uid || row.user_id;
}

function TournamentIdLabel({ tournamentId }: { tournamentId?: string | null }) {
  if (!tournamentId) return null;
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[11px] font-black uppercase tracking-[0.12em] text-dim">Tournament ID</span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-muted [overflow-wrap:anywhere]">{tournamentId}</span>
        <CopyTextButton label="tournament ID" value={tournamentId} />
      </div>
    </div>
  );
}

function RoomCodeLabel({ roomCode }: { roomCode?: string | null }) {
  if (!roomCode) return null;
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[11px] font-black uppercase tracking-[0.12em] text-dim">Room code</span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-muted">{roomCode}</span>
        <CopyTextButton label="room code" value={roomCode} />
      </div>
    </div>
  );
}

function MatchRoomIdLabel({ matchRoomId }: { matchRoomId?: string | null }) {
  if (!matchRoomId) return null;
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[11px] font-black uppercase tracking-[0.12em] text-dim">Match room ID</span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-muted [overflow-wrap:anywhere]">{matchRoomId}</span>
        <CopyTextButton label="match room ID" value={matchRoomId} />
      </div>
    </div>
  );
}

function IdentifierLabel({
  label,
  value
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[11px] font-black uppercase tracking-[0.12em] text-dim">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-muted [overflow-wrap:anywhere]">{value}</span>
        <CopyTextButton label={label} value={value} />
      </div>
    </div>
  );
}

export default async function AdminSettlementsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/settlements");
  if (!canUseAdminSection(user, "settlements")) redirect("/admin");
  const { error, success } = await searchParams;

  let settlements: MatchSettlement[] = [];
  let payouts: MatchPayout[] = [];
  let refunds: MatchRefund[] = [];
  let tournamentSettlements: TournamentSettlement[] = [];
  let tournamentPayouts: TournamentPayout[] = [];
  let tournamentRefunds: TournamentRefund[] = [];
  const loadErrors: string[] = [];
  const [settlementResult, payoutResult, refundResult, tournamentSettlementResult, tournamentPayoutResult, tournamentRefundResult] = await Promise.allSettled([
    listSettlements(),
    listPayouts(),
    listRefunds(),
    listTournamentSettlements(),
    listTournamentPayouts(),
    listTournamentRefunds()
  ]);

  if (settlementResult.status === "fulfilled") {
    settlements = settlementResult.value.settlements;
  } else {
    loadErrors.push(loadErrorMessage("Settlement history", settlementResult.reason));
  }

  if (payoutResult.status === "fulfilled") {
    payouts = payoutResult.value.payouts;
  } else {
    loadErrors.push(loadErrorMessage("Payout queue", payoutResult.reason));
  }

  if (refundResult.status === "fulfilled") {
    refunds = refundResult.value.refunds;
  } else {
    loadErrors.push(loadErrorMessage("Refund queue", refundResult.reason));
  }

  if (tournamentSettlementResult.status === "fulfilled") {
    tournamentSettlements = tournamentSettlementResult.value.settlements;
  } else {
    loadErrors.push(loadErrorMessage("Tournament settlement history", tournamentSettlementResult.reason));
  }

  if (tournamentPayoutResult.status === "fulfilled") {
    tournamentPayouts = tournamentPayoutResult.value.payouts;
  } else {
    loadErrors.push(loadErrorMessage("Tournament payout queue", tournamentPayoutResult.reason));
  }

  if (tournamentRefundResult.status === "fulfilled") {
    tournamentRefunds = tournamentRefundResult.value.refunds;
  } else {
    loadErrors.push(loadErrorMessage("Tournament refund queue", tournamentRefundResult.reason));
  }

  const queuedSettlements = settlements.filter((row) => row.status === "payout_pending");
  const completedSettlements = settlements.filter((row) => row.status === "completed").slice(0, 12);
  const queuedPayouts = payouts.filter((row) => row.status === "queued");
  const completedPayouts = payouts.filter((row) => row.status === "completed").slice(0, 12);
  const queuedRefunds = refunds.filter((row) => row.status === "queued");
  const completedRefunds = refunds.filter((row) => row.status === "completed").slice(0, 12);
  const queuedTournamentSettlements = tournamentSettlements.filter((row) => row.status === "payout_pending");
  const completedTournamentSettlements = tournamentSettlements.filter((row) => row.status === "completed").slice(0, 12);
  const queuedTournamentPayouts = tournamentPayouts.filter((row) => row.status === "queued");
  const completedTournamentPayouts = tournamentPayouts.filter((row) => row.status === "completed").slice(0, 12);
  const queuedTournamentRefunds = tournamentRefunds.filter((row) => row.status === "queued");
  const completedTournamentRefunds = tournamentRefunds.filter((row) => row.status === "completed").slice(0, 12);
  const settlementsSnapshot: AdminSettlementsSnapshot = {
    settlements,
    payouts,
    refunds,
    tournament_settlements: tournamentSettlements,
    tournament_payouts: tournamentPayouts,
    tournament_refunds: tournamentRefunds,
    loaded_at: new Date().toISOString()
  };

  return (
    <AdminShell active="settlements">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Reserve commissions, queue winner payouts, complete manual bank transfers, and refund voided or disputed rooms."
          eyebrow="Payments"
          title="Payouts and Refunds"
          tone="success"
        />

        <LiveUpdateStream eventTypePrefixes={["admin.queue.settlements.", "admin.queue.refunds.", "admin.queue.tournament_settlements.", "admin.queue.tournament_refunds.", "match.settlement.", "match.payout.", "match.refund.", "tournament.settlement.", "tournament.payout.", "tournament.refund.", "tournament.refunds."]} label="Payment updates" />

        {error ? <TransientStatusBanner clearKeys={["error"]} durationMs={12000} message={adminErrorMessageFromQuery(error)} /> : null}
        {success ? <TransientStatusBanner clearKeys={["success"]} durationMs={12000} message={success} tone="success" /> : null}
        {loadErrors.length ? (
          <div className="grid gap-2 rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {loadErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}

        <AdminSettlementsLiveQueues initialSnapshot={settlementsSnapshot} />

        <div className="hidden min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPanel detail="Match + tournament" label="Settlements" tone="success" value={(queuedSettlements.length + queuedTournamentSettlements.length).toString()} />
          <StatusPanel detail="Manual transfer" label="Payout Queue" tone="warning" value={(queuedPayouts.length + queuedTournamentPayouts.length).toString()} />
          <StatusPanel detail="Manual return" label="Refund Queue" tone="danger" value={(queuedRefunds.length + queuedTournamentRefunds.length).toString()} />
          <StatusPanel detail="Step-up required" label="Money Actions" tone="cyan" value={(queuedPayouts.length + queuedRefunds.length + queuedTournamentPayouts.length + queuedTournamentRefunds.length).toString()} />
        </div>

        <AdminStepUpPanel returnTo="/admin/settlements" />

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Payouts" title="Queued winner payouts" description="Complete only after the bank transfer has actually been sent." />
            {queuedPayouts.length ? (
              <DataTable
                columns={[
                  { key: "created_at", label: "Queued", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                  {
                    key: "winner",
                    label: "Winner",
                    render: (row) => (
                      <div className="grid gap-1">
                        <span className="font-bold text-ink">{playerLabel(row)}</span>
                        <RoomCodeLabel roomCode={row.room_code} />
                        <MatchRoomIdLabel matchRoomId={row.match_room_id} />
                      </div>
                    )
                  },
                  { key: "room_title", label: "Room", render: (row) => <span className="text-muted">{row.room_title || "Match room"}</span> },
                  { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.amount_minor)}</span> },
                  {
                    key: "instructions",
                    label: "Instructions",
                    render: (row) => (
                      <div className="grid gap-1 text-xs text-muted">
                        <span className="font-bold text-ink">{row.recipient_name || "Instructions missing"}</span>
                        <span>{row.bank_name || "Bank not set"}</span>
                        <span className="font-mono">{row.account_number || row.account_number_masked || "No account number"}</span>
                      </div>
                    )
                  },
                  { key: "status", label: "Status", render: (row) => <Badge tone={row.instruction_status === "ready" ? "warning" : "danger"}>{row.instruction_status === "ready" ? row.status : "needs instructions"}</Badge> },
                  { key: "id", label: "Payout ID", render: (row) => <IdentifierLabel label="Payout ID" value={row.id} /> }
                ]}
                rows={queuedPayouts}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState description="No winner payout is waiting for manual transfer confirmation." title="Payout queue is clear" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Complete Payout" title="Manual payout confirmation" />
            <form action={completePayoutAction} className="grid gap-3 p-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Match room ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="match_room_id" required />
                <span className="text-xs leading-5 text-muted">Use the Match room ID shown on the payout row. Room code is a separate player-facing identifier.</span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="payout_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Transfer proof screenshot or video
                <input
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                  className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-surfaceHigh file:px-3 file:py-2 file:text-xs file:font-black file:text-ink focus:border-action"
                  name="completion_proof_file"
                  type="file"
                />
                <span className="text-xs leading-5 text-muted">Upload the payout slip screenshot or short transfer proof video. Images up to 8MB. Videos up to 80MB.</span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Transfer proof link <span className="font-bold text-muted">(optional fallback)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="completion_proof_url" type="url" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank payout reference <span className="font-bold text-muted">(optional)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="payout_reference" />
              </label>
              <FormActionButton idleLabel="Complete payout" pendingLabel="Completing payout..." />
            </form>
            <div className="border-t border-line px-4 pb-4 pt-2">
              <PanelHeader
                eyebrow="Repair"
                title="Fix payout instructions"
                description="Use fallback to copy the latest approved funding instructions or current payout profile, or save corrected bank details directly onto this queued payout."
              />
            </div>
            <form action={updatePayoutInstructionsAction} className="grid gap-3 px-4 pb-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="payout_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Recipient name
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="recipient_name" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank name
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="bank_name" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Account number
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="account_number" inputMode="numeric" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank code <span className="font-bold text-muted">(optional)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="bank_code" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Team note <span className="font-bold text-muted">(optional)</span>
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="payout_note" />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <FormActionButton idleLabel="Apply funding/profile fallback" pendingLabel="Applying fallback..." name="use_fallback" value="true" variant="secondary" />
                <FormActionButton idleLabel="Save payout instructions" pendingLabel="Saving instructions..." />
              </div>
            </form>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Refunds" title="Queued refunds" description="Refunds return approved entry funding when a room should not settle to a winner." />
            {queuedRefunds.length ? (
              <DataTable
                columns={[
                  { key: "created_at", label: "Queued", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                  {
                    key: "user_id",
                    label: "Player",
                    render: (row) => (
                      <div className="grid gap-1">
                        <span className="font-bold text-ink">{playerLabel(row)}</span>
                        <RoomCodeLabel roomCode={row.room_code} />
                        <MatchRoomIdLabel matchRoomId={row.match_room_id} />
                      </div>
                    )
                  },
                  { key: "room_title", label: "Room", render: (row) => <span className="text-muted">{row.room_title || "Match room"}</span> },
                  { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.amount_minor)}</span> },
                  {
                    key: "instructions",
                    label: "Instructions",
                    render: (row) => (
                      <div className="grid gap-1 text-xs text-muted">
                        <span className="font-bold text-ink">{row.recipient_name || "Instructions missing"}</span>
                        <span>{row.bank_name || "Bank not set"}</span>
                        <span className="font-mono">{row.account_number || row.account_number_masked || "No account number"}</span>
                      </div>
                    )
                  },
                  { key: "reason", label: "Reason", render: (row) => <span className="text-muted">{row.reason}</span> },
                  { key: "id", label: "Refund ID", render: (row) => <IdentifierLabel label="Refund ID" value={row.id} /> }
                ]}
                rows={queuedRefunds}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState description="No player refund is waiting for manual return confirmation." title="Refund queue is clear" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Complete Refund" title="Manual refund confirmation" />
            <form action={completeRefundAction} className="grid gap-3 p-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Match room ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="match_room_id" required />
                <span className="text-xs leading-5 text-muted">Use the Match room ID shown on the refund row. Room code is a separate player-facing identifier.</span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Refund ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="refund_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Transfer proof screenshot or video
                <input
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                  className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-surfaceHigh file:px-3 file:py-2 file:text-xs file:font-black file:text-ink focus:border-action"
                  name="completion_proof_file"
                  type="file"
                />
                <span className="text-xs leading-5 text-muted">Upload the refund slip screenshot or short transfer proof video. Images up to 8MB. Videos up to 80MB.</span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Transfer proof link <span className="font-bold text-muted">(optional fallback)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="completion_proof_url" type="url" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank refund reference <span className="font-bold text-muted">(optional)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="refund_reference" />
              </label>
              <FormActionButton idleLabel="Complete refund" pendingLabel="Completing refund..." variant="secondary" />
            </form>
            <div className="border-t border-line px-4 pb-4 pt-2">
              <PanelHeader
                eyebrow="Repair"
                title="Fix refund instructions"
                description="Repair a queued refund from the latest approved funding instructions or save corrected bank details directly onto the refund record."
              />
            </div>
            <form action={updateRefundInstructionsAction} className="grid gap-3 px-4 pb-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Refund ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="refund_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Recipient name
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="recipient_name" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank name
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="bank_name" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Account number
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="account_number" inputMode="numeric" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank code <span className="font-bold text-muted">(optional)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="bank_code" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Team note <span className="font-bold text-muted">(optional)</span>
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="payout_note" />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <FormActionButton idleLabel="Apply funding/profile fallback" pendingLabel="Applying fallback..." name="use_fallback" value="true" variant="secondary" />
                <FormActionButton idleLabel="Save refund instructions" pendingLabel="Saving instructions..." />
              </div>
            </form>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Tournament Payouts" title="Queued tournament winner payouts" description="Tournament prize rows now use the same long-term settlement discipline as one-on-one matches." />
            {queuedTournamentPayouts.length ? (
              <DataTable
                columns={[
                  { key: "created_at", label: "Queued", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                  {
                    key: "winner",
                    label: "Winner",
                    render: (row) => (
                      <div className="grid gap-1">
                        <span className="font-bold text-ink">{tournamentWinnerLabel(row)}</span>
                        <TournamentIdLabel tournamentId={row.tournament_id} />
                        <IdentifierLabel label="Entry ID" value={row.entry_id} />
                      </div>
                    )
                  },
                  { key: "tournament_title", label: "Tournament", render: (row) => <span className="text-muted">{row.tournament_title || "Tournament"}</span> },
                  { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.amount_minor)}</span> },
                  {
                    key: "instructions",
                    label: "Instructions",
                    render: (row) => (
                      <div className="grid gap-1 text-xs text-muted">
                        <span className="font-bold text-ink">{row.recipient_name || "Instructions missing"}</span>
                        <span>{row.bank_name || "Bank not set"}</span>
                        <span className="font-mono">{row.account_number || row.account_number_masked || "No account number"}</span>
                      </div>
                    )
                  },
                  { key: "status", label: "Status", render: (row) => <Badge tone={row.instruction_status === "ready" ? "warning" : "danger"}>{row.instruction_status === "ready" ? row.status : "needs instructions"}</Badge> },
                  { key: "id", label: "Payout ID", render: (row) => <IdentifierLabel label="Payout ID" value={row.id} /> }
                ]}
                rows={queuedTournamentPayouts}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState description="No tournament payout is waiting for manual transfer confirmation." title="Tournament payout queue is clear" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Complete Tournament Payout" title="Manual tournament payout confirmation" />
            <form action={completeTournamentPayoutAction} className="grid gap-3 p-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Tournament ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="tournament_id" required />
                <span className="text-xs leading-5 text-muted">Use the Tournament ID shown on the payout row so the proof record stays tied to the correct event.</span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="payout_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Transfer proof screenshot or video
                <input
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                  className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-surfaceHigh file:px-3 file:py-2 file:text-xs file:font-black file:text-ink focus:border-action"
                  name="completion_proof_file"
                  type="file"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Transfer proof link <span className="font-bold text-muted">(optional fallback)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="completion_proof_url" type="url" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank payout reference <span className="font-bold text-muted">(optional)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="payout_reference" />
              </label>
              <FormActionButton idleLabel="Complete tournament payout" pendingLabel="Completing tournament payout..." />
            </form>
            <div className="border-t border-line px-4 pb-4 pt-2">
              <PanelHeader eyebrow="Repair" title="Fix tournament payout instructions" description="Apply contribution/profile fallback or save corrected payout instructions directly on the queued tournament payout." />
            </div>
            <form action={updateTournamentPayoutInstructionsAction} className="grid gap-3 px-4 pb-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Payout ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="payout_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Recipient name
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="recipient_name" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank name
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="bank_name" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Account number
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="account_number" inputMode="numeric" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank code <span className="font-bold text-muted">(optional)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="bank_code" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Team note <span className="font-bold text-muted">(optional)</span>
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="payout_note" />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <FormActionButton idleLabel="Apply contribution/profile fallback" pendingLabel="Applying fallback..." name="use_fallback" value="true" variant="secondary" />
                <FormActionButton idleLabel="Save tournament instructions" pendingLabel="Saving instructions..." />
              </div>
            </form>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Tournament Refunds" title="Queued tournament refunds" description="Refund tournament contributions with clear proof and review history." />
            {queuedTournamentRefunds.length ? (
              <DataTable
                columns={[
                  { key: "created_at", label: "Queued", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.created_at).toLocaleString("en-NG")}</span> },
                  {
                    key: "user_id",
                    label: "Recipient",
                    render: (row) => (
                      <div className="grid gap-1">
                        <span className="font-bold text-ink">{tournamentRefundLabel(row)}</span>
                        <TournamentIdLabel tournamentId={row.tournament_id} />
                        <IdentifierLabel label="Entry ID" value={row.entry_id} />
                      </div>
                    )
                  },
                  { key: "tournament_title", label: "Tournament", render: (row) => <span className="text-muted">{row.tournament_title || "Tournament"}</span> },
                  { key: "amount_minor", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.amount_minor)}</span> },
                  {
                    key: "instructions",
                    label: "Instructions",
                    render: (row) => (
                      <div className="grid gap-1 text-xs text-muted">
                        <span className="font-bold text-ink">{row.recipient_name || "Instructions missing"}</span>
                        <span>{row.bank_name || "Bank not set"}</span>
                        <span className="font-mono">{row.account_number || row.account_number_masked || "No account number"}</span>
                      </div>
                    )
                  },
                  { key: "reason", label: "Reason", render: (row) => <span className="text-muted">{row.reason}</span> },
                  { key: "id", label: "Refund ID", render: (row) => <IdentifierLabel label="Refund ID" value={row.id} /> }
                ]}
                rows={queuedTournamentRefunds}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState description="No tournament refund is waiting for manual return confirmation." title="Tournament refund queue is clear" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Complete Tournament Refund" title="Manual tournament refund confirmation" />
            <form action={completeTournamentRefundAction} className="grid gap-3 p-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Tournament ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="tournament_id" required />
                <span className="text-xs leading-5 text-muted">Use the Tournament ID shown on the refund row so the proof record stays tied to the correct event.</span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Refund ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="refund_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Transfer proof screenshot or video
                <input
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                  className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-surfaceHigh file:px-3 file:py-2 file:text-xs file:font-black file:text-ink focus:border-action"
                  name="completion_proof_file"
                  type="file"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Transfer proof link <span className="font-bold text-muted">(optional fallback)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="completion_proof_url" type="url" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank refund reference <span className="font-bold text-muted">(optional)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="refund_reference" />
              </label>
              <FormActionButton idleLabel="Complete tournament refund" pendingLabel="Completing tournament refund..." variant="secondary" />
            </form>
            <div className="border-t border-line px-4 pb-4 pt-2">
              <PanelHeader eyebrow="Repair" title="Fix tournament refund instructions" description="Apply contribution/profile fallback or save corrected refund instructions directly on the queued refund row." />
            </div>
            <form action={updateTournamentRefundInstructionsAction} className="grid gap-3 px-4 pb-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Refund ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="refund_id" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Recipient name
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="recipient_name" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank name
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="bank_name" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Account number
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="account_number" inputMode="numeric" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Bank code <span className="font-bold text-muted">(optional)</span>
                <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="bank_code" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Team note <span className="font-bold text-muted">(optional)</span>
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="payout_note" />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <FormActionButton idleLabel="Apply contribution/profile fallback" pendingLabel="Applying fallback..." name="use_fallback" value="true" variant="secondary" />
                <FormActionButton idleLabel="Save tournament refund instructions" pendingLabel="Saving instructions..." />
              </div>
            </form>
          </Panel>
        </div>

        <Panel>
          <PanelHeader eyebrow="Reserve" title="Create payout or refund queues" description="Approved room results now auto-queue payouts. Use manual reserve only for recovery or backfill cases." />
          <div className="grid gap-6 p-4 xl:grid-cols-2">
            <form action={reserveSettlementAction} className="grid gap-3">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Match room ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="match_room_id" required />
                <span className="text-xs leading-5 text-muted">Use the Match room ID for settlement reservation. Room code is separate and player-facing.</span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Notes
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="notes" />
              </label>
              <FormActionButton idleLabel="Reserve settlement" pendingLabel="Reserving settlement..." />
            </form>

            <form action={reserveRefundsAction} className="grid gap-3">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Match room ID
                <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="match_room_id" required />
                <span className="text-xs leading-5 text-muted">Use the Match room ID for refund reservation. Room code is separate and player-facing.</span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Refund reason
                <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="reason" required />
              </label>
              <FormActionButton idleLabel="Reserve refunds" pendingLabel="Reserving refunds..." variant="danger" />
            </form>
          </div>
        </Panel>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="History" title="Recent settlements" description="Completed and pending payment records stay visible for review." />
            {settlements.length ? (
              <DataTable
                columns={[
                  { key: "reserved_at", label: "Reserved", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.reserved_at).toLocaleString("en-NG")}</span> },
                  {
                    key: "winner",
                    label: "Winner",
                    render: (row) => (
                      <div className="grid gap-1">
                        <span className="font-bold text-ink">{winnerLabel(row)}</span>
                        <RoomCodeLabel roomCode={row.room_code} />
                        <MatchRoomIdLabel matchRoomId={row.match_room_id} />
                      </div>
                    )
                  },
                  { key: "room_title", label: "Room", render: (row) => <span className="text-muted">{row.room_title || "Match room"}</span> },
                  { key: "payout_minor", label: "Payout", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.payout_minor)}</span> },
                  { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "completed" ? "success" : "warning"}>{row.status}</Badge> }
                ]}
                rows={[...queuedSettlements, ...completedSettlements]}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState description="Approved results will appear here as soon as they reserve into payout workflow." title="No settlement records yet" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Completed" title="Recent manual closes" />
            <div className="grid gap-4 p-4">
              <div className="rounded-md border border-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Completed payouts</p>
                <p className="mt-2 text-2xl font-black text-ink">{completedPayouts.length + completedTournamentPayouts.length}</p>
              </div>
              <div className="rounded-md border border-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Completed refunds</p>
                <p className="mt-2 text-2xl font-black text-ink">{completedRefunds.length + completedTournamentRefunds.length}</p>
              </div>
              <div className="rounded-md border border-line bg-surfaceWarm p-4 text-sm leading-6 text-muted">
                Match and tournament payout rows keep the recipient details saved at queue time, even if players update their profile later.
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader eyebrow="Tournament History" title="Recent tournament payments" description="Tournament payment records stay visible for payout checks and refund review." />
            {tournamentSettlements.length ? (
              <DataTable
                columns={[
                  { key: "reserved_at", label: "Reserved", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.reserved_at).toLocaleString("en-NG")}</span> },
                  {
                    key: "tournament_id",
                    label: "Tournament",
                    render: (row) => (
                      <div className="grid gap-1">
                        <span className="font-bold text-ink">{String(row.metadata?.tournament_title ?? "Tournament settlement")}</span>
                        <TournamentIdLabel tournamentId={row.tournament_id} />
                      </div>
                    )
                  },
                  { key: "payout_pool_minor", label: "Payout pool", render: (row) => <span className="font-mono font-bold text-ink">{money(row.currency, row.payout_pool_minor)}</span> },
                  { key: "commission_minor", label: "Commission", render: (row) => <span className="font-mono text-sm font-bold text-muted">{money(row.currency, row.commission_minor)}</span> },
                  { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "completed" ? "success" : "warning"}>{row.status}</Badge> }
                ]}
                rows={[...queuedTournamentSettlements, ...completedTournamentSettlements]}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState description="Approved tournament results will appear here as soon as they reserve into payout workflow." title="No tournament settlement records yet" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Tournament Closes" title="Recent tournament money closes" />
            <div className="grid gap-4 p-4">
              <div className="rounded-md border border-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Completed tournament payouts</p>
                <p className="mt-2 text-2xl font-black text-ink">{completedTournamentPayouts.length}</p>
              </div>
              <div className="rounded-md border border-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Completed tournament refunds</p>
                <p className="mt-2 text-2xl font-black text-ink">{completedTournamentRefunds.length}</p>
              </div>
              <div className="rounded-md border border-line bg-surfaceWarm p-4 text-sm leading-6 text-muted">
                Older tournament rows can be repaired here. New tournament entries now save payout details up front.
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </AdminShell>
  );
}
