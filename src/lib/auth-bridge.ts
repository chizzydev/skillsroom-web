import { cookies, headers } from "next/headers";
import { accessTokenCookieNames } from "./auth-cookies";
import { apiBaseUrl } from "./api";

const refreshedAccessTokenHeader = "x-skill-rooms-refreshed-access-token";

export type CurrentUser = {
  id: string;
  email?: string;
  role: "player" | "support" | "moderator" | "admin" | "owner";
  status: "active" | "locked" | "disabled";
};

export async function getAccessToken(): Promise<string | null> {
  const headerStore = await headers();
  const refreshedToken = headerStore.get(refreshedAccessTokenHeader);
  if (refreshedToken) return refreshedToken;

  const cookieStore = await cookies();
  return (
    accessTokenCookieNames()
    .map((name) => cookieStore.get(name)?.value)
      .find(Boolean) ?? null
  );
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await getAccessToken();

  if (!token) return null;

  const response = await fetch(`${apiBaseUrl()}/auth/me`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json"
    },
    cache: "no-store"
  }).catch(() => null);

  if (!response) return null;

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    ok: true;
    data: { user: CurrentUser };
  };

  return payload.data.user;
}

export async function getGoogleLinkStatus(): Promise<{
  linked: boolean;
  email: string | null;
  linked_at: string | null;
  last_login_at: string | null;
} | null> {
  const token = await getAccessToken();

  if (!token) return null;

  const response = await fetch(`${apiBaseUrl()}/auth/google-link`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json"
    },
    cache: "no-store"
  }).catch(() => null);

  if (!response) return null;

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    ok: true;
    data: {
      linked: boolean;
      email: string | null;
      linked_at: string | null;
      last_login_at: string | null;
    };
  };

  return payload.data;
}

export function canAccessAdmin(user: CurrentUser | null) {
  return Boolean(user && ["support", "moderator", "admin", "owner"].includes(user.role) && user.status === "active");
}
