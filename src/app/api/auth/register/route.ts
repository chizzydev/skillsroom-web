import type { NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { clearAdminStepUpCookies, setAuthCookies } from "@/lib/auth-session";
import { redirectAfterPost } from "@/lib/redirect-response";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const redirectTo = String(formData.get("redirect") || "/profile");
  const referralCode = String(formData.get("referral_code") || "").trim();
  const password = String(formData.get("password") || "");
  const passwordConfirm = String(formData.get("password_confirm") || "");
  if (password !== passwordConfirm) {
    const registerUrl = new URL("/register", request.url);
    registerUrl.searchParams.set("error", "password_mismatch");
    registerUrl.searchParams.set("redirect", redirectTo);
    if (referralCode) registerUrl.searchParams.set("ref", referralCode);
    return redirectAfterPost(registerUrl);
  }

  const response = await fetch(`${apiBaseUrl()}/auth/register`, {
    method: "POST",
    headers: buildApiProxyHeaders(request, { "content-type": "application/json", accept: "application/json" }),
    body: JSON.stringify({
      email: String(formData.get("email") || "").trim(),
      username: String(formData.get("username") || "").trim(),
      password,
      password_confirm: passwordConfirm,
      referral_code: referralCode || undefined
    })
  });

  if (!response.ok) {
    const registerUrl = new URL("/register", request.url);
    registerUrl.searchParams.set("error", "register_failed");
    registerUrl.searchParams.set("redirect", redirectTo);
    if (referralCode) registerUrl.searchParams.set("ref", referralCode);
    return redirectAfterPost(registerUrl);
  }

  const payload = (await response.json()) as {
    data:
      | {
          access_token: string;
          refresh_token: string;
          access_token_expires_at: string;
          refresh_token_expires_at: string;
        }
      | {
          verification_required: true;
          email: string;
        };
  };

  if ("verification_required" in payload.data) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("verify_email", "sent");
    signInUrl.searchParams.set("email", payload.data.email);
    return redirectAfterPost(signInUrl);
  }

  const nextResponse = redirectAfterPost(new URL(redirectTo, request.url));
  clearAdminStepUpCookies(nextResponse);
  setAuthCookies(nextResponse, payload.data);
  return nextResponse;
}
