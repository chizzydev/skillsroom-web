import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const nextUrl = new URL("/api/auth/identity/link", request.url);
  return NextResponse.redirect(nextUrl, { status: 307 });
}
