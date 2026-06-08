"use server";

import { redirect } from "next/navigation";
import { ApiRequestError, createRoomInvite } from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  return "The invite could not be created.";
}

export async function createRoomInviteAction(formData: FormData) {
  try {
    await createRoomInvite({
      match_room_code: String(formData.get("match_room_code") || "").trim(),
      invitee_username: String(formData.get("invitee_username") || "").trim(),
      message: String(formData.get("message") || "").trim() || undefined
    });
  } catch (error) {
    redirect(`/community?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }
  redirect("/community");
}
