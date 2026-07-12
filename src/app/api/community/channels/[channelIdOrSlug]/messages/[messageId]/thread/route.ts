import { apiBaseUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-bridge";
import { passthroughApiResponse } from "@/lib/api-proxy";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ channelIdOrSlug: string; messageId: string }> };
export async function GET(request: Request, context: Context) {
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to view threads." } }, { status: 401 });
  const { channelIdOrSlug, messageId } = await context.params;
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/thread`, apiBaseUrl());
  requestUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value));
  const response = await fetch(upstreamUrl, { headers: { accept: "application/json", authorization: `Bearer ${token}` }, cache: "no-store" });
  return passthroughApiResponse(response);
}
