"use server";

import { redirect } from "next/navigation";
import { ApiRequestError, completePayout, completeRefund, reserveRefunds, reserveSettlement } from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  return "The settlement action could not be completed.";
}

function withError(error: unknown) {
  return `/admin/settlements?error=${encodeURIComponent(actionErrorMessage(error))}`;
}

export async function reserveSettlementAction(formData: FormData) {
  try {
    await reserveSettlement({
      match_room_id: String(formData.get("match_room_id") || ""),
      notes: String(formData.get("notes") || "").trim() || undefined,
      stepUpToken: String(formData.get("step_up_token") || "").trim()
    });
  } catch (error) {
    redirect(withError(error));
  }

  redirect("/admin/settlements");
}

export async function completePayoutAction(formData: FormData) {
  try {
    await completePayout(String(formData.get("payout_id") || ""), {
      payout_reference: String(formData.get("payout_reference") || "").trim(),
      stepUpToken: String(formData.get("step_up_token") || "").trim()
    });
  } catch (error) {
    redirect(withError(error));
  }

  redirect("/admin/settlements");
}

export async function reserveRefundsAction(formData: FormData) {
  try {
    await reserveRefunds({
      match_room_id: String(formData.get("match_room_id") || ""),
      reason: String(formData.get("reason") || "").trim(),
      stepUpToken: String(formData.get("step_up_token") || "").trim()
    });
  } catch (error) {
    redirect(withError(error));
  }

  redirect("/admin/settlements");
}

export async function completeRefundAction(formData: FormData) {
  try {
    await completeRefund(String(formData.get("refund_id") || ""), {
      refund_reference: String(formData.get("refund_reference") || "").trim(),
      stepUpToken: String(formData.get("step_up_token") || "").trim()
    });
  } catch (error) {
    redirect(withError(error));
  }

  redirect("/admin/settlements");
}
