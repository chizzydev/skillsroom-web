"use server";

import { redirect } from "next/navigation";
import { adminActionErrorMessage } from "@/lib/admin-action-errors";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import {
  applyTournamentCumulativeScores,
  createTournament,
  generateTournamentStructure,
  grantTournamentHost,
  linkTournamentMatchRooms,
  reserveTournamentRefunds,
  reserveTournamentSettlement,
  reviewTournamentMatchResult,
  reviewTournamentContribution,
  seedTournament,
  updateTournamentHostEvent,
  type TournamentCumulativeScoreResultInput,
  type TournamentEntryType,
  type TournamentFeeMode,
  type TournamentFormat,
  type TournamentHostRole,
  type TournamentPrizeDistributionMode,
  type TournamentResultReviewDecision,
  type TournamentScoringMode
} from "@/lib/match-room-api";

async function actionErrorMessage(error: unknown) {
  return adminActionErrorMessage(error, "The tournament operation could not be completed.");
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value || undefined;
}

function optionalDateTime(formData: FormData, key: string) {
  const value = optionalString(formData, key);
  return value ? new Date(value).toISOString() : undefined;
}

function nairaToMinor(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Math.max(0, Math.round(value * 100));
}

function intValue(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key) || fallback);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function fieldValue(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function tournamentEntryMode(formData: FormData): { entryType: TournamentEntryType; feeMode: TournamentFeeMode; teamMin: number; teamMax: number } {
  const mode = fieldValue(formData, "entry_mode");
  const fallbackEntryType = String(formData.get("entry_type") || "solo") as TournamentEntryType;
  const fallbackFeeMode = String(formData.get("fee_mode") || "free") as TournamentFeeMode;
  if (!mode) {
    return {
      entryType: fallbackEntryType,
      feeMode: fallbackFeeMode,
      teamMin: intValue(formData, "team_size_min", fallbackEntryType === "team" ? 2 : 1),
      teamMax: intValue(formData, "team_size_max", fallbackEntryType === "team" ? 4 : 1)
    };
  }

  const teamMode = mode.includes("team");
  const feeMode: TournamentFeeMode = mode.includes("sponsored")
    ? "sponsored"
    : mode.includes("paid")
      ? "paid"
      : "free";

  return {
    entryType: teamMode ? "team" : "solo",
    feeMode,
    teamMin: teamMode ? intValue(formData, "team_size_min", 2) : 1,
    teamMax: teamMode ? intValue(formData, "team_size_max", 4) : 1
  };
}

function tournamentPrizeModel(formData: FormData): {
  prizeDistributionMode: TournamentPrizeDistributionMode;
  sponsoredPrizePoolMinor: number;
  guaranteedPrizePoolMinor: number;
} {
  const model = fieldValue(formData, "prize_model");
  const prizeDistributionMode = (fieldValue(formData, "prize_distribution_mode") || "winner_take_all") as TournamentPrizeDistributionMode;
  if (!model) {
    return {
      prizeDistributionMode,
      sponsoredPrizePoolMinor: nairaToMinor(formData, "sponsored_prize_pool_naira"),
      guaranteedPrizePoolMinor: nairaToMinor(formData, "guaranteed_prize_pool_naira")
    };
  }

  if (model === "no_prize" || model === "entry_prize") {
    return { prizeDistributionMode, sponsoredPrizePoolMinor: 0, guaranteedPrizePoolMinor: 0 };
  }

  if (model === "sponsor_prize") {
    return {
      prizeDistributionMode,
      sponsoredPrizePoolMinor: nairaToMinor(formData, "sponsored_prize_pool_naira"),
      guaranteedPrizePoolMinor: 0
    };
  }

  if (model === "guaranteed_prize") {
    return {
      prizeDistributionMode,
      sponsoredPrizePoolMinor: 0,
      guaranteedPrizePoolMinor: nairaToMinor(formData, "guaranteed_prize_pool_naira")
    };
  }

  return {
    prizeDistributionMode,
    sponsoredPrizePoolMinor: nairaToMinor(formData, "sponsored_prize_pool_naira"),
    guaranteedPrizePoolMinor: nairaToMinor(formData, "guaranteed_prize_pool_naira")
  };
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCumulativeResults(value: string): TournamentCumulativeScoreResultInput[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [entryId, placement, score, kills, timeMs, bonusPoints, penaltyPoints] = line
        .split(/[\t,]/)
        .map((part) => part.trim());

      return {
        entry_id: entryId,
        placement: optionalNumber(placement ?? ""),
        score: optionalNumber(score ?? ""),
        kills: optionalNumber(kills ?? ""),
        time_ms: optionalNumber(timeMs ?? ""),
        bonus_points: optionalNumber(bonusPoints ?? ""),
        penalty_points: optionalNumber(penaltyPoints ?? "")
      };
    });
}

