import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const redirectTo = String(formData.get("redirect") || "/");
  const referralCode = String(formData.get("referral_code") || "").trim();
  const nextUrl = new URL("/api/auth/identity/continue", request.url);

  if (redirectTo) nextUrl.searchParams.set("redirect", redirectTo);
  if (referralCode) nextUrl.searchParams.set("ref", referralCode);

  return NextResponse.redirect(nextUrl, { status: 307 });
}
