import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminShell } from "@/components/layout/AdminShell";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import {
  formatEntryAmount,
  getAdminWalletDashboard,
  listFundingSubmissions,
  listPayouts,
  listRefunds,
  listTournamentPayouts,
  listTournamentRefunds,
  listWalletPayoutRequests,
  listWalletTopups,
  type ManualFundingSubmission,
  type MatchPayout,
  type MatchRefund,
  type SuspiciousWalletTopupGroup,
  type TournamentPayout,
  type TournamentRefund,
  type WalletPayoutRequest,
  type WalletTopup
} from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

type PaymentQueueItem = {
  id: string;
  kind: string;
  playerId: string;
  amount: string;
  status: string;
  check: string;
  href: string;
  createdAt: string;
  tone: BadgeTone;
};

type LocalDuplicateGroup = {
  duplicate_type: "transfer_reference" | "proof_url";
  group_key: string;
  occurrence_count: number;
  user_count: number;
  amount_minor_total: number;
  first_seen_at: string;
  last_seen_at: string;
  sample_ids: string[];
};

type BankMatchRow = {
  id: string;
  kind: string;
  playerId: string;
  amount: string;
  reference: string;
  sender: string;
  bank: string;
  status: "Ready to check" | "Needs reference" | "Needs sender details";
  submittedAt: string;
};

type AuditRow = {
  id: string;
  action: string;
  actor: string;
  status: string;
  amount: string;
  reference: string;
  happenedAt: string;
};

function money(currency: string, amountMinor: number) {
  return formatEntryAmount({ currency, entry_amount_minor: amountMinor });
}

function statusTone(status: string): BadgeTone {
  if (["approved", "paid", "completed"].includes(status)) return "success";
  if (["rejected", "failed", "cancelled"].includes(status)) return "danger";
  if (["submitted", "requested", "queued"].includes(status)) return "warning";
  return "neutral";
}

function queueFromTopup(row: WalletTopup): PaymentQueueItem {
  return {
    id: row.id,
    kind: "Wallet top-up",
    playerId: row.user_id,
    amount: money(row.currency, row.amount_minor),
    status: row.status,
    check: row.transfer_reference ? "Match bank reference" : "Ask for bank reference",
    href: "/admin/wallet",
    createdAt: row.submitted_at,
    tone: "warning"
  };
}

function queueFromFunding(row: ManualFundingSubmission): PaymentQueueItem {
  return {
    id: row.id,
    kind: "Room entry payment",
    playerId: row.user_id,
    amount: money(row.currency, row.amount_minor),
    status: row.status,
    check: "Match room, amount, player, and proof",
    href: "/admin/funding",
    createdAt: row.submitted_at,
    tone: "warning"
  };
}

function queueFromWalletPayout(row: WalletPayoutRequest): PaymentQueueItem {
  return {
    id: row.id,
    kind: "Wallet payout",
    playerId: row.user_id,
    amount: money(row.currency, row.amount_minor),
    status: row.status,
    check: "Send bank payment, then mark paid",
    href: "/admin/wallet",
    createdAt: row.requested_at,
    tone: "danger"
  };
}

function queueFromPayout(row: MatchPayout | TournamentPayout, kind: string): PaymentQueueItem {
  return {
    id: row.id,
    kind,
    playerId: row.user_id,
    amount: money(row.currency, row.amount_minor),
    status: row.status,
    check: row.instruction_status === "ready" ? "Send winner payout" : "Fix payout details first",
    href: "/admin/settlements",
    createdAt: row.created_at,
    tone: row.instruction_status === "ready" ? "success" : "danger"
  };
}

function queueFromRefund(row: MatchRefund | TournamentRefund, kind: string): PaymentQueueItem {
  return {
    id: row.id,
    kind,
    playerId: row.user_id,
    amount: money(row.currency, row.amount_minor),
    status: row.status,
    check: row.instruction_status === "ready" ? "Return player funds" : "Fix refund details first",
    href: "/admin/settlements",
    createdAt: row.created_at,
    tone: row.instruction_status === "ready" ? "success" : "danger"
  };
}

