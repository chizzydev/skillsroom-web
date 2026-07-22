import { NextResponse } from "next/server";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { getAdminWalletDashboard, listWalletPayoutRequests, listWalletTopups } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user) || !canUseAdminSection(user, "wallet")) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const url = new URL(request.url);
  try {
    const [topupResult, payoutResult, dashboard] = await Promise.all([
      listWalletTopups("submitted"),
      listWalletPayoutRequests("requested"),
      getAdminWalletDashboard({
        userId: url.searchParams.get("user_id") ?? undefined,
        matchRoomId: url.searchParams.get("match_room_id") ?? undefined,
        tournamentId: url.searchParams.get("tournament_id") ?? undefined,
        limit: 100
      })
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        topups: topupResult.topups,
        payout_requests: payoutResult.payout_requests,
        dashboard,
        loaded_at: new Date().toISOString()
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "ADMIN_WALLET_QUEUE_UNAVAILABLE" }, { status: 502 });
  }
}
