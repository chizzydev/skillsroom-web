"use server";

import { redirect } from "next/navigation";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import { getCurrentUser } from "@/lib/auth-bridge";
import { storeEvidenceFile } from "@/lib/evidence-storage";
import {
  ApiRequestError,
  completePayout,
  completeRefund,
  completeTournamentPayout,
  completeTournamentRefund,
  reserveRefunds,
  reserveSettlement,
  updatePayoutInstructions,
  updateRefundInstructions,
  updateTournamentPayoutInstructions,
  updateTournamentRefundInstructions
} from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.requestId ? `${error.message} Request ID: ${error.requestId}` : error.message;
  }
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

function normalizedIdentifier(formData: FormData, key: string) {
  return String(formData.get(key) || "")
    .replace(/\s+/g, "")
    .trim();
}

function uploadedFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function logSettlementActionFailure(action: string, context: Record<string, unknown>, error: unknown) {
  console.error(`[settlements:${action}]`, {
    ...context,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
  });
}

export async function reserveSettlementAction(formData: FormData) {
  try {
    const stepUpToken = await requireAdminStepUpToken();
    await reserveSettlement({
      match_room_id: normalizedIdentifier(formData, "match_room_id"),
      notes: String(formData.get("notes") || "").trim() || undefined,
      stepUpToken
    });
  } catch (error) {
    logSettlementActionFailure(
      "reserve_settlement",
      {
        matchRoomId: normalizedIdentifier(formData, "match_room_id"),
        hasNotes: Boolean(optionalString(formData, "notes"))
      },
      error
    );
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
    const matchRoomId = normalizedIdentifier(formData, "match_room_id");
    const proofFile = uploadedFile(formData, "completion_proof_file");
    const storedProof = proofFile
      ? await storeEvidenceFile({ file: proofFile, matchRoomId, userId: user.id })
      : null;
    const completionProofUrl = storedProof?.url ?? optionalString(formData, "completion_proof_url");
    const payoutReference = optionalString(formData, "payout_reference");
    if (!completionProofUrl) {
      throw new Error("Upload the transfer proof screenshot or video, or provide a hosted proof link.");
    }
    const payoutId = normalizedIdentifier(formData, "payout_id");
    if (!payoutId) {
      throw new Error("Payout ID is required.");
    }
    await completePayout(payoutId, {
      payout_reference: payoutReference,
      completion_proof_url: completionProofUrl,
      stepUpToken
    });
  } catch (error) {
    logSettlementActionFailure(
      "complete_payout",
      {
        matchRoomId: normalizedIdentifier(formData, "match_room_id"),
        payoutId: normalizedIdentifier(formData, "payout_id"),
        hasProofFile: Boolean(uploadedFile(formData, "completion_proof_file")),
        hasProofUrl: Boolean(optionalString(formData, "completion_proof_url")),
        hasPayoutReference: Boolean(optionalString(formData, "payout_reference"))
      },
      error
    );
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
      match_room_id: normalizedIdentifier(formData, "match_room_id"),
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
    const matchRoomId = normalizedIdentifier(formData, "match_room_id");
    const proofFile = uploadedFile(formData, "completion_proof_file");
    const storedProof = proofFile
      ? await storeEvidenceFile({ file: proofFile, matchRoomId, userId: user.id })
      : null;
    const completionProofUrl = storedProof?.url ?? optionalString(formData, "completion_proof_url");
    const refundReference = optionalString(formData, "refund_reference");
    if (!completionProofUrl) {
      throw new Error("Upload the refund proof screenshot or video, or provide a hosted proof link.");
    }
    const refundId = normalizedIdentifier(formData, "refund_id");
    if (!refundId) {
      throw new Error("Refund ID is required.");
    }
    await completeRefund(refundId, {
      refund_reference: refundReference,
      completion_proof_url: completionProofUrl,
      stepUpToken
    });
  } catch (error) {
    logSettlementActionFailure(
      "complete_refund",
      {
        matchRoomId: normalizedIdentifier(formData, "match_room_id"),
        refundId: normalizedIdentifier(formData, "refund_id"),
        hasProofFile: Boolean(uploadedFile(formData, "completion_proof_file")),
        hasProofUrl: Boolean(optionalString(formData, "completion_proof_url")),
        hasRefundReference: Boolean(optionalString(formData, "refund_reference"))
      },
      error
    );
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

export async function completeTournamentPayoutAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Sign in again before confirming payout proof.");
    }
    const stepUpToken = await requireAdminStepUpToken();
    const tournamentId = normalizedIdentifier(formData, "tournament_id");
    const proofFile = uploadedFile(formData, "completion_proof_file");
    const storedProof = proofFile
      ? await storeEvidenceFile({ file: proofFile, matchRoomId: tournamentId, userId: user.id, contextType: "tournament" })
      : null;
    const completionProofUrl = storedProof?.url ?? optionalString(formData, "completion_proof_url");
    const payoutReference = optionalString(formData, "payout_reference");
    if (!completionProofUrl) {
      throw new Error("Upload the transfer proof screenshot or video, or provide a hosted proof link.");
    }
    const payoutId = normalizedIdentifier(formData, "payout_id");
    if (!payoutId) {
      throw new Error("Payout ID is required.");
    }
    await completeTournamentPayout(payoutId, {
      payout_reference: payoutReference,
      completion_proof_url: completionProofUrl,
      stepUpToken
    });
  } catch (error) {
    logSettlementActionFailure(
      "complete_tournament_payout",
      {
        tournamentId: normalizedIdentifier(formData, "tournament_id"),
        payoutId: normalizedIdentifier(formData, "payout_id"),
        hasProofFile: Boolean(uploadedFile(formData, "completion_proof_file")),
        hasProofUrl: Boolean(optionalString(formData, "completion_proof_url")),
        hasPayoutReference: Boolean(optionalString(formData, "payout_reference"))
      },
      error
    );
    redirect(withError(error));
  }

  redirect(withSuccess("Tournament payout marked as completed."));
}

