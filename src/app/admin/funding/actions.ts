"use server";

import { redirect } from "next/navigation";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import { ApiRequestError, reviewFundingSubmission } from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "The funding review could not be completed.";
}

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
    redirect(`/admin/funding?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect(withSuccess(decision));
}
