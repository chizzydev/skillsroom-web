import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { clearAuthCookies, readRefreshToken } from "@/lib/auth-session";

export async function POST(request: NextRequest) {
  const refreshToken = readRefreshToken(request);
  if (refreshToken) {
    await fetch(`${apiBaseUrl()}/auth/logout`, {
      method: "POST",
      headers: buildApiProxyHeaders(request, { "content-type": "application/json", accept: "application/json" }),
      body: JSON.stringify({ refresh_token: refreshToken })
    }).catch(() => undefined);
  }

  const response = NextResponse.redirect(new URL("/sign-in", request.url));
  clearAuthCookies(response);
  return response;
}
