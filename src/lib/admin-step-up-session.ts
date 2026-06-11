import { cookies } from "next/headers";
import { adminStepUpCookieName, adminStepUpCookieNames } from "./auth-cookies";

const ADMIN_STEP_UP_WINDOW_MS = 60 * 60 * 1000;

type AdminStepUpState =
  | { unlocked: false; token: null; expiresAt: null }
  | { unlocked: true; token: string; expiresAt: string };

function parseIssuedAt(token: string) {
  const [timestamp] = token.split(".");
  const issuedAtMs = Number(timestamp);
  return Number.isFinite(issuedAtMs) ? issuedAtMs : null;
}

function nextExpiry(token: string) {
  const issuedAtMs = parseIssuedAt(token);
  if (!issuedAtMs) return null;
  const expiresAtMs = issuedAtMs + ADMIN_STEP_UP_WINDOW_MS;
  if (expiresAtMs <= Date.now()) return null;
  return new Date(expiresAtMs).toISOString();
}

export async function getAdminStepUpState(): Promise<AdminStepUpState> {
  const cookieStore = await cookies();
  const token =
    adminStepUpCookieNames()
      .map((name) => cookieStore.get(name)?.value)
      .find(Boolean) ?? null;

  if (!token) {
    return { unlocked: false, token: null, expiresAt: null };
  }

  const expiresAt = nextExpiry(token);
  if (!expiresAt) {
    return { unlocked: false, token: null, expiresAt: null };
  }

  return { unlocked: true, token, expiresAt };
}

export async function requireAdminStepUpToken() {
  const state = await getAdminStepUpState();
  if (!state.unlocked || !state.token) {
    throw new Error("Sensitive actions are locked. Confirm your password again.");
  }

  return state.token;
}

export async function persistAdminStepUpToken(token: string, expiresAt: string) {
  const cookieStore = await cookies();
  cookieStore.set(adminStepUpCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });
}

export async function clearAdminStepUpToken() {
  const cookieStore = await cookies();
  for (const name of adminStepUpCookieNames()) {
    cookieStore.delete(name);
  }
}
