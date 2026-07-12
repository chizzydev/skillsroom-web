import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders, passthroughApiResponse } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ channelIdOrSlug: string; messageId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to view reactions." } }, { status: 401 });
  const { channelIdOrSlug, messageId } = await context.params;
  const response = await fetch(new URL(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/reactions`, apiBaseUrl()), {
    headers: { accept: "application/json", authorization: `Bearer ${token}` }, cache: "no-store"
  });
  return passthroughApiResponse(response);
}

export async function POST(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to react to chat messages." } }, { status: 401 });
  }

  const { channelIdOrSlug, messageId } = await context.params;
  const upstreamUrl = new URL(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/reactions`,
    apiBaseUrl()
  );

  const response = await fetch(upstreamUrl, {
    method: "POST",
    headers: buildApiProxyHeaders(request, {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    }),
    body: await request.text(),
    cache: "no-store"
  });

  return passthroughApiResponse(response);
}
