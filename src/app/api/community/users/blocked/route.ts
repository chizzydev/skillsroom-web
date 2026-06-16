import { apiBaseUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-bridge";

export async function GET() {
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to manage blocked users." } }, { status: 401 });
  const response = await fetch(new URL("/community/users/blocked", apiBaseUrl()), {
    headers: { accept: "application/json", authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
}
