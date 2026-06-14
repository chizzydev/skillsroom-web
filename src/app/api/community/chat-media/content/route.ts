import { readChatImage } from "@/lib/chat-media-storage";
import { verifyChatMedia } from "@/lib/chat-media-signing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const media = verifyChatMedia(token);
  if (!media) return new Response("Image link expired.", { status: 403 });
  try {
    const bytes = await readChatImage(media.storageKey);
    return new Response(new Uint8Array(bytes), { headers: { "content-type": media.mimeType, "content-length": String(bytes.byteLength), "cache-control": "private, max-age=300, immutable", "x-content-type-options": "nosniff" } });
  } catch { return new Response("Image unavailable.", { status: 404 }); }
}
