import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { getAccessToken } from "@/lib/auth-bridge";
type Context = { params: Promise<{ channelIdOrSlug: string; messageId: string }> };
export async function POST(request: Request, context: Context) {
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to vote." } }, { status: 401 });
  const { channelIdOrSlug, messageId } = await context.params;
  const response = await fetch(new URL(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/poll-votes`, apiBaseUrl()), { method: "POST", headers: buildApiProxyHeaders(request, { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" }), body: await request.text(), cache: "no-store" });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
}
