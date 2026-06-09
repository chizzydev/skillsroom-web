import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { redirectAfterPost } from "@/lib/redirect-response";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const wantsJson = request.headers.get("x-skillrooms-client") === "google-button";
  const redirectTo = String(formData.get("redirect") || "/profile");
  const idToken = String(formData.get("id_token") || "");
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl()}/auth/google/link`, {
      method: "POST",
      headers: buildApiProxyHeaders(request, { "content-type": "application/json", accept: "application/json" }),
      body: JSON.stringify({ id_token: idToken })
    });
  } catch {
    const profileUrl = new URL(redirectTo, request.url);
    profileUrl.searchParams.set("google", "link_failed");
    if (wantsJson) {
      return NextResponse.json({ ok: false, redirect_to: profileUrl.toString(), error: "link_failed" }, { status: 502 });
    }
    return redirectAfterPost(profileUrl);
  }

  const nextUrl = new URL(redirectTo, request.url);
  if (!response.ok) {
    nextUrl.searchParams.set("google", "link_failed");
    if (wantsJson) {
      return NextResponse.json({ ok: false, redirect_to: nextUrl.toString(), error: "link_failed" }, { status: 400 });
    }
    return redirectAfterPost(nextUrl);
  }

  nextUrl.searchParams.set("google", "linked");
  if (wantsJson) {
    return NextResponse.json({ ok: true, redirect_to: nextUrl.toString() });
  }
  return redirectAfterPost(nextUrl);
}
