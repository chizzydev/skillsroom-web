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
    return NextResponse.json({ ok: true, data: bootstrap });
  } catch {
    return NextResponse.json({ ok: false, error: "NOTIFICATIONS_UNAVAILABLE" }, { status: 502 });
  }
}
