const MOBILE_STREAMING_CALLBACK = "skillsroom://oauth/streaming";

const FORWARDED_PARAMS = ["code", "state", "error", "error_description"] as const;

function mobileCallbackUrl(source: URL) {
  const destination = new URL(MOBILE_STREAMING_CALLBACK);

  for (const key of FORWARDED_PARAMS) {
    const value = source.searchParams.get(key);
    if (value) destination.searchParams.set(key, value);
  }

  if (!destination.searchParams.has("code") && !destination.searchParams.has("error")) {
    destination.searchParams.set("error", "missing_oauth_code");
  }

  return destination.toString();
}

export async function GET(request: Request) {
  const source = new URL(request.url);

  return new Response(null, {
    status: 302,
    headers: {
      "cache-control": "no-store",
      location: mobileCallbackUrl(source)
    }
  });
}
