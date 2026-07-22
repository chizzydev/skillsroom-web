import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStepUpPanel } from "@/components/admin/AdminStepUpPanel";
import { AdminShell } from "@/components/layout/AdminShell";
import { LiveUpdateStream } from "@/components/realtime/LiveUpdateStream";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { adminErrorMessageFromQuery } from "@/lib/admin-action-errors";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { listFundingSubmissions, type ManualFundingSubmission } from "@/lib/match-room-api";
import { reviewFundingSubmissionAction } from "./actions";
import { AdminFundingLiveQueue } from "./AdminFundingLiveQueue";

export const dynamic = "force-dynamic";

export default async function AdminFundingPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/funding");
  if (!canUseAdminSection(user, "funding")) redirect("/admin");
  const { error, success } = await searchParams;

  let submissions: ManualFundingSubmission[] = [];
  let loadError: string | null = null;
  try {
    submissions = (await listFundingSubmissions("submitted")).submissions;
  } catch {
    loadError = "Unable to load funding queue.";
  }

  return (
    <AdminShell active="funding">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Confirm exact transfer amount, sender identity, room, and reference before approval writes ledger entries."
          eyebrow="Funding"
          title="Manual Funding Queue"
          tone="warning"
        />

        <LiveUpdateStream eventTypePrefixes={["admin.queue.funding.", "match.funding."]} label="Funding updates" />

        {error ? <TransientStatusBanner clearKeys={["error"]} durationMs={12000} message={adminErrorMessageFromQuery(error)} /> : null}
        {success ? <TransientStatusBanner clearKeys={["success"]} durationMs={12000} message={success} tone="success" /> : null}
        {loadError ? (
          <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div>
        ) : null}

        <AdminFundingLiveQueue initialSnapshot={{ submissions, loaded_at: new Date().toISOString() }} />

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="hidden xl:block" />
          <div className="grid h-fit gap-4 xl:sticky xl:top-24">
            <AdminStepUpPanel returnTo="/admin/funding" />
            <Panel>
              <PanelHeader eyebrow="Decision" title="Approve or reject funding" description="Approvals create balanced ledger entries into platform cash and match escrow." />
              <form action={reviewFundingSubmissionAction} className="grid gap-3 p-4">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Submission ID
                  <input className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm outline-none focus:border-action" name="submission_id" required />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Review note
                  <textarea className="min-h-28 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" />
                </label>
                <div className="grid gap-2">
                  <FormActionButton idleLabel="Approve funding" name="decision" pendingLabel="Approving funding..." value="approve" />
                  <FormActionButton idleLabel="Reject funding" name="decision" pendingLabel="Rejecting funding..." value="reject" variant="danger" />
                </div>
              </form>
            </Panel>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
