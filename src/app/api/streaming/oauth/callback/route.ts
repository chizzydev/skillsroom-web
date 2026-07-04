import { NextResponse } from "next/server";
import { completeStreamingOauth } from "@/lib/match-room-api";

function profileRedirect(request: Request, params: Record<string, string>) {
  const url = new URL("/profile", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.hash = "streaming-accounts";
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");

  if (providerError) {
    return profileRedirect(request, { error: "Streaming connection was cancelled or denied." });
  }

  if (!state || !code) {
    return profileRedirect(request, { error: "Streaming connection link was incomplete. Please try again." });
  }

  try {
    const result = await completeStreamingOauth({ state, code });
    const redirectPath = result.redirect_path && result.redirect_path.startsWith("/") ? result.redirect_path : "/profile";
    const destination = new URL(redirectPath, request.url);
    destination.searchParams.set("streaming_connected", "1");
    destination.hash = "streaming-accounts";
    return NextResponse.redirect(destination);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Streaming account could not be connected.";
    return profileRedirect(request, { error: message });
  }
}
