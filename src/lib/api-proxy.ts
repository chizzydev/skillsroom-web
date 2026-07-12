export function buildApiProxyHeaders(
  request: Request,
  headers: Record<string, string | undefined>
) {
  const forwardedHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string" && value.length > 0) {
      forwardedHeaders.set(key, value);
    }
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const referer = request.headers.get("referer");

  if (origin) forwardedHeaders.set("origin", origin);
  if (referer) forwardedHeaders.set("referer", referer);

  return forwardedHeaders;
}

export function passthroughApiResponse(response: Response) {
  const headers = new Headers();
  for (const key of ["content-type", "cache-control", "etag", "last-modified"]) {
    const value = response.headers.get(key);
    if (value) headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
