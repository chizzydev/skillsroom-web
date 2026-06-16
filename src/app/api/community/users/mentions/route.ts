import { apiBaseUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-bridge";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to search players." } }, { status: 401 });
  const upstream = new URL("/community/users/mentions", apiBaseUrl());
  upstream.search = new URL(request.url).search;
  const response = await fetch(upstream, { headers: { accept: "application/json", authorization: `Bearer ${token}` }, cache: "no-store" });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
}