export async function updateTournamentPayoutInstructionsAction(formData: FormData) {
  try {
    const stepUpToken = await requireAdminStepUpToken();
    const payoutId = String(formData.get("payout_id") || "").trim();
    const useFallback = String(formData.get("use_fallback") || "").trim() === "true";
    await updateTournamentPayoutInstructions(payoutId, {
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

  redirect(withSuccess("Tournament payout instructions saved."));
}

export async function completeTournamentRefundAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Sign in again before confirming refund proof.");
    }
    const stepUpToken = await requireAdminStepUpToken();
    const tournamentId = normalizedIdentifier(formData, "tournament_id");
    const proofFile = uploadedFile(formData, "completion_proof_file");
    const storedProof = proofFile
      ? await storeEvidenceFile({ file: proofFile, matchRoomId: tournamentId, userId: user.id, contextType: "tournament" })
      : null;
    const completionProofUrl = storedProof?.url ?? optionalString(formData, "completion_proof_url");
    const refundReference = optionalString(formData, "refund_reference");
    if (!completionProofUrl) {
      throw new Error("Upload the refund proof screenshot or video, or provide a hosted proof link.");
    }
    const refundId = normalizedIdentifier(formData, "refund_id");
    if (!refundId) {
      throw new Error("Refund ID is required.");
    }
    await completeTournamentRefund(refundId, {
      refund_reference: refundReference,
      completion_proof_url: completionProofUrl,
      stepUpToken
    });
  } catch (error) {
    logSettlementActionFailure(
      "complete_tournament_refund",
      {
        tournamentId: normalizedIdentifier(formData, "tournament_id"),
        refundId: normalizedIdentifier(formData, "refund_id"),
        hasProofFile: Boolean(uploadedFile(formData, "completion_proof_file")),
        hasProofUrl: Boolean(optionalString(formData, "completion_proof_url")),
        hasRefundReference: Boolean(optionalString(formData, "refund_reference"))
      },
      error
    );
    redirect(withError(error));
  }

  redirect(withSuccess("Tournament refund marked as completed."));
}

export async function updateTournamentRefundInstructionsAction(formData: FormData) {
  try {
    const stepUpToken = await requireAdminStepUpToken();
    const refundId = String(formData.get("refund_id") || "").trim();
    const useFallback = String(formData.get("use_fallback") || "").trim() === "true";
    await updateTournamentRefundInstructions(refundId, {
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

  redirect(withSuccess("Tournament refund instructions saved."));
}
