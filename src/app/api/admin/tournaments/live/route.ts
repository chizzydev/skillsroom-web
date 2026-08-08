import { NextResponse } from "next/server";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { getTournamentDetail, listTournamentContributions, listTournaments } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";
const LIVE_TOURNAMENT_LIMIT = 24;
const CONTRIBUTION_LIMIT = 25;
const COMMAND_DETAILS_LIMIT = 8;
const LIVE_HEADERS = {
  "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
  Vary: "Cookie"
};

function commandCenterCandidates(tournaments: Awaited<ReturnType<typeof listTournaments>>["tournaments"]) {
  const liveStatuses = new Set(["registration_open", "registration_locked", "seeding", "in_progress", "awaiting_results", "under_review", "disputed", "settlement_pending"]);
  return tournaments.filter((tournament) => liveStatuses.has(tournament.status));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user) || !canUseAdminSection(user, "tournaments")) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const [tournamentResult, contributionResult] = await Promise.all([
      listTournaments({ limit: LIVE_TOURNAMENT_LIMIT, view: "list" }),
      listTournamentContributions("submitted", CONTRIBUTION_LIMIT)
    ]);
    const detailResults = await Promise.all(
      commandCenterCandidates(tournamentResult.tournaments)
        .slice(0, COMMAND_DETAILS_LIMIT)
        .map((tournament) => getTournamentDetail(tournament.id).catch(() => null))
    );

    return NextResponse.json(
      {
        ok: true,
        data: {
          tournaments: tournamentResult.tournaments,
          contributions: contributionResult.contributions,
          command_details: detailResults.filter((result): result is NonNullable<typeof result> => Boolean(result)).map((result) => result.tournament),
          command_events: Object.fromEntries(detailResults.filter((result): result is NonNullable<typeof result> => Boolean(result)).map((result) => [result.tournament.id, result.events])),
          loaded_at: new Date().toISOString()
        }
      },
      { headers: LIVE_HEADERS }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "ADMIN_TOURNAMENTS_UNAVAILABLE" }, { status: 502 });
  }
}
