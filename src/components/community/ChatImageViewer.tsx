"use client";
/* eslint-disable @next/next/no-img-element -- signed chat attachment URLs are served outside the Next image pipeline */

import type { ChatAttachment } from "@/lib/match-room-api";

type ChatImageViewerProps = {
  currentUserId: string;
  viewer: { attachment: ChatAttachment; url: string };
  onClose: () => void;
  onReportAttachment: (attachment: ChatAttachment) => Promise<void>;
};

export function ChatImageViewer({ currentUserId, viewer, onClose, onReportAttachment }: ChatImageViewerProps) {
  return (
    <div aria-label="Image viewer" aria-modal="true" className="fixed inset-0 z-[80] grid grid-rows-[auto_minmax(0,1fr)_auto] bg-black/95 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white" role="dialog">
      <header className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{viewer.attachment.uploader_label}</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">{viewer.attachment.original_name ?? "Shared image"}</p>
        </div>
        <button aria-label="Close image viewer" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-lg font-black hover:bg-white/20" onClick={onClose} type="button">X</button>
      </header>
      <div className="grid min-h-0 place-items-center overflow-auto p-2 sm:p-5">
        <img alt={viewer.attachment.alt_text ?? viewer.attachment.original_name ?? "Chat image"} className="max-h-full max-w-full object-contain" src={viewer.url} />
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2.5 sm:px-5">
        <span className="text-xs font-bold text-slate-400">{Math.max(1, Math.round(viewer.attachment.byte_size / 1024))} KB</span>
        {viewer.attachment.uploader_user_id !== currentUserId ? <button className="min-h-10 rounded-full border border-red-400/40 px-4 text-xs font-black text-red-200 hover:bg-red-500/10" onClick={() => void onReportAttachment(viewer.attachment)} type="button">Report attachment</button> : null}
      </footer>
    </div>
  );
}
