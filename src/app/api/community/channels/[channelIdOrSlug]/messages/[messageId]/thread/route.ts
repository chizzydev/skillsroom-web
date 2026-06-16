import { apiBaseUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-bridge";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ channelIdOrSlug: string; messageId: string }> };
export async function GET(_request: Request, context: Context) {
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to view threads." } }, { status: 401 });
  const { channelIdOrSlug, messageId } = await context.params;
  const response = await fetch(new URL(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/thread`, apiBaseUrl()), { headers: { accept: "application/json", authorization: `Bearer ${token}` }, cache: "no-store" });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
}
