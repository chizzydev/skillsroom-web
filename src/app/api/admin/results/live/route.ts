import { NextResponse } from "next/server";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { listResultClaims, type ResultClaimStatus } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

const statuses: ResultClaimStatus[] = ["submitted", "opponent_agreed", "opponent_disputed"];

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user) || !canUseAdminSection(user, "results")) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const groups = await Promise.all(statuses.map(async (status) => ({ status, rows: (await listResultClaims(status)).claims })));
    return NextResponse.json({
      ok: true,
      data: {
        claims: groups.flatMap((group) => group.rows),
        loaded_at: new Date().toISOString()
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "RESULT_QUEUE_UNAVAILABLE" }, { status: 502 });
  }
}
