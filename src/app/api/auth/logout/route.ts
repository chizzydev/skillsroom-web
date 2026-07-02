import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { clearAdminStepUpCookies, clearAuthCookies, readRefreshToken } from "@/lib/auth-session";
import { redirectAfterPost } from "@/lib/redirect-response";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/sign-in", request.url), { status: 303 });
  clearAdminStepUpCookies(response);
  clearAuthCookies(response);
  return response;
}

export async function POST(request: NextRequest) {
  const refreshToken = readRefreshToken(request);
  if (refreshToken) {
    await fetch(`${apiBaseUrl()}/auth/logout`, {
      method: "POST",
      headers: buildApiProxyHeaders(request, { "content-type": "application/json", accept: "application/json" }),
      body: JSON.stringify({ refresh_token: refreshToken })
    }).catch(() => undefined);
  }

  const response = redirectAfterPost(new URL("/sign-in", request.url));
  clearAdminStepUpCookies(response);
  clearAuthCookies(response);
  return response;
}
