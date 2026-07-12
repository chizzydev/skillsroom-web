import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ channelIdOrSlug: string; messageId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to view chat messages." } }, { status: 401 });
  }

  const { channelIdOrSlug, messageId } = await context.params;
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}`,
    apiBaseUrl()
  );
  requestUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value));

  const response = await fetch(upstreamUrl, {
    headers: buildApiProxyHeaders(request, {
      accept: "application/json",
      authorization: `Bearer ${token}`
    }),
    cache: "no-store"
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to edit chat messages." } }, { status: 401 });
  }

  const { channelIdOrSlug, messageId } = await context.params;
  const upstreamUrl = new URL(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}`,
    apiBaseUrl()
  );
  const response = await fetch(upstreamUrl, {
    method: "PATCH",
    headers: buildApiProxyHeaders(request, {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    }),
    body: await request.text(),
    cache: "no-store"
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}
