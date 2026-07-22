import { NextResponse } from "next/server";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import { adminActionErrorMessage } from "@/lib/admin-action-errors";
import {
  applyTournamentCumulativeScores,
  generateTournamentStructure,
  grantTournamentHost,
  linkTournamentMatchRooms,
  reserveTournamentRefunds,
  reserveTournamentSettlement,
  reviewTournamentContribution,
  reviewTournamentMatchResult,
  seedTournament,
  updateTournamentHostEvent,
  type TournamentCumulativeScoreResultInput,
  type TournamentHostRole,
  type TournamentResultReviewDecision
} from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

type CommandPayload = {
  command?: string;
  fields?: Record<string, string | string[] | undefined>;
};

function field(fields: CommandPayload["fields"], key: string) {
  const value = fields?.[key];
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function hasField(fields: CommandPayload["fields"], key: string) {
  const value = fields?.[key];
  if (Array.isArray(value)) return value.length > 0;
  return value != null && value !== "";
}

function optionalString(fields: CommandPayload["fields"], key: string) {
  const value = field(fields, key);
  return value || undefined;
}

function optionalDateTime(fields: CommandPayload["fields"], key: string) {
  const value = optionalString(fields, key);
  return value ? new Date(value).toISOString() : undefined;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
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

async function stepUpToken() {
  return requireAdminStepUpToken();
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user) || !canUseAdminSection(user, "tournaments")) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED", message: "Please sign in with tournament admin access." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CommandPayload;
    const fields = body.fields ?? {};
    const tournamentId = field(fields, "tournament_id");

    switch (body.command) {
      case "review_contribution": {
        await reviewTournamentContribution(field(fields, "contribution_id"), {
          decision: field(fields, "decision") === "reject" ? "reject" : "approve",
          note: optionalString(fields, "note"),
          stepUpToken: await stepUpToken()
        });
        return NextResponse.json({ ok: true, data: { tournament_id: tournamentId || null, message: "Contribution review saved." } });
      }
      case "seed": {
        const mode = field(fields, "mode") || "registration_order";
        const manualOrder = field(fields, "entry_ids")
          .split(/[\s,]+/)
          .map((value) => value.trim())
          .filter(Boolean);
        await seedTournament(tournamentId, {
          mode: mode as "registration_order" | "random" | "reputation" | "manual",
          entry_ids: mode === "manual" ? manualOrder : undefined,
          reason: optionalString(fields, "reason") ?? "tournament_seeded"
        });
        return NextResponse.json({ ok: true, data: { tournament_id: tournamentId, message: "Player order saved." } });
      }
      case "generate_structure": {
        await generateTournamentStructure(tournamentId, {
          force: hasField(fields, "force"),
          reason: optionalString(fields, "reason") ?? "tournament_structure_generated"
        });
        return NextResponse.json({ ok: true, data: { tournament_id: tournamentId, message: "Tournament matches generated." } });
      }
      case "link_match_rooms": {
        await linkTournamentMatchRooms(tournamentId, {
          round_id: optionalString(fields, "round_id"),
          match_id: optionalString(fields, "match_id"),
          reason: optionalString(fields, "reason") ?? "tournament_match_rooms_linked",
          stepUpToken: await stepUpToken()
        });
        return NextResponse.json({ ok: true, data: { tournament_id: tournamentId, message: "Match rooms linked." } });
      }
      case "apply_scores": {
        await applyTournamentCumulativeScores(tournamentId, {
          match_id: field(fields, "match_id"),
          results: parseCumulativeResults(field(fields, "results")),
          reason: optionalString(fields, "reason") ?? "cumulative_scores_applied",
          metadata: { source: "admin_tournament_console" },
          stepUpToken: await stepUpToken()
        });
        return NextResponse.json({ ok: true, data: { tournament_id: tournamentId, message: "Scores applied." } });
      }
      case "review_match_result": {
        await reviewTournamentMatchResult(tournamentId, field(fields, "match_id"), {
          decision: (field(fields, "decision") || "mark_disputed") as TournamentResultReviewDecision,
          winning_entry_id: optionalString(fields, "winning_entry_id"),
          penalized_entry_id: optionalString(fields, "penalized_entry_id"),
          result_claim_id: optionalString(fields, "result_claim_id"),
          score_summary: optionalString(fields, "score_summary"),
          note: optionalString(fields, "note"),
          metadata: { source: "admin_tournament_console" },
          stepUpToken: await stepUpToken()
        });
        return NextResponse.json({ ok: true, data: { tournament_id: tournamentId, message: "Result decision saved." } });
      }
      case "reserve_settlement": {
        await reserveTournamentSettlement(tournamentId, {
          notes: optionalString(fields, "notes"),
          stepUpToken: await stepUpToken()
        });
        return NextResponse.json({ ok: true, data: { tournament_id: tournamentId, message: "Prize payouts reserved." } });
      }
      case "reserve_refunds": {
        await reserveTournamentRefunds(tournamentId, {
          reason: optionalString(fields, "reason") ?? "tournament_refund_reserved",
          stepUpToken: await stepUpToken()
        });
        return NextResponse.json({ ok: true, data: { tournament_id: tournamentId, message: "Entry refunds reserved." } });
      }
      case "grant_host": {
        const target = optionalString(fields, "target");
        const isUserId = Boolean(target?.includes("-") || target?.startsWith("auth0|") || target?.startsWith("google:"));
        await grantTournamentHost(tournamentId, {
          user_id: isUserId ? target : undefined,
          username: isUserId ? undefined : target,
          role: (field(fields, "role") || "co_host") as TournamentHostRole,
          permissions: {
            manage_event: hasField(fields, "manage_event"),
            manage_sponsors: hasField(fields, "manage_sponsors"),
            view_finances: hasField(fields, "view_finances")
          },
          notes: optionalString(fields, "notes"),
          stepUpToken: await stepUpToken()
        });
        return NextResponse.json({ ok: true, data: { tournament_id: tournamentId, message: "Host access updated." } });
      }
      case "update_event": {
        await updateTournamentHostEvent(tournamentId, {
          title: optionalString(fields, "title"),
          description: optionalString(fields, "description"),
          registration_opens_at: optionalDateTime(fields, "registration_opens_at"),
          registration_closes_at: optionalDateTime(fields, "registration_closes_at"),
          starts_at: optionalDateTime(fields, "starts_at"),
          ends_at: optionalDateTime(fields, "ends_at"),
          settings: {
            sponsor_label: optionalString(fields, "sponsor_label"),
            sponsor_url: optionalString(fields, "sponsor_url"),
            creator_notes: optionalString(fields, "creator_notes"),
            featured: hasField(fields, "featured")
          },
          stepUpToken: await stepUpToken()
        });
        return NextResponse.json({ ok: true, data: { tournament_id: tournamentId, message: "Tournament details updated." } });
      }
      default:
        return NextResponse.json({ ok: false, error: "UNKNOWN_COMMAND", message: "Choose a valid tournament action." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "TOURNAMENT_COMMAND_FAILED", message: await adminActionErrorMessage(error, "The tournament action could not be completed.") },
      { status: 400 }
    );
  }
}
