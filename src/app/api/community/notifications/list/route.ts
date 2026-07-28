import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-bridge";
import { listNotifications, type UserNotification } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") === "read" ? "read" : "unread";

  try {
    const data = await listNotifications(status as UserNotification["status"]);
    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json({ ok: false, error: "NOTIFICATIONS_UNAVAILABLE" }, { status: 502 });
  }
}
