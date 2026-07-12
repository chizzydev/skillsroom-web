import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders, passthroughApiResponse } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ channelIdOrSlug: string }>;
};

async function proxy(request: Request, context: RouteContext, method: "GET" | "POST") {
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to use Global Chat." } }, { status: 401 });
  }

  const { channelIdOrSlug } = await context.params;
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages`, apiBaseUrl());
  requestUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value));

  const response = await fetch(upstreamUrl, {
    method,
    headers: method === "POST" ? buildApiProxyHeaders(request, {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    }) : {
      accept: "application/json",
      authorization: `Bearer ${token}`
    },
    body: method === "POST" ? await request.text() : undefined,
    cache: "no-store"
  });

  return passthroughApiResponse(response);
}

export function GET(request: Request, context: RouteContext) {
  return proxy(request, context, "GET");
}

export function POST(request: Request, context: RouteContext) {
  return proxy(request, context, "POST");
}
