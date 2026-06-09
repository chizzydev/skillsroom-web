import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = await getAccessToken();
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "AUTH_REQUIRED" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }

  const upstreamUrl = new URL("/community/realtime/stream", apiBaseUrl());
  const requestedUrl = new URL(request.url);
  requestedUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  const response = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "text/event-stream",
      "cache-control": "no-cache",
      ...(request.headers.get("last-event-id") ? { "last-event-id": request.headers.get("last-event-id")! } : {})
    },
    cache: "no-store"
  });

  if (!response.ok || !response.body) {
    return new Response(JSON.stringify({ ok: false, error: "REALTIME_STREAM_FAILED" }), {
      status: response.status || 502,
      headers: { "content-type": "application/json" }
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}
