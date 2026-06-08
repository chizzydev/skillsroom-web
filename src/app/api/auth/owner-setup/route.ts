import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { setAuthCookies } from "@/lib/auth-session";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const passwordConfirm = String(formData.get("password_confirm") || "");
  if (password !== passwordConfirm) {
    const setupUrl = new URL("/owner-setup", request.url);
    setupUrl.searchParams.set("error", "password_mismatch");
    return NextResponse.redirect(setupUrl);
  }

  const response = await fetch(`${apiBaseUrl()}/auth/owner-setup`, {
    method: "POST",
    headers: buildApiProxyHeaders(request, { "content-type": "application/json", accept: "application/json" }),
    body: JSON.stringify({
      email: String(formData.get("email") || "").trim(),
      password,
      password_confirm: passwordConfirm,
      display_name: String(formData.get("display_name") || "").trim() || undefined
    })
  });

  if (!response.ok) {
    const setupUrl = new URL("/owner-setup", request.url);
    setupUrl.searchParams.set("error", "setup_failed");
    return NextResponse.redirect(setupUrl);
  }

  const payload = (await response.json()) as {
    data: {
      access_token: string;
      refresh_token: string;
      access_token_expires_at: string;
      refresh_token_expires_at: string;
    };
  };
  const nextResponse = NextResponse.redirect(new URL("/admin", request.url));
  setAuthCookies(nextResponse, payload.data);
  return nextResponse;
}
