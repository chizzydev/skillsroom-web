"use server";

import { redirect } from "next/navigation";
import {
  ApiRequestError,
  archiveCommunityAnnouncement,
  createCommunityAnnouncement,
  publishCommunityAnnouncement,
  type CommunityAnnouncementCategory,
  type CommunityAnnouncementPriority
} from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  return "The community announcement could not be completed.";
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
      summary: String(formData.get("summary") || "").trim(),
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
