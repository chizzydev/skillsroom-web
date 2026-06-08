"use server";

import { redirect } from "next/navigation";
import { ApiRequestError, reviewGameAccount } from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "The player admin action could not be completed.";
}

export async function reviewGameAccountAction(formData: FormData) {
  try {
    await reviewGameAccount(String(formData.get("game_account_id") || ""), {
      status: String(formData.get("status") || "pending") as "pending" | "verified" | "rejected" | "disabled",
      verification_notes: String(formData.get("verification_notes") || "").trim() || undefined
    });
  } catch (error) {
    redirect(`/admin/players?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect("/admin/players?game_account_reviewed=1");
}
