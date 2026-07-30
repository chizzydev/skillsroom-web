"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-bridge";
import { storeEvidenceFile } from "@/lib/evidence-storage";
import { manualCollectionAccount } from "@/lib/manual-payment";
import { isSupportedLivestreamProvider, validateLivestreamUrl } from "@/lib/livestream-url";
import { roomActionError, roomActionSuccess, type RoomActionState } from "@/lib/room-action-state";
import { trackServerAnalyticsEvent } from "@/lib/analytics-server";
import {
  acceptMatchChallenge,
  archiveCommunityLivestream,
  createMatchChallenge,
  createMatchRoom,
  createCommunityLivestream,
  createRoomInvite,
  checkInTournamentMatchRoom,
  joinMatchRoom,
  openMatchRoom,
  payRoomWithBalance,
  startMatchPlay,
  submitManualFunding,
  submitResultClaim,
  respondToResultProofRequest,
  respondToResultClaim,
  ApiRequestError,
  type MatchChallengeSkillLevel
} from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "The match room action could not be completed.";
}

function withError(path: string, error: unknown) {
  return `${path}?error=${encodeURIComponent(actionErrorMessage(error))}`;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value || undefined;
}

function challengeSkillLevel(value: FormDataEntryValue | null): MatchChallengeSkillLevel {
  const skillLevel = String(value || "any");
  return ["beginner", "casual", "competitive", "expert", "any"].includes(skillLevel)
    ? skillLevel as MatchChallengeSkillLevel
    : "any";
}

function uploadedFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

async function payRoomWithBalanceFromForm(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");
  await payRoomWithBalance(matchRoomId);
  return matchRoomId;
}

async function submitManualFundingFromForm(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Please sign in before submitting funding proof.");
  }

  const amountNaira = Number(formData.get("amount_naira") || 0);
  const proofFile = uploadedFile(formData, "proof_file");
  const storedProof = proofFile
    ? await storeEvidenceFile({ file: proofFile, matchRoomId, userId: user.id })
    : null;

  const proofUrl = storedProof?.url ?? optionalString(formData, "proof_url");
  if (!proofUrl) {
    throw new Error("Upload a screenshot of your transfer or provide a proof link before submitting funding.");
  }

  await submitManualFunding(matchRoomId, {
    amount_minor: Math.round(amountNaira * 100),
    collection_bank_name: manualCollectionAccount.bankName,
    collection_account_number: manualCollectionAccount.accountNumber,
    collection_account_name: manualCollectionAccount.accountName,
    transfer_reference: optionalString(formData, "transfer_reference"),
    sender_account_name: String(formData.get("sender_account_name") || "").trim(),
    sender_bank_name: String(formData.get("sender_bank_name") || "").trim(),
    payout_recipient_name: optionalString(formData, "payout_recipient_name"),
    payout_bank_name: optionalString(formData, "payout_bank_name"),
    payout_account_number: optionalString(formData, "payout_account_number")?.replace(/\s+/g, ""),
    payout_bank_code: optionalString(formData, "payout_bank_code"),
    payout_note: optionalString(formData, "payout_note"),
    proof_url: proofUrl,
    proof_note: optionalString(formData, "proof_note")
  });

  return matchRoomId;
}

async function submitResultClaimFromForm(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Please sign in before submitting evidence.");
  }

  const claimedWinnerParticipantId = String(formData.get("claimed_winner_participant_id") || "").trim();
  if (!claimedWinnerParticipantId) {
    throw new Error("Choose the player who won this match before submitting the result.");
  }

  const evidenceType = String(formData.get("evidence_type") || "screenshot") as "screenshot" | "video" | "link" | "note";
  if (!["screenshot", "video"].includes(evidenceType)) {
    throw new Error("Choose Screenshot or Video as the evidence type for uploaded match proof.");
  }

  const evidenceFile = uploadedFile(formData, "evidence_file");
  if (!evidenceFile) {
    throw new Error("Upload a screenshot or video before submitting the result.");
  }

  const storedEvidence = await storeEvidenceFile({ file: evidenceFile, matchRoomId, userId: user.id });
  if (!storedEvidence) {
    throw new Error("Evidence upload could not be stored. Try the upload again.");
  }
  const evidenceTitle = optionalString(formData, "evidence_title")
    ?? (storedEvidence.evidenceType === "video" ? "Match result video evidence" : "Match result screenshot evidence");

  await submitResultClaim(matchRoomId, {
    claimed_winner_participant_id: claimedWinnerParticipantId,
    score_summary: optionalString(formData, "score_summary"),
    note: optionalString(formData, "note"),
    evidence: [
      {
        evidence_type: storedEvidence.evidenceType,
        uri: storedEvidence.url,
        title: evidenceTitle,
        notes: String(formData.get("evidence_notes") || "").trim() || undefined
      }
    ]
  });

  return matchRoomId;
}

