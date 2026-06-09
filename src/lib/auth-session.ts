import { NextResponse, type NextRequest } from "next/server";
import {
  adminStepUpCookieName,
  adminStepUpCookieNames,
  accessTokenCookieName,
  accessTokenCookieNames,
  refreshTokenCookieName,
  refreshTokenCookieNames
} from "./auth-cookies";

type AuthSessionPayload = {
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
};

type AdminStepUpSessionPayload = {
  token: string;
  expires_at: string;
};

export function setAuthCookies(response: NextResponse, session: AuthSessionPayload) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(accessTokenCookieName(), session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: new Date(session.access_token_expires_at)
  });
  response.cookies.set(refreshTokenCookieName(), session.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: new Date(session.refresh_token_expires_at)
  });
}

export function clearAuthCookies(response: NextResponse) {
  for (const name of [...accessTokenCookieNames(), ...refreshTokenCookieNames(), ...adminStepUpCookieNames()]) {
    response.cookies.delete(name);
  }
}

export function clearAdminStepUpCookies(response: NextResponse) {
  for (const name of adminStepUpCookieNames()) {
    response.cookies.delete(name);
  }
}

export function readRefreshToken(request: NextRequest) {
  return (
    refreshTokenCookieNames()
      .map((name) => request.cookies.get(name)?.value)
      .find(Boolean) ?? null
  );
}

export function readAccessToken(request: NextRequest) {
  return (
    accessTokenCookieNames()
      .map((name) => request.cookies.get(name)?.value)
      .find(Boolean) ?? null
  );
}

export function setAdminStepUpCookie(response: NextResponse, session: AdminStepUpSessionPayload) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(adminStepUpCookieName(), session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: new Date(session.expires_at)
  });
}
