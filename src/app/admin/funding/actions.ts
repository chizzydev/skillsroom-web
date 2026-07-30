"use server";

import { redirect } from "next/navigation";
import { adminActionErrorMessage } from "@/lib/admin-action-errors";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import { trackServerAnalyticsEvent } from "@/lib/analytics-server";
import { reviewFundingSubmission } from "@/lib/match-room-api";

function withSuccess(decision: "approve" | "reject") {
  return `/admin/funding?success=${encodeURIComponent(
    decision === "approve" ? "Funding submission approved." : "Funding submission rejected."
  )}`;
}

export async function reviewFundingSubmissionAction(formData: FormData) {
  const decision = String(formData.get("decision")) === "reject" ? "reject" : "approve";
  const submissionId = String(formData.get("submission_id") || "");

  try {
    const stepUpToken = await requireAdminStepUpToken();
    await reviewFundingSubmission(submissionId, {
      decision,
      note: String(formData.get("note") || "").trim() || undefined,
      stepUpToken
    });
    await trackServerAnalyticsEvent({
      eventName: "funding.reviewed",
      screen: "admin_funding",
      path: "/admin/funding",
      entityType: "manual_funding_submission",
      entityId: submissionId,
      metadata: { surface: "admin_web", action: decision }
    });
  } catch (error) {
    redirect(`/admin/funding?error=${encodeURIComponent(await adminActionErrorMessage(error, "The funding review could not be completed."))}`);
  }

  redirect(withSuccess(decision));
}
