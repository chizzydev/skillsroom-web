import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { setAuthCookies } from "@/lib/auth-session";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const redirectTo = String(formData.get("redirect") || "/");
  const idToken = String(formData.get("id_token") || "");
  const referralCode = String(formData.get("referral_code") || "").trim();

  const response = await fetch(`${apiBaseUrl()}/auth/google`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ id_token: idToken, referral_code: referralCode || undefined })
  });

  if (!response.ok) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("error", "google_failed");
    signInUrl.searchParams.set("redirect", redirectTo);
    if (referralCode) signInUrl.searchParams.set("ref", referralCode);
    return NextResponse.redirect(signInUrl);
  }

  const payload = (await response.json()) as {
    data: {
      access_token: string;
      refresh_token: string;
      access_token_expires_at: string;
      refresh_token_expires_at: string;
    };
  };
  const nextResponse = NextResponse.redirect(new URL(redirectTo, request.url));
  setAuthCookies(nextResponse, payload.data);
  return nextResponse;
}
