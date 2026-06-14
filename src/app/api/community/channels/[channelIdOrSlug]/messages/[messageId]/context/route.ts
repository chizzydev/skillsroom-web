import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ channelIdOrSlug: string; messageId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to view chat history." } }, { status: 401 });
  }
  const { channelIdOrSlug, messageId } = await context.params;
  const upstreamUrl = new URL(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/context`,
    apiBaseUrl()
  );
  const response = await fetch(upstreamUrl, {
    headers: { accept: "application/json", authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}
