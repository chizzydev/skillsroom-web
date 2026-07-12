"use client";
/* eslint-disable @next/next/no-img-element -- private signed URLs and local blob previews bypass the public image optimizer */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { ChatAttachment } from "@/lib/match-room-api";
import type { ApiEnvelope } from "./chat-types";
import { attachmentPreviewLabel, documentBadge, formatAttachmentSize } from "./chat-state";

const chatLoadedImageStoragePrefix = "skillsroom-chat-image-opened:";
const signedAttachmentUrlRefreshSkewMs = 15_000;
const signedAttachmentUrlFallbackTtlMs = 4 * 60_000;
const signedAttachmentUrlCache = new Map<string, { url: string; expiresAt: number }>();

function loadedImageStorageKey(attachmentId: string) {
  return `${chatLoadedImageStoragePrefix}${attachmentId}`;
}

function hasLoadedImageBefore(attachmentId: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(loadedImageStorageKey(attachmentId)) === "1";
  } catch {
    return false;
  }
}

function rememberLoadedImage(attachmentId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(loadedImageStorageKey(attachmentId), "1");
  } catch {
    // Chat image persistence is best effort.
  }
}

async function signedAttachmentUrl(channelSlug: string, attachmentId: string) {
  const cacheKey = `${channelSlug}:${attachmentId}`;
  const cached = signedAttachmentUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + signedAttachmentUrlRefreshSkewMs) return cached.url;

  const response = await fetch(`/api/community/channels/${encodeURIComponent(channelSlug)}/attachments/${encodeURIComponent(attachmentId)}/url`, { headers: { accept: "application/json" }, cache: "no-store" });
  const payload = await response.json() as ApiEnvelope<{ url: string; expires_in?: number }>;
  if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Attachment unavailable." : "Attachment unavailable.");
  const ttl = typeof payload.data.expires_in === "number" ? Math.max(5_000, payload.data.expires_in * 1000) : signedAttachmentUrlFallbackTtlMs;
  signedAttachmentUrlCache.set(cacheKey, { url: payload.data.url, expiresAt: Date.now() + ttl });
  return payload.data.url;
}

