import { NextResponse } from "next/server";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { getAdminWalletDashboard, listWalletPayoutRequests, listWalletTopups } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";
const LIVE_HEADERS = {
  "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
  Vary: "Cookie"
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user) || !canUseAdminSection(user, "wallet")) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const url = new URL(request.url);
  try {
    const [topupResult, payoutResult, dashboard] = await Promise.all([
      listWalletTopups("submitted", 25),
      listWalletPayoutRequests("requested", 25),
      getAdminWalletDashboard({
        userId: url.searchParams.get("user_id") ?? undefined,
        matchRoomId: url.searchParams.get("match_room_id") ?? undefined,
        tournamentId: url.searchParams.get("tournament_id") ?? undefined,
        limit: 25
      })
    ]);

    return NextResponse.json(
      {
        ok: true,
        data: {
          topups: topupResult.topups,
          payout_requests: payoutResult.payout_requests,
          dashboard,
          loaded_at: new Date().toISOString()
        }
      },
      { headers: LIVE_HEADERS }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "ADMIN_WALLET_QUEUE_UNAVAILABLE" }, { status: 502 });
  }
}