async function createMatchLivestreamFromForm(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");
  const provider = String(formData.get("provider") || "youtube");
  const streamUrl = String(formData.get("stream_url") || "").trim();

  if (!isSupportedLivestreamProvider(provider)) {
    throw new Error("Choose YouTube, Twitch, Kick, or TikTok for this stream.");
  }

  const validationMessage = validateLivestreamUrl(provider, streamUrl);
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  await createCommunityLivestream({
    target_type: "match_room",
    match_room_id: matchRoomId,
    provider,
    visibility: String(formData.get("visibility") || "public") as never,
    stream_role: String(formData.get("stream_role") || "official") as never,
    playback_status: String(formData.get("playback_status") || "live") as never,
    title: String(formData.get("title") || "").trim(),
    stream_url: streamUrl,
    display_order: Number(formData.get("display_order") || 0),
    is_featured: formData.get("is_featured") === "on"
  });
  return matchRoomId;
}

function revalidateRoom(matchRoomId: string) {
  if (!matchRoomId) return;
  revalidatePath(`/matches/${matchRoomId}`);
  revalidatePath("/matches");
}

export async function createMatchRoomAction(formData: FormData) {
  let roomId: string | null = null;

  try {
    const entryAmountNaira = Number(formData.get("entry_amount_naira") || 0);
    const title = String(formData.get("title") || "").trim();
    const gameSlug = String(formData.get("game_slug") || "").trim();
    const rulesetSlug = String(formData.get("ruleset_slug") || "").trim();

    if (!gameSlug || !rulesetSlug) {
      throw new Error("Choose a game and ruleset before creating the room.");
    }

    const result = await createMatchRoom({
      game_slug: gameSlug,
      ruleset_slug: rulesetSlug,
      entry_amount_minor: Math.round(entryAmountNaira * 100),
      commission_bps: Number(formData.get("commission_bps") || 1000),
      title: title || undefined,
      open_on_create: true
    });

    roomId = result.room.id;
    await trackServerAnalyticsEvent({
      eventName: "room.created",
      screen: "room_create",
      path: "/matches/new",
      entityType: "match_room",
      entityId: roomId,
      matchRoomId: roomId,
      metadata: { surface: "player_web", source: "room_create_form" }
    });
  } catch (error) {
    redirect(withError("/matches/new", error));
  }

  if (!roomId) {
    redirect(withError("/matches/new", new Error("Room could not be created. Please try again.")));
  }

  redirect(`/matches/${roomId}`);
}

export async function createMatchChallengeAction(formData: FormData) {
  let challengeId: string | null = null;

  try {
    const entryAmountNaira = Number(formData.get("entry_amount_naira") || 0);
    const title = String(formData.get("title") || "").trim();
    const gameSlug = String(formData.get("game_slug") || "").trim();
    const rulesetSlug = String(formData.get("ruleset_slug") || "").trim();
    const expiryHours = Number(formData.get("expiry_hours") || 24);
    const expiresAt = new Date(Date.now() + Math.min(Math.max(expiryHours, 1), 168) * 60 * 60 * 1000).toISOString();

    if (!gameSlug || !rulesetSlug) {
      throw new Error("Choose a game and ruleset before creating the challenge.");
    }

    const result = await createMatchChallenge({
      game_slug: gameSlug,
      ruleset_slug: rulesetSlug,
      entry_amount_minor: Math.round(entryAmountNaira * 100),
      commission_bps: Number(formData.get("commission_bps") || 1000),
      title: title || undefined,
      visibility: String(formData.get("visibility") || "public") === "private" ? "private" : "public",
      platform: String(formData.get("platform") || "").trim(),
      region: String(formData.get("region") || "").trim(),
      skill_level: challengeSkillLevel(formData.get("skill_level")),
      expires_at: expiresAt
    });

    challengeId = result.challenge.id;
    await trackServerAnalyticsEvent({
      eventName: "challenge.created",
      screen: "challenges",
      path: "/challenges",
      entityType: "match_challenge",
      entityId: challengeId,
      metadata: {
        surface: "player_web",
        source: "challenge_create_form",
        mode: String(formData.get("visibility") || "public") === "private" ? "private" : "public"
      }
    });
    revalidatePath("/challenges");
    revalidatePath("/");
  } catch (error) {
    redirect(withError("/challenges", error));
  }

  redirect(`/challenges?created=${encodeURIComponent(challengeId ?? "")}`);
}

