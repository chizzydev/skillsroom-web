import { apiBaseUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-bridge";
type Context = { params: Promise<{ channelIdOrSlug: string; announcementId: string }> };
export async function POST(_request: Request, context: Context) {
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to manage announcements." } }, { status: 401 });
  const { channelIdOrSlug, announcementId } = await context.params;
  const response = await fetch(new URL(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/scheduled-announcements/${encodeURIComponent(announcementId)}/cancel`, apiBaseUrl()), { method: "POST", headers: { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}", cache: "no-store" });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
}
