import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";
import { signChatMedia } from "@/lib/chat-media-signing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ channelIdOrSlug: string; attachmentId: string }> };

export async function GET(_request: Request, context: Context) {
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to view this image." } }, { status: 401 });
  const { channelIdOrSlug, attachmentId } = await context.params;
  const response = await fetch(new URL(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/attachments/${encodeURIComponent(attachmentId)}/access`, apiBaseUrl()), {
    headers: { accept: "application/json", authorization: `Bearer ${token}` }, cache: "no-store"
  });
  const payload = await response.json() as { ok: boolean; data?: { storage_key: string; attachment: { mime_type: string } }; error?: unknown };
  if (!response.ok || !payload.data) return Response.json(payload, { status: response.status });
  const signed = signChatMedia({ attachmentId, channel: channelIdOrSlug, storageKey: payload.data.storage_key, mimeType: payload.data.attachment.mime_type });
  return Response.json({ ok: true, data: { url: `/api/community/chat-media/content?token=${encodeURIComponent(signed)}`, expires_in: 300 } });
}
