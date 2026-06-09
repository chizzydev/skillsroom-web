"use server";

import { redirect } from "next/navigation";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import { ApiRequestError, completePayout, completeRefund, reserveRefunds, reserveSettlement } from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "The settlement action could not be completed.";
}

function withError(error: unknown) {
  return `/admin/settlements?error=${encodeURIComponent(actionErrorMessage(error))}`;
}

function withSuccess(message: string) {
  return `/admin/settlements?success=${encodeURIComponent(message)}`;
}

export async function reserveSettlementAction(formData: FormData) {
  try {
    const stepUpToken = await requireAdminStepUpToken();
    await reserveSettlement({
      match_room_id: String(formData.get("match_room_id") || ""),
      notes: String(formData.get("notes") || "").trim() || undefined,
      stepUpToken
    });
  } catch (error) {
    redirect(withError(error));
  }

  redirect(withSuccess("Settlement reserved and payout queue created."));
}

export async function completePayoutAction(formData: FormData) {
  try {
    const stepUpToken = await requireAdminStepUpToken();
    await completePayout(String(formData.get("payout_id") || ""), {
      payout_reference: String(formData.get("payout_reference") || "").trim(),
      stepUpToken
    });
  } catch (error) {
    redirect(withError(error));
  }

  redirect(withSuccess("Payout marked as completed."));
}

export async function reserveRefundsAction(formData: FormData) {
  try {
    const stepUpToken = await requireAdminStepUpToken();
    await reserveRefunds({
      match_room_id: String(formData.get("match_room_id") || ""),
      reason: String(formData.get("reason") || "").trim(),
      stepUpToken
    });
  } catch (error) {
    redirect(withError(error));
  }

  redirect(withSuccess("Refund queue created."));
}

export async function completeRefundAction(formData: FormData) {
  try {
    const stepUpToken = await requireAdminStepUpToken();
    await completeRefund(String(formData.get("refund_id") || ""), {
      refund_reference: String(formData.get("refund_reference") || "").trim(),
      stepUpToken
    });
  } catch (error) {
    redirect(withError(error));
  }

  redirect(withSuccess("Refund marked as completed."));
}
