"use server";

import { redirect } from "next/navigation";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import { getCurrentUser } from "@/lib/auth-bridge";
import { storeEvidenceFile } from "@/lib/evidence-storage";
import { ApiRequestError, completePayout, completeRefund, reserveRefunds, reserveSettlement, updatePayoutInstructions, updateRefundInstructions } from "@/lib/match-room-api";

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

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value || undefined;
}

function uploadedFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
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
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Sign in again before confirming payout proof.");
    }
    const stepUpToken = await requireAdminStepUpToken();
    const matchRoomId = String(formData.get("match_room_id") || "").trim();
    const proofFile = uploadedFile(formData, "completion_proof_file");
    const storedProof = proofFile
      ? await storeEvidenceFile({ file: proofFile, matchRoomId, userId: user.id })
      : null;
    const completionProofUrl = storedProof?.url ?? optionalString(formData, "completion_proof_url");
    if (!completionProofUrl) {
      throw new Error("Upload the transfer proof screenshot or video, or provide a hosted proof link.");
    }
    await completePayout(String(formData.get("payout_id") || ""), {
      payout_reference: optionalString(formData, "payout_reference"),
      completion_proof_url: completionProofUrl,
      stepUpToken
    });
  } catch (error) {
    redirect(withError(error));
  }

  redirect(withSuccess("Payout marked as completed."));
}

export async function updatePayoutInstructionsAction(formData: FormData) {
  try {
    const stepUpToken = await requireAdminStepUpToken();
    const payoutId = String(formData.get("payout_id") || "").trim();
    const useFallback = String(formData.get("use_fallback") || "").trim() === "true";
    await updatePayoutInstructions(payoutId, {
      recipient_name: optionalString(formData, "recipient_name"),
      bank_name: optionalString(formData, "bank_name"),
      account_number: optionalString(formData, "account_number"),
      bank_code: optionalString(formData, "bank_code"),
      payout_note: optionalString(formData, "payout_note"),
      use_fallback: useFallback,
      stepUpToken
    });
  } catch (error) {
    redirect(withError(error));
  }

  redirect(withSuccess("Payout instructions saved."));
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
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Sign in again before confirming refund proof.");
    }
    const stepUpToken = await requireAdminStepUpToken();
    const matchRoomId = String(formData.get("match_room_id") || "").trim();
    const proofFile = uploadedFile(formData, "completion_proof_file");
    const storedProof = proofFile
      ? await storeEvidenceFile({ file: proofFile, matchRoomId, userId: user.id })
      : null;
    const completionProofUrl = storedProof?.url ?? optionalString(formData, "completion_proof_url");
    if (!completionProofUrl) {
      throw new Error("Upload the refund proof screenshot or video, or provide a hosted proof link.");
    }
    await completeRefund(String(formData.get("refund_id") || ""), {
      refund_reference: optionalString(formData, "refund_reference"),
      completion_proof_url: completionProofUrl,
      stepUpToken
    });
  } catch (error) {
    redirect(withError(error));
  }

  redirect(withSuccess("Refund marked as completed."));
}

export async function updateRefundInstructionsAction(formData: FormData) {
  try {
    const stepUpToken = await requireAdminStepUpToken();
    const refundId = String(formData.get("refund_id") || "").trim();
    const useFallback = String(formData.get("use_fallback") || "").trim() === "true";
    await updateRefundInstructions(refundId, {
      recipient_name: optionalString(formData, "recipient_name"),
      bank_name: optionalString(formData, "bank_name"),
      account_number: optionalString(formData, "account_number"),
      bank_code: optionalString(formData, "bank_code"),
      payout_note: optionalString(formData, "payout_note"),
      use_fallback: useFallback,
      stepUpToken
    });
  } catch (error) {
    redirect(withError(error));
  }

  redirect(withSuccess("Refund instructions saved."));
}
