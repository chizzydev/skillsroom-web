"use server";

import { redirect } from "next/navigation";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import { ApiRequestError, reviewWalletPayoutRequest, reviewWalletTopup } from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "The wallet top-up review could not be completed.";
}

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
    redirect(`/admin/wallet?error=${encodeURIComponent(actionErrorMessage(error))}`);
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
    redirect(`/admin/wallet?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect(payoutSuccess(decision));
}
