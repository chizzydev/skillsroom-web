import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ channelIdOrSlug: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to update typing state." } }, { status: 401 });
  }

  const { channelIdOrSlug } = await context.params;
  const response = await fetch(new URL(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/typing`, apiBaseUrl()), {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: await request.text(),
    cache: "no-store"
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}
