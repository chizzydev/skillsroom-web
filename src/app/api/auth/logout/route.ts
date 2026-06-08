import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { clearAuthCookies, readRefreshToken } from "@/lib/auth-session";

export async function POST(request: NextRequest) {
  const refreshToken = readRefreshToken(request);
  if (refreshToken) {
    await fetch(`${apiBaseUrl()}/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    }).catch(() => undefined);
  }

  const response = NextResponse.redirect(new URL("/sign-in", request.url));
  clearAuthCookies(response);
  return response;
}
