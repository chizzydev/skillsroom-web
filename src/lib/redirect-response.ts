import { NextResponse } from "next/server";

export function redirectAfterPost(url: URL | string) {
  return NextResponse.redirect(url, { status: 303 });
}
