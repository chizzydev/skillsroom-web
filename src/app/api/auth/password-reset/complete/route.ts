import type { NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { redirectAfterPost } from "@/lib/redirect-response";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const passwordConfirm = String(formData.get("password_confirm") || "");

  const resetUrl = new URL("/reset-password", request.url);
  if (token) resetUrl.searchParams.set("token", token);

  if (password !== passwordConfirm) {
    resetUrl.searchParams.set("error", "password_mismatch");
    return redirectAfterPost(resetUrl);
  }

  const response = await fetch(`${apiBaseUrl()}/auth/password-reset/complete`, {
    method: "POST",
    headers: buildApiProxyHeaders(request, { "content-type": "application/json", accept: "application/json" }),
    body: JSON.stringify({ token, password })
  });

  if (!response.ok) {
    resetUrl.searchParams.set("error", "reset_failed");
    return redirectAfterPost(resetUrl);
  }

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("password_reset", "done");
  return redirectAfterPost(signInUrl);
}
