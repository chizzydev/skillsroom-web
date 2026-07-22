import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-bridge";
import { getNotificationBootstrap } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const bootstrap = await getNotificationBootstrap();
    const unread = bootstrap.notifications.length;
    const pendingInvites = bootstrap.invites.length;
    const pendingDmRequests = bootstrap.requests.filter(
      (request) => request.status === "pending" && request.recipient_user_id === user.id
    ).length;
    const pendingRequests = pendingInvites + pendingDmRequests;

    return NextResponse.json({
      ok: true,
      data: {
        unread,
        pending_invites: pendingInvites,
        pending_dm_requests: pendingDmRequests,
        count: Math.max(unread, pendingRequests)
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "NOTIFICATION_COUNT_UNAVAILABLE" }, { status: 502 });
  }
}
