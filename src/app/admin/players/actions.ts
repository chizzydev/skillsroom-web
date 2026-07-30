"use server";

import { redirect } from "next/navigation";
import { adminActionErrorMessage } from "@/lib/admin-action-errors";
import { reviewGameAccount } from "@/lib/match-room-api";

async function playerReviewErrorMessage(error: unknown) {
  const message = await adminActionErrorMessage(
    error,
    "Player handle review could not be saved. Refresh the player review page and try again."
  );
  return message === "Something went wrong."
    ? "Player handle review could not be saved. Refresh the player review page and try again."
    : message;
}

export async function reviewGameAccountAction(formData: FormData) {
  try {
    await reviewGameAccount(String(formData.get("game_account_id") || ""), {
      status: String(formData.get("status") || "pending") as "pending" | "verified" | "rejected" | "disabled",
      verification_notes: String(formData.get("verification_notes") || "").trim() || undefined
    });
  } catch (error) {
    redirect(`/admin/players?error=${encodeURIComponent(await playerReviewErrorMessage(error))}`);
  }

  redirect("/admin/players?game_account_reviewed=1");
}
