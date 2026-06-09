import type { NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { setAuthCookies } from "@/lib/auth-session";
import { redirectAfterPost } from "@/lib/redirect-response";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const redirectTo = String(formData.get("redirect") || "/");
  const response = await fetch(`${apiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: buildApiProxyHeaders(request, { "content-type": "application/json", accept: "application/json" }),
    body: JSON.stringify({
      identifier: String(formData.get("identifier") || "").trim(),
      password: String(formData.get("password") || "")
    })
  });

  if (!response.ok) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("error", "invalid_credentials");
    signInUrl.searchParams.set("redirect", redirectTo);
    return redirectAfterPost(signInUrl);
  }

  const payload = (await response.json()) as {
    data: {
      access_token: string;
      refresh_token: string;
      access_token_expires_at: string;
      refresh_token_expires_at: string;
    };
  };
  const nextResponse = redirectAfterPost(new URL(redirectTo, request.url));
  setAuthCookies(nextResponse, payload.data);
  return nextResponse;
}