export async function createTournamentAction(formData: FormData) {
  let createdId: string;
  try {
    const entry = tournamentEntryMode(formData);
    const prize = tournamentPrizeModel(formData);
    const result = await createTournament({
      title: String(formData.get("title") || "").trim(),
      description: optionalString(formData, "description"),
      game_slug: String(formData.get("game_slug") || "").trim(),
      ruleset_slug: optionalString(formData, "ruleset_slug"),
      format: String(formData.get("format")) as TournamentFormat,
      entry_type: entry.entryType,
      fee_mode: entry.feeMode,
      scoring_mode: String(formData.get("scoring_mode")) as TournamentScoringMode,
      prize_distribution_mode: prize.prizeDistributionMode,
      currency: String(formData.get("currency") || "NGN").trim().toUpperCase(),
      entry_fee_amount_minor: entry.feeMode === "paid" || entry.feeMode === "hybrid" ? nairaToMinor(formData, "entry_fee_amount_naira") : 0,
      sponsored_prize_pool_minor: prize.sponsoredPrizePoolMinor,
      guaranteed_prize_pool_minor: prize.guaranteedPrizePoolMinor,
      commission_bps: intValue(formData, "commission_bps", 1000),
      min_entries: intValue(formData, "min_entries", 2),
      max_entries: intValue(formData, "max_entries", 16),
      team_size_min: entry.teamMin,
      team_size_max: entry.teamMax,
      registration_opens_at: optionalDateTime(formData, "registration_opens_at"),
      registration_closes_at: optionalDateTime(formData, "registration_closes_at"),
      starts_at: optionalDateTime(formData, "starts_at"),
      ends_at: optionalDateTime(formData, "ends_at"),
      settings: {
        match_check_in_required: formData.get("match_check_in_required") === "on",
        evidence_required: formData.get("evidence_required") !== "off",
        allow_waitlist: formData.get("allow_waitlist") === "on",
        tiebreakers: optionalString(formData, "tiebreakers") ?? ""
      }
    });
    createdId = result.tournament.id;
  } catch (error) {
    redirect(`/admin/tournaments?error=${encodeURIComponent(await actionErrorMessage(error))}`);
  }

  redirect(`/admin/tournaments?created=${encodeURIComponent(createdId)}`);
}

