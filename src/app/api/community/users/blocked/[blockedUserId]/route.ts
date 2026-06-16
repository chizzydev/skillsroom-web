import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { getAccessToken } from "@/lib/auth-bridge";

type Context = { params: Promise<{ blockedUserId: string }> };

export async function DELETE(request: Request, context: Context) {
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to manage blocked users." } }, { status: 401 });
  const { blockedUserId } = await context.params;
  const response = await fetch(new URL(`/community/users/blocked/${encodeURIComponent(blockedUserId)}`, apiBaseUrl()), {
    method: "DELETE",
    headers: buildApiProxyHeaders(request, { accept: "application/json", authorization: `Bearer ${token}` }),
    cache: "no-store"
  });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
}
