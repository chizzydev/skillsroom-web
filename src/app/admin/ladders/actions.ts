"use server";

import { redirect } from "next/navigation";
import { adminActionErrorMessage } from "@/lib/admin-action-errors";
import {
  publishAdminLadderSnapshot,
  refreshAdminLadderSnapshot,
  resetAdminLadderSnapshot,
  reviewAdminLadderEntry
} from "@/lib/match-room-api";

function success(message: string, snapshotId?: string) {
  const params = new URLSearchParams({ success: message });
  if (snapshotId) params.set("snapshot_id", snapshotId);
  return `/admin/ladders?${params.toString()}`;
}

export async function refreshLadderSnapshotAction(formData: FormData) {
  let snapshotId = "";
  try {
    const result = await refreshAdminLadderSnapshot({
      period: String(formData.get("period") || "daily") === "weekly" ? "weekly" : "daily",
      game_slug: String(formData.get("game_slug") || "").trim() || undefined,
      city: String(formData.get("city") || "").trim() || undefined,
      note: String(formData.get("note") || "").trim() || undefined
    });
    snapshotId = result.snapshot.id;
  } catch (error) {
    redirect(`/admin/ladders?error=${encodeURIComponent(await adminActionErrorMessage(error, "The ladder could not be refreshed."))}`);
  }

  redirect(success("Ladder refreshed and published.", snapshotId));
}

export async function publishLadderSnapshotAction(formData: FormData) {
  const snapshotId = String(formData.get("snapshot_id") || "");
  try {
    await publishAdminLadderSnapshot(snapshotId, {
      note: String(formData.get("note") || "").trim() || undefined
    });
  } catch (error) {
    redirect(`/admin/ladders?snapshot_id=${encodeURIComponent(snapshotId)}&error=${encodeURIComponent(await adminActionErrorMessage(error, "The ladder could not be published."))}`);
  }

  redirect(success("Ladder published.", snapshotId));
}

export async function resetLadderSnapshotAction(formData: FormData) {
  const snapshotId = String(formData.get("snapshot_id") || "");
  try {
    await resetAdminLadderSnapshot(snapshotId, {
      reason: String(formData.get("reason") || "").trim()
    });
  } catch (error) {
    redirect(`/admin/ladders?snapshot_id=${encodeURIComponent(snapshotId)}&error=${encodeURIComponent(await adminActionErrorMessage(error, "The ladder could not be reset."))}`);
  }

  redirect(success("Ladder reset. Refresh it when the review is ready.", snapshotId));
}

export async function reviewLadderEntryAction(formData: FormData) {
  const entryId = String(formData.get("entry_id") || "");
  const snapshotId = String(formData.get("snapshot_id") || "");
  const decision = String(formData.get("decision") || "show");
  try {
    await reviewAdminLadderEntry(entryId, {
      decision: decision === "hide" ? "hide" : decision === "hold" ? "hold" : "show",
      note: String(formData.get("note") || "").trim() || undefined
    });
  } catch (error) {
    redirect(`/admin/ladders?snapshot_id=${encodeURIComponent(snapshotId)}&error=${encodeURIComponent(await adminActionErrorMessage(error, "The ladder entry could not be reviewed."))}`);
  }

  redirect(success("Ladder entry reviewed.", snapshotId));
}
