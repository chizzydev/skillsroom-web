"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-bridge";
import { storeEvidenceFile } from "@/lib/evidence-storage";
import {
  archiveCommunityLivestream,
  ApiRequestError,
  archiveCommunityAnnouncement,
  checkInForTournament,
  createCommunityLivestream,
  createCommunityAnnouncement,
  publishCommunityAnnouncement,
  registerForTournament,
  submitTournamentContribution,
  type CommunityAnnouncementCategory,
  type CommunityAnnouncementPriority
} from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  return "Tournament registration could not be completed.";
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value || undefined;
}

function normalizeAccountNumber(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.replace(/\D+/g, "").trim();
  return normalized || undefined;
}

export async function registerForTournamentAction(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") || "");

  try {
    await registerForTournament(tournamentId, {
      display_name: optionalString(formData, "display_name"),
      team_name: optionalString(formData, "team_name")
    });
  } catch (error) {
    redirect(`/tournaments/${tournamentId}?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect(`/tournaments/${tournamentId}?registered=1`);
}

export async function checkInForTournamentAction(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") || "");

  try {
    await checkInForTournament(tournamentId);
  } catch (error) {
    redirect(`/tournaments/${tournamentId}?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect(`/tournaments/${tournamentId}?checked_in=1`);
}

export async function submitTournamentContributionAction(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") || "");

  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Please sign in before submitting contribution proof.");
    const amountNaira = Number(formData.get("amount_naira") || 0);
    const proofFile = formData.get("proof_file");
    const storedProof = proofFile instanceof File
      ? await storeEvidenceFile({ file: proofFile, matchRoomId: tournamentId, userId: user.id, contextType: "tournament" })
      : null;

    await submitTournamentContribution(tournamentId, {
      source: String(formData.get("source") || "participant_entries") as never,
      amount_minor: Math.round(amountNaira * 100),
      external_reference: optionalString(formData, "external_reference"),
      proof_url: storedProof?.url ?? optionalString(formData, "proof_url"),
      payout_recipient_name: optionalString(formData, "payout_recipient_name"),
      payout_bank_name: optionalString(formData, "payout_bank_name"),
      payout_account_number: normalizeAccountNumber(optionalString(formData, "payout_account_number")),
      payout_bank_code: optionalString(formData, "payout_bank_code"),
      payout_note: optionalString(formData, "payout_note"),
      notes: optionalString(formData, "notes")
    });
  } catch (error) {
    redirect(`/tournaments/${tournamentId}?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect(`/tournaments/${tournamentId}?contribution_submitted=1`);
}

export async function createTournamentAnnouncementAction(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") || "").trim();

  try {
    await createCommunityAnnouncement({
      scope: "tournament",
      tournament_id: tournamentId,
      category: String(formData.get("category") || "tournament_update") as CommunityAnnouncementCategory,
      priority: String(formData.get("priority") || "normal") as CommunityAnnouncementPriority,
      title: String(formData.get("title") || "").trim(),
      summary: String(formData.get("summary") || "").trim(),
      body: String(formData.get("body") || "").trim(),
      cta_label: optionalString(formData, "cta_label"),
      cta_url: optionalString(formData, "cta_url"),
      publish_now: formData.get("publish_now") === "on"
    });
  } catch (error) {
    redirect(`/tournaments/${tournamentId}?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect(`/tournaments/${tournamentId}?announcement_saved=1`);
}

export async function publishTournamentAnnouncementAction(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") || "").trim();
  const announcementId = String(formData.get("announcement_id") || "").trim();

  try {
    await publishCommunityAnnouncement(announcementId);
  } catch (error) {
    redirect(`/tournaments/${tournamentId}?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect(`/tournaments/${tournamentId}?announcement_published=${encodeURIComponent(announcementId)}`);
}

export async function archiveTournamentAnnouncementAction(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") || "").trim();
  const announcementId = String(formData.get("announcement_id") || "").trim();

  try {
    await archiveCommunityAnnouncement(announcementId);
  } catch (error) {
    redirect(`/tournaments/${tournamentId}?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect(`/tournaments/${tournamentId}?announcement_archived=${encodeURIComponent(announcementId)}`);
}

export async function createTournamentLivestreamAction(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") || "").trim();

  try {
    await createCommunityLivestream({
      target_type: "tournament",
      tournament_id: tournamentId,
      provider: String(formData.get("provider") || "youtube") as never,
      visibility: String(formData.get("visibility") || "public") as never,
      title: String(formData.get("title") || "").trim(),
      stream_url: String(formData.get("stream_url") || "").trim(),
      display_order: Number(formData.get("display_order") || 0),
      is_featured: formData.get("is_featured") === "on"
    });
  } catch (error) {
    redirect(`/tournaments/${tournamentId}?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect(`/tournaments/${tournamentId}?livestream_saved=1`);
}

export async function archiveTournamentLivestreamAction(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") || "").trim();
  const livestreamId = String(formData.get("livestream_id") || "").trim();

  try {
    await archiveCommunityLivestream(livestreamId);
  } catch (error) {
    redirect(`/tournaments/${tournamentId}?error=${encodeURIComponent(actionErrorMessage(error))}`);
  }

  redirect(`/tournaments/${tournamentId}?livestream_archived=${encodeURIComponent(livestreamId)}`);
}
