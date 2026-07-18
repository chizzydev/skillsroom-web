"use server";

import { redirect } from "next/navigation";
import { adminActionErrorMessage } from "@/lib/admin-action-errors";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import { reviewResultClaim, type ResultReviewDecision } from "@/lib/match-room-api";

const resultSuccessMessages: Record<ResultReviewDecision, string> = {
  approve_claim: "Result claim approved.",
  approve_no_response: "Result approved after no opponent response.",
  opponent_timeout_awarded: "Result awarded after no opponent response.",
  reject_claim: "Result claim rejected.",
  mark_disputed: "Result claim moved to dispute review.",
  void_match: "Match closed without a winner. Refunds were queued."
};

export async function reviewResultClaimAction(formData: FormData) {
  const claimId = String(formData.get("claim_id") || "");
  const decision = String(formData.get("decision") || "mark_disputed") as ResultReviewDecision;

  try {
    const stepUpToken = await requireAdminStepUpToken();
    await reviewResultClaim(claimId, {
      decision,
      note: String(formData.get("note") || "").trim() || undefined,
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/results?error=${encodeURIComponent(await adminActionErrorMessage(error, "The result review could not be completed."))}`);
  }

  redirect(`/admin/results?success=${encodeURIComponent(resultSuccessMessages[decision] ?? "Result review completed.")}`);
}
