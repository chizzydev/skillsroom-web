import { NextResponse } from "next/server";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { listPayouts, listRefunds, listSettlements, listTournamentPayouts, listTournamentRefunds, listTournamentSettlements } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user) || !canUseAdminSection(user, "settlements")) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const [settlements, payouts, refunds, tournamentSettlements, tournamentPayouts, tournamentRefunds] = await Promise.all([
      listSettlements(),
      listPayouts(),
      listRefunds(),
      listTournamentSettlements(),
      listTournamentPayouts(),
      listTournamentRefunds()
    ]);
    return NextResponse.json({
      ok: true,
      data: {
        settlements: settlements.settlements,
        payouts: payouts.payouts,
        refunds: refunds.refunds,
        tournament_settlements: tournamentSettlements.settlements,
        tournament_payouts: tournamentPayouts.payouts,
        tournament_refunds: tournamentRefunds.refunds,
        loaded_at: new Date().toISOString()
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "PAYMENT_QUEUES_UNAVAILABLE" }, { status: 502 });
  }
}
