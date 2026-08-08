import { NextResponse } from "next/server";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { listPayouts, listRefunds, listSettlements, listTournamentPayouts, listTournamentRefunds, listTournamentSettlements } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";
const LIVE_HEADERS = {
  "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
  Vary: "Cookie"
};

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user) || !canUseAdminSection(user, "settlements")) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const [
      settlements,
      queuedPayouts,
      completedPayouts,
      queuedRefunds,
      completedRefunds,
      tournamentSettlements,
      queuedTournamentPayouts,
      completedTournamentPayouts,
      queuedTournamentRefunds,
      completedTournamentRefunds
    ] = await Promise.all([
      listSettlements("payout_pending", 25),
      listPayouts("queued", 25),
      listPayouts("completed", 12),
      listRefunds("queued", 25),
      listRefunds("completed", 12),
      listTournamentSettlements("payout_pending", 25),
      listTournamentPayouts("queued", 25),
      listTournamentPayouts("completed", 12),
      listTournamentRefunds("queued", 25),
      listTournamentRefunds("completed", 12)
    ]);
    return NextResponse.json(
      {
        ok: true,
        data: {
          settlements: settlements.settlements,
          payouts: [...queuedPayouts.payouts, ...completedPayouts.payouts],
          refunds: [...queuedRefunds.refunds, ...completedRefunds.refunds],
          tournament_settlements: tournamentSettlements.settlements,
          tournament_payouts: [...queuedTournamentPayouts.payouts, ...completedTournamentPayouts.payouts],
          tournament_refunds: [...queuedTournamentRefunds.refunds, ...completedTournamentRefunds.refunds],
          loaded_at: new Date().toISOString()
        }
      },
      { headers: LIVE_HEADERS }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "PAYMENT_QUEUES_UNAVAILABLE" }, { status: 502 });
  }
}
