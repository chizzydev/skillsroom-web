import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "./lib/api";
import { accessTokenCookieNames, refreshTokenCookieNames } from "./lib/auth-cookies";
import { clearAuthCookies, setAuthCookies } from "./lib/auth-session";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const refreshBeforeExpirySeconds = 120;
const refreshedAccessTokenHeader = "x-skill-rooms-refreshed-access-token";
type RefreshSessionResult =
  | {
      access_token: string;
      refresh_token: string;
      access_token_expires_at: string;
      refresh_token_expires_at: string;
    }
  | "invalid"
  | "unavailable"
  | null;

function accessTokenCookie(request: NextRequest) {
  return request.cookies.getAll().find((cookie) => accessTokenCookieNames().includes(cookie.name) && Boolean(cookie.value))?.value ?? null;
}

function refreshTokenCookie(request: NextRequest) {
  return request.cookies.getAll().find((cookie) => refreshTokenCookieNames().includes(cookie.name) && Boolean(cookie.value))?.value ?? null;
}

function accessTokenNeedsRefresh(token: string | null) {
  if (!token) return true;

  const [, encodedPayload] = token.split(".");
  if (!encodedPayload) return false;

  try {
    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: unknown };
    if (typeof payload.exp !== "number") return false;
    return payload.exp - Math.floor(Date.now() / 1000) <= refreshBeforeExpirySeconds;
  } catch {
    return false;
  }
}

function configuredAppOrigin() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;
  try {
    return new URL(appUrl).origin;
  } catch {
    return null;
  }
}

function requestOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin;
}

function isAllowedMutationOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const expected = new Set([requestOrigin(request)]);
  const configured = configuredAppOrigin();
  if (configured) expected.add(configured);

  const source = origin || referer;
  if (!source) return process.env.NODE_ENV !== "production";

  try {
    return expected.has(new URL(source).origin);
  } catch {
    return false;
  }
}

async function refreshSession(request: NextRequest): Promise<RefreshSessionResult> {
  const refreshToken = refreshTokenCookie(request);
  if (!refreshToken) return null;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: requestOrigin(request),
        "user-agent": request.headers.get("user-agent") ?? ""
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
  } catch {
    return "unavailable";
  }

  if (!response.ok) return response.status === 401 || response.status === 403 ? "invalid" : "unavailable";

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    data?: {
      access_token: string;
      refresh_token: string;
      access_token_expires_at: string;
      refresh_token_expires_at: string;
    };
  } | null;

  return payload?.ok === true && payload.data ? payload.data : "unavailable";
}

function nextWithSession(request: NextRequest, refreshedSession: Awaited<ReturnType<typeof refreshSession>>) {
  if (!refreshedSession || refreshedSession === "invalid" || refreshedSession === "unavailable") return NextResponse.next();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(refreshedAccessTokenHeader, refreshedSession.access_token);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(request: NextRequest) {
  const token = accessTokenCookie(request);
  const needsRefresh = accessTokenNeedsRefresh(token);
  const refreshedSession = needsRefresh ? await refreshSession(request) : null;
  const authenticated = refreshedSession === "invalid"
    ? false
    : Boolean(token) || Boolean(refreshedSession);

  if (request.nextUrl.pathname.startsWith("/admin") && !authenticated) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(signInUrl);
    if (refreshedSession === "invalid") clearAuthCookies(response);
    return response;
  }

  if (!mutatingMethods.has(request.method)) {
    const response = nextWithSession(request, refreshedSession);
    if (refreshedSession && refreshedSession !== "invalid" && refreshedSession !== "unavailable") {
      setAuthCookies(response, refreshedSession);
    } else if (refreshedSession === "invalid") {
      clearAuthCookies(response);
    }
    if (request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname === "/sign-in") {
      response.headers.set("Cache-Control", "no-store, private");
    }
    return response;
  }

  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked" }, { status: 403 });
  }

  const response = nextWithSession(request, refreshedSession);
  if (refreshedSession && refreshedSession !== "invalid" && refreshedSession !== "unavailable") {
    setAuthCookies(response, refreshedSession);
  } else if (refreshedSession === "invalid") {
    clearAuthCookies(response);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
