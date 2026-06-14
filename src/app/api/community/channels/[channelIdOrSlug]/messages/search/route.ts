import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ channelIdOrSlug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to search chat." } }, { status: 401 });
  }
  const { channelIdOrSlug } = await context.params;
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/search`, apiBaseUrl());
  requestUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value));
  const response = await fetch(upstreamUrl, {
    headers: { accept: "application/json", authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}
