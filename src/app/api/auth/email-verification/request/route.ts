import type { NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { redirectAfterPost } from "@/lib/redirect-response";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const redirectTo = String(formData.get("redirect") || "/sign-in");

  await fetch(`${apiBaseUrl()}/auth/email-verification/request`, {
    method: "POST",
    headers: buildApiProxyHeaders(request, { "content-type": "application/json", accept: "application/json" }),
    body: JSON.stringify({ email })
  }).catch(() => null);

  const nextUrl = new URL(redirectTo, request.url);
  nextUrl.searchParams.set("verify_email", "resent");
  if (email) nextUrl.searchParams.set("email", email);
  return redirectAfterPost(nextUrl);
}
