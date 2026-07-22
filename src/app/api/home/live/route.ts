import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-bridge";
import { getPlayerHomeSummary } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const summary = await getPlayerHomeSummary();
    return NextResponse.json({ ok: true, data: summary });
  } catch {
    return NextResponse.json({ ok: false, error: "HOME_SUMMARY_UNAVAILABLE" }, { status: 502 });
  }
}
