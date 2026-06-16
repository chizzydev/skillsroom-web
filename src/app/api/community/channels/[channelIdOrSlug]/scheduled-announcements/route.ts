import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { getAccessToken } from "@/lib/auth-bridge";
type Context = { params: Promise<{ channelIdOrSlug: string }> };
async function proxy(request: Request, context: Context, method: "GET" | "POST") {
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to manage announcements." } }, { status: 401 });
  const { channelIdOrSlug } = await context.params;
  const response = await fetch(new URL(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/scheduled-announcements`, apiBaseUrl()), { method, headers: method === "POST" ? buildApiProxyHeaders(request, { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" }) : { accept: "application/json", authorization: `Bearer ${token}` }, body: method === "POST" ? await request.text() : undefined, cache: "no-store" });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
}
export async function GET(request: Request, context: Context) { return proxy(request, context, "GET"); }
export async function POST(request: Request, context: Context) { return proxy(request, context, "POST"); }
