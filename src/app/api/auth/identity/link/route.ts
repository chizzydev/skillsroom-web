import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
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
    return NextResponse.redirect(profileUrl);
  }

  const nextUrl = new URL(redirectTo, request.url);
  if (!response.ok) {
    nextUrl.searchParams.set("google", "link_failed");
    return NextResponse.redirect(nextUrl);
  }

  nextUrl.searchParams.set("google", "linked");
  return NextResponse.redirect(nextUrl);
}
