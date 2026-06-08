import { NextResponse, type NextRequest } from "next/server";
import { accessTokenCookieNames } from "./lib/auth-cookies";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hasAccessTokenCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => accessTokenCookieNames().includes(cookie.name) && Boolean(cookie.value));
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

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin") && !hasAccessTokenCookie(request)) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  if (!mutatingMethods.has(request.method)) {
    const response = NextResponse.next();
    if (request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname === "/sign-in") {
      response.headers.set("Cache-Control", "no-store, private");
    }
    return response;
  }

  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
