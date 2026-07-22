import { NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth-bridge";
import { getTournamentDetail, getTournamentFunding, getTournamentResultReviews, getWalletOverview } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

function viewerEntryIds(detail: Awaited<ReturnType<typeof getTournamentDetail>>["tournament"], userId: string) {
  const ownEntries = detail.entries.filter((entry) => entry.captain_user_id === userId).map((entry) => entry.id);
  const memberEntryIds = detail.entry_members.filter((member) => member.user_id === userId).map((member) => member.entry_id);
  return new Set([...ownEntries, ...memberEntryIds]);
}

export async function GET(_request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { tournamentId } = await context.params;

  try {
    const detailResult = await getTournamentDetail(tournamentId, "full");
    const detail = detailResult.tournament;
    const entryIds = viewerEntryIds(detail, user.id);
    const viewerIsHost = detail.hosts.some((host) => host.user_id === user.id && host.status === "active");
    const canViewSensitive = canAccessAdmin(user) || detail.created_by_user_id === user.id || viewerIsHost || entryIds.size > 0;
    const needsWallet = detail.entries.some(
      (entry) => entryIds.has(entry.id) && ["pending", "rejected"].includes(entry.funding_status) && detail.entry_fee_amount_minor > 0
    );

    const [funding, reviews, wallet] = await Promise.all([
      getTournamentFunding(tournamentId, canViewSensitive ? "full" : "summary").catch(() => null),
      canViewSensitive ? getTournamentResultReviews(tournamentId).catch(() => null) : Promise.resolve(null),
      needsWallet ? getWalletOverview().catch(() => null) : Promise.resolve(null)
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        detail,
        events: detailResult.events,
        funding,
        result_reviews: reviews?.result_reviews ?? [],
        wallet,
        current_user_id: user.id,
        current_user_role: user.role,
        viewer_entry_ids: Array.from(entryIds),
        viewer_is_host: viewerIsHost,
        can_view_sensitive: canViewSensitive,
        loaded_at: new Date().toISOString()
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "TOURNAMENT_LIVE_UNAVAILABLE" }, { status: 502 });
  }
}
