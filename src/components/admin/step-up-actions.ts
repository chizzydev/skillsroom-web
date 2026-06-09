"use server";

import { redirect } from "next/navigation";
import { clearAdminStepUpToken, persistAdminStepUpToken } from "@/lib/admin-step-up-session";
import { ApiRequestError, confirmAdminStepUp } from "@/lib/match-room-api";

function normalizeReturnTo(input: string) {
  if (input.startsWith("/")) return input.split("?")[0] || "/admin";
  return "/admin";
}

function withError(path: string, message: string) {
  const url = new URL(path, "http://skillsroom.local");
  url.searchParams.set("error", message);
  return `${url.pathname}${url.search}`;
}

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "Sensitive actions could not be unlocked.";
}

export async function confirmAdminStepUpAction(formData: FormData) {
  const returnTo = normalizeReturnTo(String(formData.get("return_to") || "/admin"));

  try {
    const result = await confirmAdminStepUp({
      password: String(formData.get("password") || "")
    });
    await persistAdminStepUpToken(result.step_up_token, result.expires_at);
  } catch (error) {
    await clearAdminStepUpToken();
    redirect(withError(returnTo, actionErrorMessage(error)));
  }

  redirect(returnTo);
}

export async function clearAdminStepUpAction(formData: FormData) {
  await clearAdminStepUpToken();
  redirect(normalizeReturnTo(String(formData.get("return_to") || "/admin")));
}
