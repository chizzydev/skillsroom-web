import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-bridge";
import { getWalletOverview, listMyWalletPayoutRequests, listMyWalletTopups, listWalletLedger } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const [wallet, topups, payouts, ledger] = await Promise.all([
      getWalletOverview("summary"),
      listMyWalletTopups({ limit: 8 }),
      listMyWalletPayoutRequests({ limit: 8 }),
      listWalletLedger({ limit: 8 })
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        wallet,
        topups: topups.topups,
        payout_requests: payouts.payout_requests,
        ledger_entries: ledger.ledger_entries,
        loaded_at: new Date().toISOString()
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "WALLET_UNAVAILABLE" }, { status: 502 });
  }
}
