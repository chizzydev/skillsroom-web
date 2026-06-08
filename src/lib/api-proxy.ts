import type { NextRequest } from "next/server";

export function buildApiProxyHeaders(
  request: NextRequest,
  headers: Record<string, string | undefined>
) {
  const forwardedHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string" && value.length > 0) {
      forwardedHeaders.set(key, value);
    }
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin) forwardedHeaders.set("origin", origin);
  if (referer) forwardedHeaders.set("referer", referer);

  return forwardedHeaders;
}
