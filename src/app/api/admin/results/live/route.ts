import { NextResponse } from "next/server";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import {
  getRoomResults,
  listResultClaims,
  type MatchEvidenceItem,
  type MatchResultProofRequest,
  type MatchResultProofRequestResponse,
  type ResultClaimStatus
} from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

const statuses: ResultClaimStatus[] = ["submitted", "opponent_agreed", "opponent_disputed"];
const CLAIMS_PER_STATUS = 12;
const ROOM_DETAILS_LIMIT = 18;
const LIVE_HEADERS = {
  "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
  Vary: "Cookie"
};

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user) || !canUseAdminSection(user, "results")) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const groups = await Promise.all(
      statuses.map(async (status) => ({ status, rows: (await listResultClaims(status, CLAIMS_PER_STATUS)).claims }))
    );
    const claims = groups.flatMap((group) => group.rows);
    const roomIds = Array.from(new Set(claims.map((claim) => claim.match_room_id))).slice(0, ROOM_DETAILS_LIMIT);
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
    const proofRequestsByClaimId = claims.reduce<Record<string, MatchResultProofRequest[]>>((next, claim) => {
      const roomResults = roomResultsById.get(claim.match_room_id);
      next[claim.id] = roomResults?.proof_requests.filter((item) => item.result_claim_id === claim.id) ?? [];
      return next;
    }, {});
    const proofRequestResponsesByClaimId = claims.reduce<Record<string, MatchResultProofRequestResponse[]>>((next, claim) => {
      const roomResults = roomResultsById.get(claim.match_room_id);
      next[claim.id] = roomResults?.proof_request_responses.filter((item) => item.result_claim_id === claim.id) ?? [];
      return next;
    }, {});

    return NextResponse.json(
      {
        ok: true,
        data: {
          claims,
          evidence_by_claim_id: evidenceByClaimId,
          proof_requests_by_claim_id: proofRequestsByClaimId,
          proof_request_responses_by_claim_id: proofRequestResponsesByClaimId,
          loaded_at: new Date().toISOString()
        }
      },
      { headers: LIVE_HEADERS }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "RESULT_QUEUE_UNAVAILABLE" }, { status: 502 });
  }
}
