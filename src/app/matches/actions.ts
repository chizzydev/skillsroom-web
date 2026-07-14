"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-bridge";
import { storeEvidenceFile } from "@/lib/evidence-storage";
import { manualCollectionAccount } from "@/lib/manual-payment";
import { roomActionError, roomActionSuccess, type RoomActionState } from "@/lib/room-action-state";
import {
  archiveCommunityLivestream,
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
  respondToResultClaim,
  ApiRequestError
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
  await createCommunityLivestream({
    target_type: "match_room",
    match_room_id: matchRoomId,
    visibility: String(formData.get("visibility") || "public") as never,
    stream_role: String(formData.get("stream_role") || "official") as never,
    playback_status: String(formData.get("playback_status") || "live") as never,
    title: String(formData.get("title") || "").trim(),
    stream_url: String(formData.get("stream_url") || "").trim(),
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
  } catch (error) {
    redirect(withError("/matches/new", error));
  }

  if (!roomId) {
    redirect(withError("/matches/new", new Error("Room could not be created. Please try again.")));
  }

  redirect(`/matches/${roomId}`);
}

export async function joinMatchRoomAction(formData: FormData) {
  let roomId: string | null = null;
  const errorPath = String(formData.get("error_path") || "/matches");

  try {
    const result = await joinMatchRoom(String(formData.get("room_code") || ""));
    roomId = result.room.id;
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
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}?invite_sent=1`);
}

export async function openMatchRoomAction(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");

  try {
    await openMatchRoom(matchRoomId);
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}`);
}

export async function checkInTournamentMatchRoomAction(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");

  try {
    await checkInTournamentMatchRoom(matchRoomId);
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
    revalidateRoom(matchRoomId);
    return roomActionSuccess("Result submitted. The room will update after the review decision.");
  } catch (error) {
    return roomActionError(actionErrorMessage(error));
  }
}

export async function respondToResultClaimAction(formData: FormData) {
  const matchRoomId = String(formData.get("match_room_id") || "");

  try {
    await respondToResultClaim(String(formData.get("result_claim_id") || ""), {
      response: String(formData.get("response")) === "dispute" ? "dispute" : "agree",
      note: String(formData.get("note") || "").trim() || undefined
    });
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}`);
}

export async function createMatchLivestreamAction(formData: FormData) {
  let matchRoomId = String(formData.get("match_room_id") || "");

  try {
    matchRoomId = await createMatchLivestreamFromForm(formData);
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
  } catch (error) {
    redirect(withError(`/matches/${matchRoomId}`, error));
  }

  redirect(`/matches/${matchRoomId}?livestream_archived=${encodeURIComponent(livestreamId)}`);
}
