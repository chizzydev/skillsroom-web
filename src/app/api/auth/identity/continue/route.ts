import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { setAuthCookies } from "@/lib/auth-session";
import { redirectAfterPost } from "@/lib/redirect-response";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const wantsJson = request.headers.get("x-skillrooms-client") === "google-button";
  const redirectTo = String(formData.get("redirect") || "/");
  const idToken = String(formData.get("id_token") || "");
  const referralCode = String(formData.get("referral_code") || "").trim();
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl()}/auth/google`, {
      method: "POST",
      headers: buildApiProxyHeaders(request, { "content-type": "application/json", accept: "application/json" }),
      body: JSON.stringify({ id_token: idToken, referral_code: referralCode || undefined })
    });
  } catch {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("error", "google_api_unreachable");
    signInUrl.searchParams.set("redirect", redirectTo);
    if (referralCode) signInUrl.searchParams.set("ref", referralCode);
    if (wantsJson) {
      return NextResponse.json({ ok: false, redirect_to: signInUrl.toString(), error: "google_api_unreachable" }, { status: 502 });
    }
    return redirectAfterPost(signInUrl);
  }

  if (!response.ok) {
    let errorCode = "google_failed";
    try {
      const payload = (await response.json()) as { error?: { code?: string } };
      if (typeof payload.error?.code === "string" && payload.error.code) {
        errorCode = payload.error.code;
      }
    } catch {
      errorCode = "google_failed";
    }

    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("error", errorCode);
    signInUrl.searchParams.set("redirect", redirectTo);
    if (referralCode) signInUrl.searchParams.set("ref", referralCode);
    if (wantsJson) {
      return NextResponse.json({ ok: false, redirect_to: signInUrl.toString(), error: errorCode }, { status: 400 });
    }
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
  const destination = new URL(redirectTo, request.url);
  const nextResponse = wantsJson
    ? NextResponse.json({ ok: true, redirect_to: destination.toString() })
    : redirectAfterPost(destination);
  setAuthCookies(nextResponse, payload.data);
  return nextResponse;
}