export async function acceptMatchChallengeAction(formData: FormData) {
  let roomId: string | null = null;

  try {
    const result = await acceptMatchChallenge(String(formData.get("challenge_id") || ""));
    roomId = result.room.id;
    await trackServerAnalyticsEvent({
      eventName: "challenge.accepted",
      screen: "challenges",
      path: "/challenges",
      entityType: "match_challenge",
      entityId: String(formData.get("challenge_id") || ""),
      matchRoomId: roomId,
      metadata: { surface: "player_web", source: "challenge_marketplace" }
    });
    revalidatePath("/challenges");
    revalidatePath("/");
    revalidateRoom(roomId);
  } catch (error) {
    redirect(withError("/challenges", error));
  }

  redirect(`/matches/${roomId}`);
}

export async function joinMatchRoomAction(formData: FormData) {
  let roomId: string | null = null;
  const errorPath = String(formData.get("error_path") || "/matches");

  try {
    const roomCode = String(formData.get("room_code") || "")
      .trim()
      .replace(/\s+/g, "");
    const result = await joinMatchRoom(roomCode);
    roomId = result.room.id;
    await trackServerAnalyticsEvent({
      eventName: "room.joined",
      screen: "rooms",
      path: "/matches",
      entityType: "match_room",
      entityId: roomId,
      matchRoomId: roomId,
      metadata: { surface: "player_web", source: "room_code" }
    });
  } catch (error) {
    redirect(withError(errorPath, error));
  }

  redirect(`/matches/${roomId}`);
}

export async function createRoomInviteAction(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");

  try {
    await createRoomInvite({
      match_room_id: matchRoomId,
      invitee_username: String(formData.get("invitee_username") || "").trim(),
      message: String(formData.get("message") || "").trim() || undefined
    });
    await trackServerAnalyticsEvent({
      eventName: "room.invite_sent",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", source: "room_detail" }
    });
  } catch (error) {
    redirect(`${withError(`/matches/${matchRoomId}`, error)}#invite-player`);
  }

  redirect(`/matches/${matchRoomId}?invite_sent=1#invite-player`);
}

export async function openMatchRoomAction(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");

  try {
    await openMatchRoom(matchRoomId);
    await trackServerAnalyticsEvent({
      eventName: "room.opened",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", action: "open" }
    });
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}`);
}

export async function checkInTournamentMatchRoomAction(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");

  try {
    await checkInTournamentMatchRoom(matchRoomId);
    await trackServerAnalyticsEvent({
      eventName: "tournament.check_in",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", source: "room_detail" }
    });
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}?checked_in=1`);
}

export async function startMatchPlayAction(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");
  let confirmedOnly = false;

  try {
    const result = await startMatchPlay(matchRoomId);
    if (result.room.status !== "active") {
      confirmedOnly = true;
    }
    await trackServerAnalyticsEvent({
      eventName: "room.play_started",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", status: confirmedOnly ? "confirmed" : "active" }
    });
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}?${confirmedOnly ? "play_confirmed" : "play_started"}=1`);
}

export async function startMatchPlayIslandAction(
  _state: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  const matchRoomId = String(formData.get("match_room_id") || "");

  try {
    const result = await startMatchPlay(matchRoomId);
    await trackServerAnalyticsEvent({
      eventName: "room.play_started",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", status: result.room.status === "active" ? "active" : "confirmed" }
    });
    revalidateRoom(matchRoomId);
    return roomActionSuccess(
      result.room.status === "active"
        ? "Both players are ready. The match is live."
        : "Ready confirmed. Waiting for the other player before the match goes live."
    );
  } catch (error) {
    return roomActionError(actionErrorMessage(error));
  }
}

export async function payRoomWithBalanceAction(formData: FormData) {
  let matchRoomId = String(formData.get("match_room_id") || "");

  try {
    matchRoomId = await payRoomWithBalanceFromForm(formData);
    await trackServerAnalyticsEvent({
      eventName: "room.entry_paid_balance",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", source: "skillsroom_balance" }
    });
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}?balance_funded=1`);
}

export async function payRoomWithBalanceIslandAction(
  _state: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  try {
    const matchRoomId = await payRoomWithBalanceFromForm(formData);
    await trackServerAnalyticsEvent({
      eventName: "room.entry_paid_balance",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", source: "skillsroom_balance" }
    });
    revalidateRoom(matchRoomId);
    return roomActionSuccess("Your entry fee has been locked from your Skillsroom Balance.");
  } catch (error) {
    return roomActionError(actionErrorMessage(error));
  }
}

export async function submitManualFundingAction(formData: FormData) {
  let matchRoomId = String(formData.get("match_room_id") || "");

  try {
    matchRoomId = await submitManualFundingFromForm(formData);
    await trackServerAnalyticsEvent({
      eventName: "room.funding_submitted",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", entry_type: "manual_transfer" }
    });
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}`);
}

export async function submitManualFundingIslandAction(
  _state: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  try {
    const matchRoomId = await submitManualFundingFromForm(formData);
    await trackServerAnalyticsEvent({
      eventName: "room.funding_submitted",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", entry_type: "manual_transfer" }
    });
    revalidateRoom(matchRoomId);
    return roomActionSuccess("Funding proof submitted. We will show the updated room status after review.");
  } catch (error) {
    return roomActionError(actionErrorMessage(error));
  }
}

export async function submitResultClaimAction(formData: FormData) {
  let matchRoomId = String(formData.get("match_room_id") || "");

  try {
    matchRoomId = await submitResultClaimFromForm(formData);
    await trackServerAnalyticsEvent({
      eventName: "room.result_submitted",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", source: "result_form" }
    });
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}`);
}

