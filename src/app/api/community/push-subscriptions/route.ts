import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { getAccessToken } from "@/lib/auth-bridge";

async function proxy(request: Request, method: "GET" | "POST") {
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to manage push notifications." } }, { status: 401 });
  const response = await fetch(new URL("/community/push-subscriptions", apiBaseUrl()), {
    method,
    headers: method === "POST"
      ? buildApiProxyHeaders(request, { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" })
      : { accept: "application/json", authorization: `Bearer ${token}` },
    body: method === "POST" ? await request.text() : undefined,
    cache: "no-store"
  });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
}

export async function GET(request: Request) { return proxy(request, "GET"); }
export async function POST(request: Request) { return proxy(request, "POST"); }