function bankMatchFromTopup(row: WalletTopup): BankMatchRow {
  const hasReference = Boolean(row.transfer_reference?.trim());
  const hasSender = Boolean(row.sender_account_name?.trim() || row.sender_bank_name?.trim());
  return {
    id: row.id,
    kind: "Wallet top-up",
    playerId: row.user_id,
    amount: money(row.currency, row.amount_minor),
    reference: row.transfer_reference || "Not provided",
    sender: row.sender_account_name || "Not provided",
    bank: row.sender_bank_name || "Not provided",
    status: hasReference && hasSender ? "Ready to check" : hasReference ? "Needs sender details" : "Needs reference",
    submittedAt: row.submitted_at
  };
}

function bankMatchFromFunding(row: ManualFundingSubmission): BankMatchRow {
  const hasReference = Boolean(row.transfer_reference?.trim());
  const hasSender = Boolean(row.sender_account_name?.trim() || row.sender_bank_name?.trim());
  return {
    id: row.id,
    kind: "Room entry payment",
    playerId: row.user_id,
    amount: money(row.currency, row.amount_minor),
    reference: row.transfer_reference || "Not provided",
    sender: row.sender_account_name || "Not provided",
    bank: row.sender_bank_name || "Not provided",
    status: hasReference && hasSender ? "Ready to check" : hasReference ? "Needs sender details" : "Needs reference",
    submittedAt: row.submitted_at
  };
}

