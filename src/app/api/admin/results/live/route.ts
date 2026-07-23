import { NextResponse } from "next/server";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { getRoomResults, listResultClaims, type MatchEvidenceItem, type ResultClaimStatus } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

const statuses: ResultClaimStatus[] = ["submitted", "opponent_agreed", "opponent_disputed"];

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user) || !canUseAdminSection(user, "results")) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const groups = await Promise.all(statuses.map(async (status) => ({ status, rows: (await listResultClaims(status)).claims })));
    const claims = groups.flatMap((group) => group.rows);
    const roomIds = Array.from(new Set(claims.map((claim) => claim.match_room_id)));
    const roomResultEntries = await Promise.all(
      roomIds.map(async (roomId) => {
        try {
          return [roomId, await getRoomResults(roomId)] as const;
        } catch {
          return [roomId, null] as const;
        }
      })
    );
    const roomResultsById = new Map(roomResultEntries);
    const evidenceByClaimId = claims.reduce<Record<string, MatchEvidenceItem[]>>((next, claim) => {
      const roomResults = roomResultsById.get(claim.match_room_id);
      next[claim.id] = roomResults?.evidence_items.filter((item) => item.result_claim_id === claim.id) ?? [];
      return next;
    }, {});

    return NextResponse.json({
      ok: true,
      data: {
        claims,
        evidence_by_claim_id: evidenceByClaimId,
        loaded_at: new Date().toISOString()
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "RESULT_QUEUE_UNAVAILABLE" }, { status: 502 });
  }
}
