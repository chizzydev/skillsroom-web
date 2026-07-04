"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-bridge";
import { storeEvidenceFile } from "@/lib/evidence-storage";
import { manualCollectionAccount } from "@/lib/manual-payment";
import { ApiRequestError, requestWalletPayout, submitWalletTopup } from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "Your wallet top-up could not be submitted.";
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value || undefined;
}

function uploadedFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function submitWalletTopupAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Please sign in before funding your wallet.");

    const amountNaira = Number(formData.get("amount_naira") || 0);
    const proofFile = uploadedFile(formData, "proof_file");
    const storedProof = proofFile
      ? await storeEvidenceFile({
          file: proofFile,
          matchRoomId: `wallet-${user.id}`,
          userId: user.id,
          contextType: "wallet"
        })
      : null;

    const proofUrl = storedProof?.url ?? optionalString(formData, "proof_url");
    if (!proofUrl) {
      throw new Error("Upload your payment screenshot before submitting your wallet top-up.");
    }

    await submitWalletTopup({
      amount_minor: Math.round(amountNaira * 100),
      collection_bank_name: manualCollectionAccount.bankName,
      collection_account_number: manualCollectionAccount.accountNumber,
      collection_account_name: manualCollectionAccount.accountName,
      transfer_reference: optionalString(formData, "transfer_reference"),
      sender_account_name: optionalString(formData, "sender_account_name"),
      sender_bank_name: optionalString(formData, "sender_bank_name"),
      proof_url: proofUrl,
      proof_note: optionalString(formData, "proof_note")
    });
  } catch (error) {
    redirect(`/wallet?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect("/wallet?success=Wallet top-up submitted. We will review it before adding it to your balance.");
}

export async function requestWalletPayoutAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Please sign in before requesting a payout.");

    const amountNaira = Number(formData.get("payout_amount_naira") || 0);
    await requestWalletPayout({
      amount_minor: Math.round(amountNaira * 100),
      payout_recipient_name: String(formData.get("payout_recipient_name") || "").trim(),
      payout_bank_name: String(formData.get("payout_bank_name") || "").trim(),
      payout_account_number: String(formData.get("payout_account_number") || "").trim(),
      payout_bank_code: optionalString(formData, "payout_bank_code"),
      payout_note: optionalString(formData, "payout_note")
    });
  } catch (error) {
    redirect(`/wallet?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect("/wallet?success=Payout requested. We will pay the saved bank details after review.");
}
