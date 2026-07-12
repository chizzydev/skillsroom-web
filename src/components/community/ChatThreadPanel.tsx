"use client";

import type { FormEvent } from "react";
import { Virtuoso } from "react-virtuoso";
import type { ChatMessage, ChatMessagePageInfo } from "@/lib/match-room-api";
import { chatMessageMaxLength, messageTime } from "./chat-state";

type ChatThreadPanelProps = {
  body: string;
  currentUserId: string;
  isLoading: boolean;
  isLoadingOlder: boolean;
  isSending: boolean;
  messages: ChatMessage[];
  pageInfo: ChatMessagePageInfo;
  target: ChatMessage;
  onBodyChange: (body: string) => void;
  onClose: () => void;
  onLoadOlder: () => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ChatThreadPanel({
  body,
  currentUserId,
  isLoading,
  isLoadingOlder,
  isSending,
  messages,
  pageInfo,
  target,
  onBodyChange,
  onClose,
  onLoadOlder,
  onSubmit
}: ChatThreadPanelProps) {
  return (
    <div aria-label="Thread" aria-modal="true" className="fixed inset-0 z-[70] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
      <section className="grid max-h-[92svh] w-full max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-white/10 bg-[#172331] text-white shadow-panel" data-testid="chat-thread-panel">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black">Thread</h2>
            <p className="truncate text-xs text-slate-400">{target.sender_label}: {target.body || "Photo"}</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-white/10" onClick={onClose} type="button">X</button>
        </header>
        <div className="min-h-0 p-3">
          {isLoading ? <p className="p-4 text-center text-sm font-bold text-slate-400">Loading thread...</p> : (
            <Virtuoso
              className="h-full"
              data={messages}
              followOutput="smooth"
              increaseViewportBy={320}
              components={{
                Header: () => (
                  pageInfo.has_older ? (
                    <div className="pb-2">
                      <button className="min-h-10 w-full rounded-md border border-white/10 bg-white/5 text-sm font-black text-slate-200 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60" data-testid="chat-thread-load-older" disabled={isLoadingOlder || !pageInfo.older_cursor} onClick={() => void onLoadOlder()} type="button">
                        {isLoadingOlder ? "Loading older replies..." : "Load older replies"}
                      </button>
                    </div>
                  ) : null
                )
              }}
              itemContent={(_, message) => (
                <div className="pb-2">
                  <article className="rounded-md border border-white/10 bg-white/5 p-3">
                    <p className="text-xs font-black text-sky-300">{message.sender_user_id === currentUserId ? "You" : message.sender_label} <span className="text-slate-500">{messageTime(message.created_at)}</span></p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.status === "deleted" ? "This message was deleted." : message.body}</p>
                  </article>
                </div>
              )}
            />
          )}
        </div>
        <form className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-white/10 p-3" onSubmit={onSubmit}>
          <input className="min-h-11 rounded-full border border-white/10 bg-[#223447] px-4 text-base outline-none focus:border-sky-400" data-testid="chat-thread-input" maxLength={chatMessageMaxLength} onChange={(event) => onBodyChange(event.target.value)} placeholder="Reply in thread" value={body} />
          <button className="min-h-11 rounded-full bg-sky-500 px-4 font-black disabled:bg-slate-600" data-testid="chat-thread-send" disabled={isSending || !body.trim()} type="submit">{isSending ? "..." : "Send"}</button>
        </form>
      </section>
    </div>
  );
}
