"use server";

import { redirect } from "next/navigation";
import { adminActionErrorMessage } from "@/lib/admin-action-errors";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
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
  } catch (error) {
    redirect(`/admin/funding?error=${encodeURIComponent(await adminActionErrorMessage(error, "The funding review could not be completed."))}`);
  }

  redirect(withSuccess(decision));
}
