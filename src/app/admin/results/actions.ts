"use server";

import { redirect } from "next/navigation";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import { ApiRequestError, reviewResultClaim, type ResultReviewDecision } from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "The result review could not be completed.";
}

export async function reviewResultClaimAction(formData: FormData) {
  const claimId = String(formData.get("claim_id") || "");

  try {
    const stepUpToken = await requireAdminStepUpToken();
    await reviewResultClaim(claimId, {
      decision: String(formData.get("decision") || "mark_disputed") as ResultReviewDecision,
      note: String(formData.get("note") || "").trim() || undefined,
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/results?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect("/admin/results");
}
