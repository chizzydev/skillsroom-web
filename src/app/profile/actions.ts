"use server";

import { redirect } from "next/navigation";
import { ApiRequestError, updatePlayerProfile, upsertCommunityClan, upsertGameAccount } from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "Your profile could not be updated.";
}

function cleanOptional(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || undefined;
}

export async function updateProfileAction(formData: FormData) {
  try {
    await updatePlayerProfile({
      username: String(formData.get("username") || "").trim(),
      display_name: cleanOptional(formData.get("display_name")),
      region: String(formData.get("region") || "NG").trim(),
      city: cleanOptional(formData.get("city")),
      campus: cleanOptional(formData.get("campus")),
      timezone: String(formData.get("timezone") || "Africa/Lagos").trim(),
      bio: cleanOptional(formData.get("bio")),
      visibility: String(formData.get("visibility") || "room_participants") as "private" | "room_participants" | "public",
      age_confirmed: formData.get("age_confirmed") === "on"
    });
  } catch (error) {
    redirect(`/profile?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect("/profile?profile_updated=1");
}

export async function upsertGameAccountAction(formData: FormData) {
  try {
    await upsertGameAccount({
      game_slug: String(formData.get("game_slug") || "free-fire").trim(),
      handle: String(formData.get("handle") || "").trim(),
      external_uid: cleanOptional(formData.get("external_uid")),
      platform: String(formData.get("platform") || "mobile").trim(),
      region: String(formData.get("region") || "NG").trim(),
      is_primary: true
    });
  } catch (error) {
    redirect(`/profile?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect("/profile?game_account_saved=1#game-accounts");
}

export async function upsertCommunityClanAction(formData: FormData) {
  try {
    await upsertCommunityClan({
      name: String(formData.get("name") || "").trim(),
      tag: cleanOptional(formData.get("tag")),
      description: cleanOptional(formData.get("description")),
      region: String(formData.get("region") || "NG").trim(),
      city: cleanOptional(formData.get("city")),
      campus: cleanOptional(formData.get("campus")),
      avatar_url: cleanOptional(formData.get("avatar_url")),
      banner_url: cleanOptional(formData.get("banner_url")),
      visibility: String(formData.get("visibility") || "public").trim() as "public" | "invite_only" | "hidden",
      game_focus: String(formData.get("game_focus") || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    });
  } catch (error) {
    redirect(`/profile?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect("/profile?clan_saved=1#clan-profile");
}
