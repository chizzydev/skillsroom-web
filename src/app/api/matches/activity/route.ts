import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-bridge";
import { loadRoomActivitySnapshot } from "@/app/matches/roomActivityData";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const url = new URL(request.url);
  const queue = url.searchParams.get("queue") ?? undefined;
  const cursor = url.searchParams.get("cursor");

  try {
    const snapshot = await loadRoomActivitySnapshot({ queue, cursor });
    return NextResponse.json({ ok: true, data: snapshot });
  } catch {
    return NextResponse.json({ ok: false, error: "ROOM_ACTIVITY_UNAVAILABLE" }, { status: 502 });
  }
}
