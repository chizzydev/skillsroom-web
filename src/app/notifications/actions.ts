"use server";

import { redirect } from "next/navigation";
import {
  ApiRequestError,
  markAllNotificationsRead,
  markNotificationRead,
  respondDmRequest,
  respondToRoomInvite,
  updateNotificationPreferences
} from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  return "The notification action could not be completed.";
}

function withError(error: unknown) {
  return `/notifications?error=${encodeURIComponent(actionErrorMessage(error))}`;
}

export async function markNotificationReadAction(formData: FormData) {
  try {
    await markNotificationRead(String(formData.get("notification_id") || ""));
  } catch (error) {
    redirect(withError(error));
  }
  redirect("/notifications");
}

export async function markAllNotificationsReadAction() {
  try {
    await markAllNotificationsRead();
  } catch (error) {
    redirect(withError(error));
  }
  redirect("/notifications");
}

export async function respondToRoomInviteAction(formData: FormData) {
  let matchRoomId: string | null = null;
  const response = String(formData.get("response")) === "declined" ? "declined" : "accepted";
  try {
    const result = await respondToRoomInvite(
      String(formData.get("invite_id") || ""),
      response
    );
    matchRoomId = result.invite.match_room_id;
  } catch (error) {
    redirect(withError(error));
  }
  redirect(response === "accepted" && matchRoomId ? `/matches/${matchRoomId}` : "/notifications");
}

export async function respondToDmRequestAction(formData: FormData) {
  let channelSlug: string | null = null;
  const response = String(formData.get("response")) === "declined" ? "declined" : "accepted";
  try {
    const result = await respondDmRequest(
      String(formData.get("request_id") || ""),
      response
    );
    channelSlug = result.channel?.slug ?? result.request.channel_slug ?? null;
  } catch (error) {
    redirect(withError(error));
  }
  redirect(response === "accepted" && channelSlug ? `/chat?channel=${encodeURIComponent(channelSlug)}` : "/notifications");
}

export async function updateNotificationPreferencesAction(formData: FormData) {
  try {
    await updateNotificationPreferences({
      in_app_enabled: formData.get("in_app_enabled") === "on",
      email_enabled: formData.get("email_enabled") === "on",
      sms_enabled: formData.get("sms_enabled") === "on",
      room_invites_enabled: formData.get("room_invites_enabled") === "on",
      match_updates_enabled: formData.get("match_updates_enabled") === "on",
      marketing_enabled: formData.get("marketing_enabled") === "on"
    });
  } catch (error) {
    redirect(withError(error));
  }
  redirect("/notifications");
}