const ChatImage = memo(function ChatImage({ attachment, autoLoad, channelSlug, className, loadOnVisible, onOpen }: { attachment: ChatAttachment; autoLoad?: boolean; channelSlug: string; className?: string; loadOnVisible?: boolean; onOpen?: (url: string) => void }) {
  const [url, setUrl] = useState(attachment.client_preview_url ?? "");
  const [failed, setFailed] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const setRootRef = useCallback((node: HTMLElement | null) => {
    rootRef.current = node;
  }, []);
  const [loadRequested, setLoadRequested] = useState(() =>
    Boolean(autoLoad || attachment.client_preview_url)
  );

  useEffect(() => {
    if (autoLoad && !loadRequested) setLoadRequested(true);
  }, [autoLoad, loadRequested]);

  useEffect(() => {
    if (!loadOnVisible || loadRequested || attachment.client_preview_url || !rootRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setLoadRequested(true);
        observer.disconnect();
      }
    }, { rootMargin: "360px 0px" });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [attachment.client_preview_url, loadOnVisible, loadRequested]);

  useEffect(() => {
    if (attachment.client_preview_url) setUrl(attachment.client_preview_url);
  }, [attachment.client_preview_url]);

  useEffect(() => {
    if (!url || failed) return;
    rememberLoadedImage(attachment.id);
  }, [attachment.id, failed, url]);

  useEffect(() => {
    if (!loadRequested || attachment.client_preview_url || attachment.status !== "attached") return;
    let active = true;
    setFailed(false);
    signedAttachmentUrl(channelSlug, attachment.id)
      .then((nextUrl) => {
        if (active) {
          setUrl(nextUrl);
          rememberLoadedImage(attachment.id);
        }
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attachment.client_preview_url, attachment.id, attachment.status, channelSlug, loadRequested]);

  if (attachment.status === "hidden" || attachment.status === "deleted") {
    return <div ref={setRootRef} className={["grid min-h-28 place-items-center rounded-md border border-dashed border-white/15 bg-black/10 p-4 text-center text-xs font-bold text-slate-400", className].filter(Boolean).join(" ")}>Image removed by moderation.</div>;
  }
  if (failed) return <button ref={setRootRef} className={["grid min-h-28 place-items-center rounded-md bg-black/15 p-4 text-xs font-black text-slate-300", className].filter(Boolean).join(" ")} onClick={() => { setFailed(false); setLoadRequested(false); window.requestAnimationFrame(() => setLoadRequested(true)); }} type="button">Image unavailable. Tap to retry.</button>;
  if (!loadRequested) return <button ref={setRootRef} aria-label={`Load image from ${attachment.uploader_label}`} className={["grid place-items-center rounded-md border border-white/10 bg-black/20 p-4 text-center text-slate-200", className].filter(Boolean).join(" ")} onClick={() => setLoadRequested(true)} type="button"><span className="grid gap-2"><span aria-hidden="true" className="text-2xl">&#8595;</span><span className="text-xs font-black">{loadOnVisible ? "Image preview" : hasLoadedImageBefore(attachment.id) ? "Load again" : "Load image"}</span><span className="text-[0.68rem] font-bold text-slate-400">{Math.max(1, Math.round(attachment.byte_size / 1024))} KB</span></span></button>;
  if (!url) return <div ref={setRootRef} className={["grid animate-pulse place-items-center rounded-md bg-black/15 text-xs font-bold text-slate-400", className].filter(Boolean).join(" ")} aria-label="Loading image">Loading image...</div>;
  return <button ref={setRootRef} aria-label={`Open image from ${attachment.uploader_label}`} className={["grid h-full min-w-0 place-items-center overflow-hidden rounded-md bg-black/20", className].filter(Boolean).join(" ")} onClick={() => onOpen?.(url)} type="button"><img alt={attachment.alt_text ?? attachment.original_name ?? "Chat image"} className="h-full max-h-full w-full object-contain" loading="lazy" src={url} /></button>;
});

export const ChatAttachmentTile = memo(function ChatAttachmentTile({ attachment, autoLoadImage, channelSlug, className, compact, loadImageOnVisible, onOpenImage }: { attachment: ChatAttachment; autoLoadImage?: boolean; channelSlug: string; className?: string; compact?: boolean; loadImageOnVisible?: boolean; onOpenImage?: (url: string) => void }) {
  const [isOpening, setIsOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  if (attachment.attachment_type === "image") {
    return <ChatImage attachment={attachment} autoLoad={autoLoadImage} channelSlug={channelSlug} className={className} loadOnVisible={loadImageOnVisible} onOpen={onOpenImage} />;
  }

  const unavailable = attachment.status === "hidden" || attachment.status === "deleted" || attachment.status === "failed";

  async function openDocument() {
    if (unavailable || isOpening) return;
    setIsOpening(true);
    setFailed(false);
    try {
      const url = await signedAttachmentUrl(channelSlug, attachment.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setFailed(true);
    } finally {
      setIsOpening(false);
    }
  }

  if (compact) {
    return (
      <button
        aria-label={`Open ${attachmentPreviewLabel(attachment)}`}
        className={["grid min-w-0 content-center gap-2 overflow-hidden rounded-md border border-white/10 bg-black/15 p-3 text-center hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60", className].filter(Boolean).join(" ")}
        disabled={unavailable || isOpening}
        onClick={() => void openDocument()}
        type="button"
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-sky-400/15 font-mono text-xs font-black text-sky-200">{documentBadge(attachment.mime_type)}</span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-black text-white">{attachmentPreviewLabel(attachment)}</span>
          <span className="mt-1 block truncate text-[0.68rem] font-bold text-slate-400">
            {unavailable ? "Unavailable" : failed ? "Tap to retry" : isOpening ? "Opening..." : formatAttachmentSize(attachment.byte_size) || "Open file"}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      aria-label={`Open ${attachmentPreviewLabel(attachment)}`}
      className={["flex min-h-24 w-full min-w-0 items-center gap-3 overflow-hidden rounded-md border border-white/10 bg-black/15 p-3 text-left hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60", className].filter(Boolean).join(" ")}
      disabled={unavailable || isOpening}
      onClick={() => void openDocument()}
      type="button"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-sky-400/15 font-mono text-xs font-black text-sky-200">{documentBadge(attachment.mime_type)}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-white">{attachmentPreviewLabel(attachment)}</span>
        <span className="mt-1 block text-xs font-bold text-slate-400">
          {unavailable ? "Attachment unavailable" : failed ? "Could not open. Tap to retry." : isOpening ? "Opening..." : `Open file${formatAttachmentSize(attachment.byte_size) ? ` - ${formatAttachmentSize(attachment.byte_size)}` : ""}`}
        </span>
      </span>
    </button>
  );
});
