import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { readAccessToken } from "@/lib/auth-session";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const redirectTo = String(formData.get("redirect") || "/profile");
  const idToken = String(formData.get("id_token") || "");
  const accessToken = readAccessToken(request);

  if (!accessToken) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", redirectTo);
    return NextResponse.redirect(signInUrl);
  }

  const response = await fetch(`${apiBaseUrl()}/auth/google-link`, {
    method: "POST",
    headers: buildApiProxyHeaders(request, {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${accessToken}`
    }),
    body: JSON.stringify({ id_token: idToken })
  });

  const nextUrl = new URL(redirectTo, request.url);
  nextUrl.searchParams.set(response.ok ? "google_linked" : "google_link_error", response.ok ? "1" : "1");
  return NextResponse.redirect(nextUrl);
}
