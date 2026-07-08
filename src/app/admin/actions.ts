"use server";

import { redirect } from "next/navigation";
import {
  ApiRequestError,
  archiveCommunityAnnouncement,
  createChatChannel,
  createCommunityAnnouncement,
  publishCommunityAnnouncement,
  type CommunityAnnouncementCategory,
  type CommunityAnnouncementPriority
} from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  return "The community action could not be completed.";
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value || undefined;
}

export async function createPlatformAnnouncementAction(formData: FormData) {
  try {
    await createCommunityAnnouncement({
      scope: "platform",
      category: String(formData.get("category") || "announcement") as CommunityAnnouncementCategory,
      priority: String(formData.get("priority") || "normal") as CommunityAnnouncementPriority,
      title: String(formData.get("title") || "").trim(),
      summary: optionalString(formData, "summary"),
      body: String(formData.get("body") || "").trim(),
      cta_label: optionalString(formData, "cta_label"),
      cta_url: optionalString(formData, "cta_url"),
      publish_now: formData.get("publish_now") === "on"
    });
  } catch (error) {
    redirect(`/admin?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect("/admin?announcement_saved=1");
}

export async function publishAnnouncementAction(formData: FormData) {
  const announcementId = String(formData.get("announcement_id") || "").trim();
  try {
    await publishCommunityAnnouncement(announcementId);
  } catch (error) {
    redirect(`/admin?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect(`/admin?announcement_published=${encodeURIComponent(announcementId)}`);
}

export async function archiveAnnouncementAction(formData: FormData) {
  const announcementId = String(formData.get("announcement_id") || "").trim();
  try {
    await archiveCommunityAnnouncement(announcementId);
  } catch (error) {
    redirect(`/admin?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect(`/admin?announcement_archived=${encodeURIComponent(announcementId)}`);
}

export async function createChatChannelAction(formData: FormData) {
  try {
    await createChatChannel({
      channel_type: String(formData.get("channel_type") || "group") as "game" | "tournament" | "match_room" | "group",
      title: optionalString(formData, "title"),
      slug: optionalString(formData, "slug"),
      description: optionalString(formData, "description"),
      visibility: optionalString(formData, "visibility") as "public" | "members" | "private" | undefined,
      game_slug: optionalString(formData, "game_slug"),
      tournament_id: optionalString(formData, "tournament_id"),
      match_room_id: optionalString(formData, "match_room_id")
    });
  } catch (error) {
    redirect(`/admin?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect("/admin?channel_saved=1");
}
