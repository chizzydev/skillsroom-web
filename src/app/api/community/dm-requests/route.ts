import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function proxy(request: Request, method: "GET" | "POST", body?: string) {
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to use DMs." } }, { status: 401 });
  }

  const response = await fetch(new URL("/community/dm-requests", apiBaseUrl()), {
    method,
    headers: method === "POST" ? buildApiProxyHeaders(request, {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    }) : {
      accept: "application/json",
      authorization: `Bearer ${token}`
    },
    body,
    cache: "no-store"
  });

  const responseBody = await response.text();
  return new Response(responseBody, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}

export function GET(request: Request) {
  return proxy(request, "GET");
}

export async function POST(request: Request) {
  return proxy(request, "POST", await request.text());
}
