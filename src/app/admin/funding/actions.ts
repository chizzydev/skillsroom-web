"use server";

import { redirect } from "next/navigation";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import { ApiRequestError, reviewFundingSubmission } from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "The funding review could not be completed.";
}

export async function reviewFundingSubmissionAction(formData: FormData) {
  const submissionId = String(formData.get("submission_id") || "");

  try {
    const stepUpToken = await requireAdminStepUpToken();
    await reviewFundingSubmission(submissionId, {
      decision: String(formData.get("decision")) === "reject" ? "reject" : "approve",
      note: String(formData.get("note") || "").trim() || undefined,
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/funding?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect("/admin/funding");
}
