import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-bridge";
import { getMatchRoomShell, getRoomFunding, getRoomResults, getWalletOverview } from "@/lib/match-room-api";
import type { RoomLiveSnapshot } from "@/components/matches/roomLiveSnapshot";

export const dynamic = "force-dynamic";

function canViewSensitiveRoomData(input: {
  role: string;
  userId: string;
  participants: Array<{ user_id: string }>;
}) {
  return input.participants.some((participant) => participant.user_id === input.userId)
    || ["moderator", "admin", "owner", "support"].includes(input.role);
}

export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { matchId } = await context.params;

  try {
    const shell = await getMatchRoomShell(matchId);
    const canViewSensitive = canViewSensitiveRoomData({
      role: user.role,
      userId: user.id,
      participants: shell.participants
    });

    const [funding, results, wallet] = canViewSensitive
      ? await Promise.all([
          getRoomFunding(matchId).catch(() => null),
          getRoomResults(matchId).catch(() => null),
          getWalletOverview().catch(() => null)
        ])
      : [null, null, null] as const;

    const snapshot: RoomLiveSnapshot = {
      room: funding?.room ? { ...shell.room, ...funding.room, participant_count: shell.room.participant_count } : shell.room,
      participants: funding?.participants?.length ? funding.participants : shell.participants,
      funding,
      results,
      wallet,
      tournament_match_check_ins: shell.tournament_match_check_ins ?? [],
      start_confirmations: shell.start_confirmations ?? [],
      current_user_id: user.id,
      current_user_role: user.role,
      loaded_at: new Date().toISOString()
    };

    return NextResponse.json({ ok: true, data: snapshot });
  } catch {
    return NextResponse.json({ ok: false, error: "ROOM_LIVE_SNAPSHOT_UNAVAILABLE" }, { status: 502 });
  }
}
