"use server";

import { redirect } from "next/navigation";
import { adminActionErrorMessage } from "@/lib/admin-action-errors";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import { reviewWalletPayoutRequest, reviewWalletTopup } from "@/lib/match-room-api";

function withSuccess(decision: "approve" | "reject") {
  return `/admin/wallet?success=${encodeURIComponent(
    decision === "approve" ? "Wallet top-up approved and credited." : "Wallet top-up rejected."
  )}`;
}

function payoutSuccess(decision: "mark_paid" | "reject") {
  return `/admin/wallet?success=${encodeURIComponent(
    decision === "mark_paid" ? "Payout marked as paid." : "Payout rejected and returned to winnings."
  )}`;
}

export async function reviewWalletTopupAction(formData: FormData) {
  const decision = String(formData.get("decision")) === "reject" ? "reject" : "approve";
  const topupId = String(formData.get("topup_id") || "");

  try {
    const stepUpToken = await requireAdminStepUpToken();
    await reviewWalletTopup(topupId, {
      decision,
      note: String(formData.get("note") || "").trim() || undefined,
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/wallet?error=${encodeURIComponent(await adminActionErrorMessage(error, "The wallet top-up review could not be completed."))}`);
  }

  redirect(withSuccess(decision));
}

export async function reviewWalletPayoutAction(formData: FormData) {
  const decision = String(formData.get("decision")) === "reject" ? "reject" : "mark_paid";
  const payoutRequestId = String(formData.get("payout_request_id") || "");

  try {
    const stepUpToken = await requireAdminStepUpToken();
    await reviewWalletPayoutRequest(payoutRequestId, {
      decision,
      payment_reference: String(formData.get("payment_reference") || "").trim() || undefined,
      note: String(formData.get("note") || "").trim() || undefined,
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/wallet?error=${encodeURIComponent(await adminActionErrorMessage(error, "The payout review could not be completed."))}`);
  }

  redirect(payoutSuccess(decision));
}