function collectLocalDuplicates(rows: Array<WalletTopup | ManualFundingSubmission>): LocalDuplicateGroup[] {
  const groups = new Map<string, Array<WalletTopup | ManualFundingSubmission>>();

  for (const row of rows) {
    const reference = row.transfer_reference?.trim().toLowerCase();
    const proofUrl = row.proof_url?.trim().toLowerCase();
    if (reference) {
      const key = `transfer_reference:${reference}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    if (proofUrl) {
      const key = `proof_url:${proofUrl}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
  }

  return [...groups.entries()]
    .filter(([, groupedRows]) => groupedRows.length > 1)
    .map(([key, groupedRows]) => {
      const separatorIndex = key.indexOf(":");
      const duplicateType = key.slice(0, separatorIndex) as "transfer_reference" | "proof_url";
      const groupKey = key.slice(separatorIndex + 1);
      const dates = groupedRows.map((row) => row.submitted_at).sort();
      return {
        duplicate_type: duplicateType,
        group_key: groupKey,
        occurrence_count: groupedRows.length,
        user_count: new Set(groupedRows.map((row) => row.user_id)).size,
        amount_minor_total: groupedRows.reduce((sum, row) => sum + row.amount_minor, 0),
        first_seen_at: dates[0] ?? new Date(0).toISOString(),
        last_seen_at: dates[dates.length - 1] ?? new Date(0).toISOString(),
        sample_ids: groupedRows.slice(0, 6).map((row) => row.id)
      };
    });
}

function auditTopup(row: WalletTopup): AuditRow {
  return {
    id: row.id,
    action: "Wallet top-up review",
    actor: row.reviewed_by_user_id ?? "Not recorded",
    status: row.status,
    amount: money(row.currency, row.amount_minor),
    reference: row.transfer_reference || "No reference",
    happenedAt: row.reviewed_at ?? row.updated_at
  };
}

function auditFunding(row: ManualFundingSubmission): AuditRow {
  return {
    id: row.id,
    action: "Room payment review",
    actor: row.reviewed_by_user_id ?? "Not recorded",
    status: row.status,
    amount: money(row.currency, row.amount_minor),
    reference: row.transfer_reference || "No reference",
    happenedAt: row.reviewed_at ?? row.submitted_at
  };
}

function auditWalletPayout(row: WalletPayoutRequest): AuditRow {
  return {
    id: row.id,
    action: "Wallet payout review",
    actor: row.reviewed_by_user_id ?? "Not recorded",
    status: row.status,
    amount: money(row.currency, row.amount_minor),
    reference: row.payment_reference || "No reference",
    happenedAt: row.reviewed_at ?? row.paid_at ?? row.updated_at
  };
}

function auditPayout(row: MatchPayout | TournamentPayout, action: string): AuditRow {
  return {
    id: row.id,
    action,
    actor: row.completed_by_user_id ?? "Not recorded",
    status: row.status,
    amount: money(row.currency, row.amount_minor),
    reference: row.payout_reference || "No reference",
    happenedAt: row.completed_at ?? row.updated_at
  };
}

function auditRefund(row: MatchRefund | TournamentRefund, action: string): AuditRow {
  return {
    id: row.id,
    action,
    actor: row.completed_by_user_id ?? "Not recorded",
    status: row.status,
    amount: money(row.currency, row.amount_minor),
    reference: row.refund_reference || "No reference",
    happenedAt: row.completed_at ?? row.updated_at
  };
}

function duplicateTitle(row: SuspiciousWalletTopupGroup | LocalDuplicateGroup) {
  return row.duplicate_type === "proof_url" ? "Same proof file" : "Same bank reference";
}

export default async function AdminPaymentReadinessPage() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/payment-readiness");
  if (!canUseAdminSection(user, "paymentReadiness")) redirect("/admin");

  const loadErrors: string[] = [];
  const [
    submittedFundingResult,
    approvedFundingResult,
    rejectedFundingResult,
    submittedTopupResult,
    approvedTopupResult,
    rejectedTopupResult,
    walletPayoutResult,
    paidWalletPayoutResult,
    rejectedWalletPayoutResult,
    matchPayoutResult,
    completedMatchPayoutResult,
    failedMatchPayoutResult,
    matchRefundResult,
    completedMatchRefundResult,
    failedMatchRefundResult,
    tournamentPayoutResult,
    completedTournamentPayoutResult,
    failedTournamentPayoutResult,
    tournamentRefundResult,
    completedTournamentRefundResult,
    failedTournamentRefundResult,
    walletDashboardResult
  ] = await Promise.allSettled([
    listFundingSubmissions("submitted"),
    listFundingSubmissions("approved"),
    listFundingSubmissions("rejected"),
    listWalletTopups("submitted"),
    listWalletTopups("approved"),
    listWalletTopups("rejected"),
    listWalletPayoutRequests("requested"),
    listWalletPayoutRequests("paid"),
    listWalletPayoutRequests("rejected"),
    listPayouts("queued"),
    listPayouts("completed"),
    listPayouts("failed"),
    listRefunds("queued"),
    listRefunds("completed"),
    listRefunds("failed"),
    listTournamentPayouts("queued"),
    listTournamentPayouts("completed"),
    listTournamentPayouts("failed"),
    listTournamentRefunds("queued"),
    listTournamentRefunds("completed"),
    listTournamentRefunds("failed"),
    getAdminWalletDashboard({ limit: 100 })
  ]);

  function valueOrEmpty<T>(result: PromiseSettledResult<T>, label: string, fallback: T): T {
    if (result.status === "fulfilled") return result.value;
    loadErrors.push(`${label} could not be loaded.`);
    return fallback;
  }

  const submittedFunding = valueOrEmpty(submittedFundingResult, "Room payment queue", { submissions: [] }).submissions;
  const approvedFunding = valueOrEmpty(approvedFundingResult, "Approved room payments", { submissions: [] }).submissions;
  const rejectedFunding = valueOrEmpty(rejectedFundingResult, "Rejected room payments", { submissions: [] }).submissions;
  const submittedTopups = valueOrEmpty(submittedTopupResult, "Wallet top-up queue", { topups: [] }).topups;
  const approvedTopups = valueOrEmpty(approvedTopupResult, "Approved wallet top-ups", { topups: [] }).topups;
  const rejectedTopups = valueOrEmpty(rejectedTopupResult, "Rejected wallet top-ups", { topups: [] }).topups;
  const walletPayouts = valueOrEmpty(walletPayoutResult, "Wallet payout queue", { payout_requests: [] }).payout_requests;
  const paidWalletPayouts = valueOrEmpty(paidWalletPayoutResult, "Paid wallet payouts", { payout_requests: [] }).payout_requests;
  const rejectedWalletPayouts = valueOrEmpty(rejectedWalletPayoutResult, "Rejected wallet payouts", { payout_requests: [] }).payout_requests;
  const matchPayouts = valueOrEmpty(matchPayoutResult, "Match payout queue", { payouts: [] }).payouts;
  const completedMatchPayouts = valueOrEmpty(completedMatchPayoutResult, "Completed match payouts", { payouts: [] }).payouts;
  const failedMatchPayouts = valueOrEmpty(failedMatchPayoutResult, "Failed match payouts", { payouts: [] }).payouts;
  const matchRefunds = valueOrEmpty(matchRefundResult, "Match refund queue", { refunds: [] }).refunds;
  const completedMatchRefunds = valueOrEmpty(completedMatchRefundResult, "Completed match refunds", { refunds: [] }).refunds;
  const failedMatchRefunds = valueOrEmpty(failedMatchRefundResult, "Failed match refunds", { refunds: [] }).refunds;
  const tournamentPayouts = valueOrEmpty(tournamentPayoutResult, "Tournament payout queue", { payouts: [] }).payouts;
  const completedTournamentPayouts = valueOrEmpty(completedTournamentPayoutResult, "Completed tournament payouts", { payouts: [] }).payouts;
  const failedTournamentPayouts = valueOrEmpty(failedTournamentPayoutResult, "Failed tournament payouts", { payouts: [] }).payouts;
  const tournamentRefunds = valueOrEmpty(tournamentRefundResult, "Tournament refund queue", { refunds: [] }).refunds;
  const completedTournamentRefunds = valueOrEmpty(completedTournamentRefundResult, "Completed tournament refunds", { refunds: [] }).refunds;
  const failedTournamentRefunds = valueOrEmpty(failedTournamentRefundResult, "Failed tournament refunds", { refunds: [] }).refunds;
  const walletDashboard = valueOrEmpty(walletDashboardResult, "Wallet readiness data", {
    pending_topups: [],
    suspicious_duplicates: [],
    active_holds: [],
    payout_requests: [],
    recent_ledger_entries: [],
    room_financial_timeline: [],
    tournament_financial_timeline: [],
    guardrails: []
  });

  const queueItems = [
    ...submittedTopups.map(queueFromTopup),
    ...submittedFunding.map(queueFromFunding),
    ...walletPayouts.map(queueFromWalletPayout),
    ...matchPayouts.map((row) => queueFromPayout(row, "Match winner payout")),
    ...matchRefunds.map((row) => queueFromRefund(row, "Match refund")),
    ...tournamentPayouts.map((row) => queueFromPayout(row, "Tournament payout")),
    ...tournamentRefunds.map((row) => queueFromRefund(row, "Tournament refund"))
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const bankMatchRows = [...submittedTopups.map(bankMatchFromTopup), ...submittedFunding.map(bankMatchFromFunding)]
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
  const localDuplicates = collectLocalDuplicates([...submittedTopups, ...submittedFunding]);
  const walletDuplicates = walletDashboard.suspicious_duplicates;
  const recentAuditRows = [
    ...approvedTopups.map(auditTopup),
    ...rejectedTopups.map(auditTopup),
    ...approvedFunding.map(auditFunding),
    ...rejectedFunding.map(auditFunding),
    ...paidWalletPayouts.map(auditWalletPayout),
    ...rejectedWalletPayouts.map(auditWalletPayout),
    ...completedMatchPayouts.map((row) => auditPayout(row, "Match payout completed")),
    ...failedMatchPayouts.map((row) => auditPayout(row, "Match payout failed")),
    ...completedMatchRefunds.map((row) => auditRefund(row, "Match refund completed")),
    ...failedMatchRefunds.map((row) => auditRefund(row, "Match refund failed")),
    ...completedTournamentPayouts.map((row) => auditPayout(row, "Tournament payout completed")),
    ...failedTournamentPayouts.map((row) => auditPayout(row, "Tournament payout failed")),
    ...completedTournamentRefunds.map((row) => auditRefund(row, "Tournament refund completed")),
    ...failedTournamentRefunds.map((row) => auditRefund(row, "Tournament refund failed"))
  ].sort((a, b) => Date.parse(b.happenedAt) - Date.parse(a.happenedAt)).slice(0, 18);

  const inflowCount = submittedTopups.length + submittedFunding.length;
  const outflowCount = walletPayouts.length + matchPayouts.length + matchRefunds.length + tournamentPayouts.length + tournamentRefunds.length;
  const duplicateCount = walletDuplicates.length + localDuplicates.length;
  const missingBankDetailCount = bankMatchRows.filter((row) => row.status !== "Ready to check").length;

  return (
    <AdminShell active="paymentReadiness">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Review payment status, bank matching, duplicate warnings, and operator history while Skillsroom stays in manual review mode."
          eyebrow="Payment readiness"
          title="Payment control room"
          tone="cyan"
        />

        {loadErrors.length ? (
          <div className="grid gap-2 rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">
            {loadErrors.map((message) => <p key={message}>{message}</p>)}
          </div>
        ) : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusPanel detail="Top-ups and room entries" label="Money in review" tone="warning" value={inflowCount.toString()} />
          <StatusPanel detail="Payouts and refunds" label="Money out review" tone="danger" value={outflowCount.toString()} />
          <StatusPanel detail="Same reference or proof" label="Duplicate warnings" tone={duplicateCount ? "danger" : "success"} value={duplicateCount.toString()} />
          <StatusPanel detail="Manual bank check" label="Needs details" tone={missingBankDetailCount ? "warning" : "success"} value={missingBankDetailCount.toString()} />
        </div>

        <Panel>
          <PanelHeader
            eyebrow="Provider boundary"
            title="Manual today, provider-ready later"
            description="Skillsroom owns the match rules, reserved balances, winner review, and audit history. A payment partner should only collect, confirm, and pay after Skillsroom approves the move."
          />
          <div className="grid gap-3 p-4 lg:grid-cols-3">
            <div className="rounded-md border border-line bg-white p-4">
              <Badge tone="success">Live now</Badge>
              <h2 className="mt-3 text-lg font-black text-ink">Manual review mode</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Admins check bank alerts, payment proof, player details, and room status before approving wallet or room payments.</p>
            </div>
            <div className="rounded-md border border-line bg-white p-4">
              <Badge tone="warning">Future</Badge>
              <h2 className="mt-3 text-lg font-black text-ink">Kora or another payment partner</h2>
              <p className="mt-2 text-sm leading-6 text-muted">The partner can send payment updates and payout results, but Skillsroom still decides when a winner payout or refund should happen.</p>
            </div>
            <div className="rounded-md border border-line bg-white p-4">
              <Badge tone="cyan">Design rule</Badge>
              <h2 className="mt-3 text-lg font-black text-ink">No instant winner split</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Entry money should stay reserved until proof, result review, and dispute windows are complete. Then Skillsroom can queue the winner payout.</p>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Reconciliation"
            title="Review queue"
            description="Everything here needs a human or future payment partner confirmation before the money status changes."
          />
          {queueItems.length ? (
            <DataTable
              columns={[
                { key: "createdAt", label: "Created", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.createdAt).toLocaleString("en-NG")}</span> },
                { key: "kind", label: "Record", render: (row) => <strong className="text-ink">{row.kind}</strong> },
                { key: "amount", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{row.amount}</span> },
                { key: "playerId", label: "Player", render: (row) => <span className="break-all font-mono text-xs font-bold text-muted">{row.playerId}</span> },
                { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
                { key: "check", label: "Next check", render: (row) => <span className="text-sm font-bold text-ink">{row.check}</span> },
                { key: "href", label: "Action", render: (row) => <a className="text-sm font-black text-cyan hover:text-action" href={row.href}>Open</a> }
              ]}
              rowKey={(row) => row.id}
              rows={queueItems}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState description="No payment, payout, or refund record is waiting for review right now." title="Payment review queue is clear" />
            </div>
          )}
        </Panel>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <PanelHeader
              eyebrow="Bank matching"
              title="Reference checks"
              description="These rows show whether the player supplied enough details to match the payment against bank records."
            />
            {bankMatchRows.length ? (
              <DataTable
                columns={[
                  { key: "submittedAt", label: "Submitted", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.submittedAt).toLocaleString("en-NG")}</span> },
                  { key: "kind", label: "Kind", render: (row) => <strong className="text-ink">{row.kind}</strong> },
                  { key: "amount", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{row.amount}</span> },
                  { key: "reference", label: "Reference", render: (row) => <span className="break-all font-mono text-xs font-bold text-muted">{row.reference}</span> },
                  { key: "sender", label: "Sender", render: (row) => <span className="text-sm font-bold text-ink">{row.sender}</span> },
                  { key: "bank", label: "Bank", render: (row) => <span className="text-sm font-bold text-ink">{row.bank}</span> },
                  { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "Ready to check" ? "success" : "warning"}>{row.status}</Badge> }
                ]}
                rowKey={(row) => row.id}
                rows={bankMatchRows}
              />
            ) : (
              <div className="p-4">
                <AdminEmptyState description="No submitted payment is waiting for bank matching." title="No bank match rows" />
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Provider checklist" title="Automation gates" />
            <div className="grid gap-3 p-4">
              {[
                ["Business approval", "Needed before automated collection and payouts go live."],
                ["Payment update webhook", "Provider tells Skillsroom whether a pay-in succeeded or failed."],
                ["Payout result webhook", "Provider tells Skillsroom whether a winner payout or refund succeeded."],
                ["Reference lock", "Every provider payment needs one Skillsroom room, wallet, payout, or refund record."],
                ["Manual fallback", "Admins must still be able to resolve failed or delayed provider actions."]
              ].map(([title, detail]) => (
                <div className="rounded-md border border-line bg-white p-4" key={title}>
                  <h3 className="text-sm font-black text-ink">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            eyebrow="Duplicate detection"
            title="Repeated references and proof files"
            description="Duplicates do not automatically mean fraud, but they should block approval until an admin checks them."
          />
          {walletDuplicates.length || localDuplicates.length ? (
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              {walletDuplicates.map((row) => (
                <article className="rounded-md border border-danger/40 bg-red-50 p-4" key={`wallet:${row.duplicate_type}:${row.group_key}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Badge tone="danger">{duplicateTitle(row)}</Badge>
                    <strong className="text-lg font-black text-danger">{row.occurrence_count} hits</strong>
                  </div>
                  <h3 className="mt-3 break-all font-mono text-sm font-black text-ink">{row.group_key}</h3>
                  <p className="mt-2 text-sm font-bold text-ink">{row.user_count} player(s), {money("NGN", row.amount_minor_total)} total.</p>
                  <p className="mt-2 break-all font-mono text-xs font-bold text-muted">Sample top-ups: {row.sample_topup_ids.slice(0, 5).join(", ")}</p>
                </article>
              ))}
              {localDuplicates.map((row) => (
                <article className="rounded-md border border-danger/40 bg-red-50 p-4" key={`local:${row.duplicate_type}:${row.group_key}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Badge tone="danger">{duplicateTitle(row)}</Badge>
                    <strong className="text-lg font-black text-danger">{row.occurrence_count} hits</strong>
                  </div>
                  <h3 className="mt-3 break-all font-mono text-sm font-black text-ink">{row.group_key}</h3>
                  <p className="mt-2 text-sm font-bold text-ink">{row.user_count} player(s), {money("NGN", row.amount_minor_total)} total.</p>
                  <p className="mt-2 break-all font-mono text-xs font-bold text-muted">Samples: {row.sample_ids.join(", ")}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <AdminEmptyState description="No repeated active bank references or proof files were found." title="No duplicate warning" />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Operator audit"
            title="Recent money decisions"
            description="This view helps admins see who approved, rejected, paid, refunded, or failed recent payment records."
          />
          {recentAuditRows.length ? (
            <DataTable
              columns={[
                { key: "happenedAt", label: "Time", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.happenedAt).toLocaleString("en-NG")}</span> },
                { key: "action", label: "Action", render: (row) => <strong className="text-ink">{row.action}</strong> },
                { key: "amount", label: "Amount", render: (row) => <span className="font-mono font-bold text-ink">{row.amount}</span> },
                { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
                { key: "actor", label: "Admin", render: (row) => <span className="break-all font-mono text-xs font-bold text-muted">{row.actor}</span> },
                { key: "reference", label: "Reference", render: (row) => <span className="break-all font-mono text-xs font-bold text-muted">{row.reference}</span> }
              ]}
              rowKey={(row) => `${row.action}:${row.id}`}
              rows={recentAuditRows}
            />
          ) : (
            <div className="p-4">
              <AdminEmptyState description="No recent payment decisions are available yet." title="No operator history" />
            </div>
          )}
        </Panel>
      </section>
    </AdminShell>
  );
}
