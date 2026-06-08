import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { clearAuthCookies, readRefreshToken, setAuthCookies } from "@/lib/auth-session";

export async function POST(request: NextRequest) {
  const refreshToken = readRefreshToken(request);
  if (!refreshToken) {
    return NextResponse.json({ error: "Refresh token is missing" }, { status: 401 });
  }

  const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: buildApiProxyHeaders(request, { "content-type": "application/json", accept: "application/json" }),
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  if (!response.ok) {
    const nextResponse = NextResponse.json({ error: "Session refresh failed" }, { status: 401 });
    clearAuthCookies(nextResponse);
    return nextResponse;
  }

  const payload = (await response.json()) as {
    data: {
      access_token: string;
      refresh_token: string;
      access_token_expires_at: string;
      refresh_token_expires_at: string;
    };
  };
  const nextResponse = NextResponse.json({ ok: true });
  setAuthCookies(nextResponse, payload.data);
  return nextResponse;
}
