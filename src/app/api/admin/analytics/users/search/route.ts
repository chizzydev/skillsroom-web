import { NextResponse } from "next/server";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { searchAdminAnalyticsUsers } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user) || !canUseAdminSection(user, "analytics")) {
    return NextResponse.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in with an analytics admin account." } },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const limit = Number(url.searchParams.get("limit") ?? 10);

  try {
    const result = await searchAdminAnalyticsUsers({ query, limit });
    return NextResponse.json({ ok: true, data: result });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "ANALYTICS_USER_SEARCH_UNAVAILABLE", message: "Player search is temporarily unavailable." } },
      { status: 502 }
    );
  }
}
