import { getAccessToken } from "@/lib/auth-bridge";
import { apiBaseUrl } from "@/lib/api";
import { buildApiProxyHeaders } from "@/lib/api-proxy";
import { deleteChatImage, storeChatImage } from "@/lib/chat-media-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ channelIdOrSlug: string }> };

export async function POST(request: Request, context: Context) {
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to upload an image." } }, { status: 401 });
  const { channelIdOrSlug } = await context.params;
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) return Response.json({ ok: false, error: { code: "IMAGE_REQUIRED", message: "Choose an image to upload." } }, { status: 400 });
  const base = `/community/channels/${encodeURIComponent(channelIdOrSlug)}/attachments`;
  let attachmentId: string | null = null;
  let storageKey: string | null = null;
  try {
    const reserve = await fetch(new URL(base, apiBaseUrl()), {
      method: "POST",
      headers: buildApiProxyHeaders(request, { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" }),
      body: JSON.stringify({ original_name: file.name }), cache: "no-store"
    });
    const reserved = await reserve.json() as { ok: boolean; data?: { attachment?: { id?: string } }; error?: { message?: string } };
    attachmentId = reserved.data?.attachment?.id ?? null;
    if (!reserve.ok || !attachmentId) throw new Error(reserved.error?.message ?? "Image upload could not start.");
    const stored = await storeChatImage({ file, attachmentId });
    storageKey = stored.storageKey;
    const complete = await fetch(new URL(`${base}/${attachmentId}/complete`, apiBaseUrl()), {
      method: "POST",
      headers: buildApiProxyHeaders(request, { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" }),
      body: JSON.stringify({ storage_key: stored.storageKey, mime_type: stored.mimeType, byte_size: stored.byteSize, sha256: stored.sha256 }), cache: "no-store"
    });
    const completed = await complete.text();
    if (!complete.ok) throw new Error((JSON.parse(completed) as { error?: { message?: string } }).error?.message ?? "Image upload could not finish.");
    return new Response(completed, { status: complete.status, headers: { "content-type": "application/json" } });
  } catch (error) {
    if (storageKey) await deleteChatImage(storageKey);
    if (attachmentId) await fetch(new URL(`${base}/${attachmentId}/cancel`, apiBaseUrl()), {
      method: "POST", headers: buildApiProxyHeaders(request, { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" }), body: "{}"
    }).catch(() => undefined);
    return Response.json({ ok: false, error: { code: "CHAT_IMAGE_UPLOAD_FAILED", message: error instanceof Error ? error.message : "Image upload failed." } }, { status: 400 });
  }
}
