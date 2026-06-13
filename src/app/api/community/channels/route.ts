import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to use community channels." } }, { status: 401 });
  }

  const response = await fetch(new URL("/community/channels", apiBaseUrl()), {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}

export async function POST(request: Request) {
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to create community channels." } }, { status: 401 });
  }

  const response = await fetch(new URL("/community/channels", apiBaseUrl()), {
    method: "POST",
    headers: buildApiProxyHeaders(request, {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    }),
    body: await request.text(),
    cache: "no-store"
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}