export async function submitResultClaimIslandAction(
  _state: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  try {
    const matchRoomId = await submitResultClaimFromForm(formData);
    await trackServerAnalyticsEvent({
      eventName: "room.result_submitted",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", source: "result_form" }
    });
    revalidateRoom(matchRoomId);
    return roomActionSuccess("Result submitted. The room will update after the review decision.");
  } catch (error) {
    return roomActionError(actionErrorMessage(error));
  }
}

export async function respondToResultClaimAction(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");

  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Please sign in before responding to the result.");
    }
    const response = String(formData.get("response")) === "dispute" ? "dispute" : "agree";
    const evidenceFile = response === "dispute" ? uploadedFile(formData, "response_evidence_file") : null;
    const storedEvidence = evidenceFile
      ? await storeEvidenceFile({ file: evidenceFile, matchRoomId, userId: user.id })
      : null;
    await respondToResultClaim(String(formData.get("result_claim_id") || ""), {
      response,
      note: String(formData.get("note") || "").trim() || undefined,
      evidence: storedEvidence
        ? [
            {
              evidence_type: storedEvidence.evidenceType,
              uri: storedEvidence.url,
              title: optionalString(formData, "response_evidence_title")
                ?? (storedEvidence.evidenceType === "video" ? "Dispute video proof" : "Dispute screenshot proof"),
              notes: optionalString(formData, "response_evidence_notes")
            }
          ]
        : undefined
    });
    await trackServerAnalyticsEvent({
      eventName: "room.result_response_submitted",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", action: response }
    });
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}`);
}

export async function respondToResultProofRequestAction(
  _state: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  const matchRoomId = String(formData.get("match_room_id") || "");

  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Please sign in before sending proof.");
    const evidenceFile = uploadedFile(formData, "proof_request_evidence_file");
    if (!evidenceFile) throw new Error("Upload the requested proof before sending your response.");
    const storedEvidence = await storeEvidenceFile({ file: evidenceFile, matchRoomId, userId: user.id });
    if (!storedEvidence) throw new Error("The proof upload could not be saved. Try again with a supported file.");
    await respondToResultProofRequest(String(formData.get("proof_request_id") || ""), {
      note: optionalString(formData, "note"),
      evidence: [
        {
          evidence_type: storedEvidence.evidenceType,
          uri: storedEvidence.url,
          title: optionalString(formData, "proof_request_evidence_title")
            ?? (storedEvidence.evidenceType === "video" ? "Requested video proof" : "Requested screenshot proof"),
          notes: optionalString(formData, "proof_request_evidence_notes")
        }
      ]
    });
    await trackServerAnalyticsEvent({
      eventName: "room.proof_response_submitted",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", source: "proof_request" }
    });
  } catch (error) {
    return roomActionError(actionErrorMessage(error));
  }

  revalidateRoom(matchRoomId);
  return roomActionSuccess("Requested proof sent. Skillsroom will continue the review.");
}

export async function createMatchLivestreamAction(formData: FormData) {
  let matchRoomId = String(formData.get("match_room_id") || "");

  try {
    matchRoomId = await createMatchLivestreamFromForm(formData);
    await trackServerAnalyticsEvent({
      eventName: "room.livestream_saved",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", source: "livestream_form" }
    });
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}?livestream_saved=1`);
}

export async function createMatchLivestreamIslandAction(
  _state: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  try {
    const matchRoomId = await createMatchLivestreamFromForm(formData);
    await trackServerAnalyticsEvent({
      eventName: "room.livestream_saved",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", source: "livestream_form" }
    });
    revalidateRoom(matchRoomId);
    return roomActionSuccess("Livestream saved. The watch room is updating now.");
  } catch (error) {
    return roomActionError(actionErrorMessage(error));
  }
}

export async function archiveMatchLivestreamAction(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");
  const livestreamId = String(formData.get("livestream_id") || "");

  try {
    await archiveCommunityLivestream(livestreamId);
    await trackServerAnalyticsEvent({
      eventName: "room.livestream_archived",
      screen: "room_detail",
      path: "/matches/[matchId]",
      entityType: "match_room",
      entityId: matchRoomId,
      matchRoomId,
      metadata: { surface: "player_web", action: "archive" }
    });
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}?livestream_archived=${encodeURIComponent(livestreamId)}`);
}
