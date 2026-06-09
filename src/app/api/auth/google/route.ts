import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "LEGACY_AUTH_ROUTE_DISABLED",
        message: "This legacy auth path is disabled. Use /api/auth/identity/continue."
      }
    },
    { status: 410 }
  );
}
