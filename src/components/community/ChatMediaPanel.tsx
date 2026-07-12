"use client";

import { VirtuosoGrid } from "react-virtuoso";
import type { ChatAttachment } from "@/lib/match-room-api";
import { ChatAttachmentTile } from "./chat-media";

type ChatMediaPanelProps = {
  attachments: ChatAttachment[];
  channelSlug: string;
  error: string | null;
  hasMore: boolean;
  isLoading: boolean;
  nextBefore: string | null;
  onLoadMore: (before?: string | null) => Promise<void>;
  onOpenImage: (attachment: ChatAttachment, url: string) => void;
};

export function ChatMediaPanel({
  attachments,
  channelSlug,
  error,
  hasMore,
  isLoading,
  nextBefore,
  onLoadMore,
  onOpenImage
}: ChatMediaPanelProps) {
  const canLoadMore = hasMore && Boolean(nextBefore) && !isLoading;

  return (
    <div className="grid min-h-0 gap-3" data-testid="chat-media-panel">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Shared media and files</p>
        <span className="text-xs font-bold text-slate-500">{attachments.length}</span>
      </div>
      {error ? <p className="rounded-md border border-red-400/30 bg-red-950/30 p-3 text-sm font-bold text-red-200">{error}</p> : null}
      {attachments.length ? (
        <div className="h-[min(62svh,38rem)] min-h-80 overflow-hidden">
          <VirtuosoGrid
            className="h-full"
            data={attachments}
            endReached={() => {
              if (canLoadMore) void onLoadMore(nextBefore);
            }}
            increaseViewportBy={520}
            itemContent={(_, attachment) => (
              <ChatAttachmentTile
                attachment={attachment}
                channelSlug={channelSlug}
                className="aspect-square w-full"
                compact
                loadImageOnVisible
                onOpenImage={(url) => onOpenImage(attachment, url)}
              />
            )}
            components={{
              List: ({ style, children, ...props }) => (
                <div
                  {...props}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
                  style={style}
                >
                  {children}
                </div>
              ),
              Item: ({ children, ...props }) => (
                <div {...props} className="min-w-0 p-1" data-testid="chat-media-tile">
                  {children}
                </div>
              ),
              Footer: () => (
                <div className="col-span-full grid gap-2 py-3">
                  {isLoading ? <p className="p-2 text-center text-sm font-bold text-slate-400">Loading media...</p> : null}
                  {hasMore ? <button className="min-h-10 rounded-md border border-white/10 bg-white/5 text-sm font-black hover:bg-white/10 disabled:cursor-wait" disabled={isLoading || !nextBefore} onClick={() => void onLoadMore(nextBefore)} type="button">Load older media</button> : null}
                </div>
              )
            }}
          />
        </div>
      ) : !isLoading ? <p className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-400">Photos and files shared in this channel will appear here.</p> : null}
      {isLoading && !attachments.length ? <p className="p-4 text-center text-sm font-bold text-slate-400">Loading media...</p> : null}
    </div>
  );
}