export async function reviewTournamentContributionAction(formData: FormData) {
  try {
    const stepUpToken = await requireAdminStepUpToken();
    await reviewTournamentContribution(String(formData.get("contribution_id") || ""), {
      decision: String(formData.get("decision")) === "reject" ? "reject" : "approve",
      note: optionalString(formData, "note"),
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/tournaments?error=${encodeURIComponent(await actionErrorMessage(error))}`);
  }

  redirect("/admin/tournaments");
}

export async function seedTournamentAction(formData: FormData) {
  let tournamentId = "";
  try {
    tournamentId = String(formData.get("tournament_id") || "").trim();
    const mode = String(formData.get("mode") || "registration_order") as
      | "registration_order"
      | "random"
      | "reputation"
      | "manual";
    const manualOrder = String(formData.get("entry_ids") || "")
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    await seedTournament(tournamentId, {
      mode,
      entry_ids: mode === "manual" ? manualOrder : undefined,
      reason: optionalString(formData, "reason") ?? "tournament_seeded"
    });
  } catch (error) {
    redirect(`/admin/tournaments?error=${encodeURIComponent(await actionErrorMessage(error))}`);
  }

  redirect(`/admin/tournaments?seeded=${encodeURIComponent(tournamentId)}`);
}

export async function generateTournamentStructureAction(formData: FormData) {
  let tournamentId = "";
  try {
    tournamentId = String(formData.get("tournament_id") || "").trim();
    await generateTournamentStructure(tournamentId, {
      force: formData.get("force") === "on",
      reason: optionalString(formData, "reason") ?? "tournament_structure_generated"
    });
  } catch (error) {
    redirect(`/admin/tournaments?error=${encodeURIComponent(await actionErrorMessage(error))}`);
  }

  redirect(`/admin/tournaments?structured=${encodeURIComponent(tournamentId)}`);
}

export async function linkTournamentMatchRoomsAction(formData: FormData) {
  let tournamentId = "";
  try {
    const stepUpToken = await requireAdminStepUpToken();
    tournamentId = String(formData.get("tournament_id") || "").trim();
    await linkTournamentMatchRooms(tournamentId, {
      round_id: optionalString(formData, "round_id"),
      match_id: optionalString(formData, "match_id"),
      reason: optionalString(formData, "reason") ?? "tournament_match_rooms_linked",
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/tournaments?error=${encodeURIComponent(await actionErrorMessage(error))}`);
  }

  redirect(`/admin/tournaments?linked=${encodeURIComponent(tournamentId)}`);
}

export async function applyTournamentCumulativeScoresAction(formData: FormData) {
  let tournamentId = "";
  try {
    const stepUpToken = await requireAdminStepUpToken();
    tournamentId = String(formData.get("tournament_id") || "").trim();
    const results = parseCumulativeResults(String(formData.get("results") || ""));
    await applyTournamentCumulativeScores(tournamentId, {
      match_id: String(formData.get("match_id") || "").trim(),
      results,
      reason: optionalString(formData, "reason") ?? "cumulative_scores_applied",
      metadata: { source: "admin_tournament_console" },
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/tournaments?error=${encodeURIComponent(await actionErrorMessage(error))}`);
  }

  redirect(`/admin/tournaments?scored=${encodeURIComponent(tournamentId)}`);
}

export async function reviewTournamentMatchResultAction(formData: FormData) {
  let tournamentId = "";
  try {
    const stepUpToken = await requireAdminStepUpToken();
    tournamentId = String(formData.get("tournament_id") || "").trim();
    const matchId = String(formData.get("match_id") || "").trim();
    await reviewTournamentMatchResult(tournamentId, matchId, {
      decision: String(formData.get("decision") || "mark_disputed") as TournamentResultReviewDecision,
      winning_entry_id: optionalString(formData, "winning_entry_id"),
      penalized_entry_id: optionalString(formData, "penalized_entry_id"),
      result_claim_id: optionalString(formData, "result_claim_id"),
      score_summary: optionalString(formData, "score_summary"),
      note: optionalString(formData, "note"),
      metadata: { source: "admin_tournament_console" },
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/tournaments?error=${encodeURIComponent(await actionErrorMessage(error))}`);
  }

  redirect(`/admin/tournaments?result_reviewed=${encodeURIComponent(tournamentId)}`);
}

export async function reserveTournamentSettlementAction(formData: FormData) {
  let tournamentId = "";
  try {
    const stepUpToken = await requireAdminStepUpToken();
    tournamentId = String(formData.get("tournament_id") || "").trim();
    await reserveTournamentSettlement(tournamentId, {
      notes: optionalString(formData, "notes"),
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/tournaments?error=${encodeURIComponent(await actionErrorMessage(error))}`);
  }

  redirect(`/admin/tournaments?settlement_reserved=${encodeURIComponent(tournamentId)}`);
}

export async function reserveTournamentRefundsAction(formData: FormData) {
  let tournamentId = "";
  try {
    const stepUpToken = await requireAdminStepUpToken();
    tournamentId = String(formData.get("tournament_id") || "").trim();
    await reserveTournamentRefunds(tournamentId, {
      reason: optionalString(formData, "reason") ?? "tournament_refund_reserved",
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/tournaments?error=${encodeURIComponent(await actionErrorMessage(error))}`);
  }

  redirect(`/admin/tournaments?refunds_reserved=${encodeURIComponent(tournamentId)}`);
}

export async function grantTournamentHostAction(formData: FormData) {
  let tournamentId = "";
  try {
    const stepUpToken = await requireAdminStepUpToken();
    tournamentId = String(formData.get("tournament_id") || "").trim();
    const target = optionalString(formData, "target");
    const isUserId = Boolean(target?.includes("-") || target?.startsWith("auth0|") || target?.startsWith("google:"));
    await grantTournamentHost(tournamentId, {
      user_id: isUserId ? target : undefined,
      username: isUserId ? undefined : target,
      role: String(formData.get("role") || "co_host") as TournamentHostRole,
      permissions: {
        manage_event: formData.get("manage_event") === "on",
        manage_sponsors: formData.get("manage_sponsors") === "on",
        view_finances: formData.get("view_finances") === "on"
      },
      notes: optionalString(formData, "notes"),
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/tournaments?error=${encodeURIComponent(await actionErrorMessage(error))}`);
  }

  redirect(`/admin/tournaments?host_granted=${encodeURIComponent(tournamentId)}`);
}

export async function updateTournamentHostEventAction(formData: FormData) {
  let tournamentId = "";
  try {
    const stepUpToken = await requireAdminStepUpToken();
    tournamentId = String(formData.get("tournament_id") || "").trim();
    await updateTournamentHostEvent(tournamentId, {
      title: optionalString(formData, "title"),
      description: optionalString(formData, "description"),
      registration_opens_at: optionalDateTime(formData, "registration_opens_at"),
      registration_closes_at: optionalDateTime(formData, "registration_closes_at"),
      starts_at: optionalDateTime(formData, "starts_at"),
      ends_at: optionalDateTime(formData, "ends_at"),
      settings: {
        sponsor_label: optionalString(formData, "sponsor_label"),
        sponsor_url: optionalString(formData, "sponsor_url"),
        creator_notes: optionalString(formData, "creator_notes"),
        featured: formData.get("featured") === "on"
      },
      stepUpToken
    });
  } catch (error) {
    redirect(`/admin/tournaments?error=${encodeURIComponent(await actionErrorMessage(error))}`);
  }

  redirect(`/admin/tournaments?event_updated=${encodeURIComponent(tournamentId)}`);
}
