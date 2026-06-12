import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function proxy(method: "GET" | "POST", body?: string) {
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to use DMs." } }, { status: 401 });
  }

  const response = await fetch(new URL("/community/dm-requests", apiBaseUrl()), {
    method,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(method === "POST" ? { "content-type": "application/json" } : {})
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

export function GET() {
  return proxy("GET");
}

export async function POST(request: Request) {
  return proxy("POST", await request.text());
}
