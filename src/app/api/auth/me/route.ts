import { getCurrentUser } from "@/lib/auth-bridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in." } }, { status: 401 });
  }

  return Response.json({ ok: true, data: { user } }, { headers: { "cache-control": "no-store, private" } });
}
