import { NextResponse } from "next/server";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { listFundingSubmissions } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user) || !canUseAdminSection(user, "funding")) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const result = await listFundingSubmissions("submitted");
    return NextResponse.json({ ok: true, data: { submissions: result.submissions, loaded_at: new Date().toISOString() } });
  } catch {
    return NextResponse.json({ ok: false, error: "FUNDING_QUEUE_UNAVAILABLE" }, { status: 502 });
  }
}
