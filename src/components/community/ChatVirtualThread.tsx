"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import type { ChatAttachment, ChatMessage, ChatPresenceSummary } from "@/lib/match-room-api";
import { ChatMessageRow, type ReactionOption } from "./ChatMessageRow";
import { messageDate } from "./chat-state";
import type { ChatHydrationInclude } from "./chat-types";

type ChatVirtualThreadProps = {
  activeChannelSlug: string;
  canManageAnyPin: boolean;
  currentUserId: string;
  fullLayout: boolean;
  hydratingMessageIds: Set<string>;
  isContextView: boolean;
  isDirectMessage: boolean;
  isLoadingChannel: boolean;
  isLoadingOlder: boolean;
  isSending: boolean;
  jumpLatestToken: number;
  messages: ChatMessage[];
  pageInfoHasOlder: boolean;
  pendingJumpMessageId: string | null;
  pinnedMessageIds: Set<string>;
  presence: ChatPresenceSummary;
  reactionOptions: ReactionOption[];
  reportingIds: Set<string>;
  showJumpLatest: boolean;
  unreadMessageId: string | null;
  votingPollIds: Set<string>;
  onBeginLongPress: (message: ChatMessage, target: EventTarget | null) => void;
  onBlockUser: (message: ChatMessage) => void;
  onClearLongPress: () => void;
  onDismissFailedMessage: (message: ChatMessage) => void;
  onHydrateMessage: (message: ChatMessage, include: ChatHydrationInclude) => Promise<ChatMessage | null>;
  onJumpLatest: () => Promise<void>;
  onJumpResolved: () => void;
  onJumpToMessage: (messageId: string) => Promise<void>;
  onLoadOlder: () => Promise<void>;
  onNearLatestChange: (nearLatest: boolean) => void;
  onOpenImage: (attachment: ChatAttachment, url: string) => void;
  onOpenMessageActions: (message: ChatMessage) => void;
  onOpenMessageUserProfile: (message: ChatMessage) => void;
  onOpenThread: (message: ChatMessage) => Promise<void>;
  onReactToMessage: (message: ChatMessage, reaction: string) => void;
  onReplyToMessage: (message: ChatMessage) => void;
  onReportMessage: (message: ChatMessage) => void;
  onReportUser: (message: ChatMessage) => void;
  onRetryMessage: (message: ChatMessage) => Promise<void>;
  onStartPin: (message: ChatMessage) => void;
  onVotePoll: (message: ChatMessage, optionId: string) => Promise<void>;
};

function pulseMessage(messageId: string) {
  window.requestAnimationFrame(() => {
    const element = document.getElementById(`chat-message-${messageId}`);
    if (!element) return;
    element.animate(
      [{ outlineColor: "rgba(56, 189, 248, 0.9)" }, { outlineColor: "rgba(56, 189, 248, 0)" }],
      { duration: 1800, easing: "ease-out" }
    );
  });
}

export const ChatVirtualThread = memo(function ChatVirtualThread({
  activeChannelSlug,
  canManageAnyPin,
  currentUserId,
  fullLayout,
  hydratingMessageIds,
  isContextView,
  isDirectMessage,
  isLoadingChannel,
  isLoadingOlder,
  isSending,
  jumpLatestToken,
  messages,
  pageInfoHasOlder,
  pendingJumpMessageId,
  pinnedMessageIds,
  presence,
  reactionOptions,
  reportingIds,
  showJumpLatest,
  unreadMessageId,
  votingPollIds,
  onBeginLongPress,
  onBlockUser,
  onClearLongPress,
  onDismissFailedMessage,
  onHydrateMessage,
  onJumpLatest,
  onJumpResolved,
  onJumpToMessage,
  onLoadOlder,
  onNearLatestChange,
  onOpenImage,
  onOpenMessageActions,
  onOpenMessageUserProfile,
  onOpenThread,
  onReactToMessage,
  onReplyToMessage,
  onReportMessage,
  onReportUser,
  onRetryMessage,
  onStartPin,
  onVotePoll
}: ChatVirtualThreadProps) {
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const latestMessagesRef = useRef(messages);
  const previousFirstMessageIdRef = useRef(messages[0]?.id ?? null);
  const previousMessageCountRef = useRef(messages.length);
  const [firstItemIndex, setFirstItemIndex] = useState(() => Math.max(0, 1_000_000 - messages.length));
  const messageIndexById = useMemo(() => new Map(messages.map((message, index) => [message.id, index])), [messages]);
  latestMessagesRef.current = messages;

  useEffect(() => {
    const latestMessages = latestMessagesRef.current;
    previousFirstMessageIdRef.current = latestMessages[0]?.id ?? null;
    previousMessageCountRef.current = latestMessages.length;
    setFirstItemIndex(Math.max(0, 1_000_000 - latestMessages.length));
  }, [activeChannelSlug]);

  useEffect(() => {
    const previousFirstMessageId = previousFirstMessageIdRef.current;
    const nextFirstMessageId = messages[0]?.id ?? null;
    const previousMessageCount = previousMessageCountRef.current;
    if (previousFirstMessageId && nextFirstMessageId && previousFirstMessageId !== nextFirstMessageId && messages.length > previousMessageCount) {
      setFirstItemIndex((current) => Math.max(0, current - (messages.length - previousMessageCount)));
    }
    previousFirstMessageIdRef.current = nextFirstMessageId;
    previousMessageCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (!jumpLatestToken || !messages.length) return;
    virtuosoRef.current?.scrollToIndex({ align: "end", behavior: "smooth", index: messages.length - 1 });
  }, [jumpLatestToken, messages.length]);

  useEffect(() => {
    if (!pendingJumpMessageId) return;
    const index = messageIndexById.get(pendingJumpMessageId);
    if (index === undefined) return;
    virtuosoRef.current?.scrollToIndex({ align: "center", behavior: "smooth", index });
    const timer = window.setTimeout(() => {
      pulseMessage(pendingJumpMessageId);
      onJumpResolved();
    }, 240);
    return () => window.clearTimeout(timer);
  }, [messageIndexById, onJumpResolved, pendingJumpMessageId]);

  const Header = useCallback(() => {
    return (
      <div className="grid gap-3 pb-3 pt-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-white/10 bg-[#203244]/90 px-3 py-2 text-xs font-bold text-slate-300">
          <span>{presence.online_count} online</span>
          {presence.active.slice(0, 5).map((user) => (
            <span className="rounded-sm bg-surfaceHigh px-2 py-1" key={user.user_id}>{user.label}</span>
          ))}
        </div>
        {pageInfoHasOlder ? (
          <div className="flex justify-center">
            <button className="min-h-9 rounded-full border border-white/10 bg-[#223447] px-4 text-xs font-black text-slate-200 hover:bg-[#2c4358] disabled:cursor-wait disabled:opacity-60" data-testid="chat-load-older-messages" disabled={isLoadingOlder} onClick={() => void onLoadOlder()} type="button">{isLoadingOlder ? "Loading older..." : "Load older messages"}</button>
          </div>
        ) : null}
      </div>
    );
  }, [isLoadingOlder, onLoadOlder, pageInfoHasOlder, presence.active, presence.online_count]);

  const itemContent = useCallback((_: number, message: ChatMessage) => {
    const index = messageIndexById.get(message.id) ?? 0;
    const previous = messages[index - 1];
    const showDate = !previous || messageDate(previous.created_at) !== messageDate(message.created_at);
    const showUnread = message.id === unreadMessageId;
    const pollId = message.poll?.id ?? null;

    return (
      <div className="px-0.5 pb-2">
        {showDate ? (
          <div className="my-3 flex justify-center">
            <span className="rounded-full bg-[#223447]/90 px-3 py-1 text-xs font-black text-slate-300 shadow-tight">{messageDate(message.created_at)}</span>
          </div>
        ) : null}
        {showUnread ? (
          <div className="my-3 flex items-center gap-3" role="separator">
            <span className="h-px flex-1 bg-sky-400/50" />
            <span className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-sky-300">New messages</span>
            <span className="h-px flex-1 bg-sky-400/50" />
          </div>
        ) : null}
        <ChatMessageRow
          activeChannelSlug={activeChannelSlug}
          canManageAnyPin={canManageAnyPin}
          currentUserId={currentUserId}
          hydrating={hydratingMessageIds.has(message.id)}
          isDirectMessage={isDirectMessage}
          isPinned={pinnedMessageIds.has(message.id)}
          isReporting={reportingIds.has(message.id)}
          isRetrying={isSending && message.client_delivery_state === "failed"}
          isVotingPoll={Boolean(pollId && votingPollIds.has(pollId))}
          message={message}
          reactionOptions={reactionOptions}
          onBeginLongPress={onBeginLongPress}
          onBlockUser={onBlockUser}
          onClearLongPress={onClearLongPress}
          onDismissFailedMessage={onDismissFailedMessage}
          onHydrateMessage={onHydrateMessage}
          onJumpToMessage={onJumpToMessage}
          onOpenImage={onOpenImage}
          onOpenMessageActions={onOpenMessageActions}
          onOpenMessageUserProfile={onOpenMessageUserProfile}
          onOpenThread={onOpenThread}
          onReactToMessage={onReactToMessage}
          onReplyToMessage={onReplyToMessage}
          onReportMessage={onReportMessage}
          onReportUser={onReportUser}
          onRetryMessage={onRetryMessage}
          onStartPin={onStartPin}
          onVotePoll={onVotePoll}
        />
      </div>
    );
  }, [activeChannelSlug, canManageAnyPin, currentUserId, hydratingMessageIds, isDirectMessage, isSending, messageIndexById, messages, onBeginLongPress, onBlockUser, onClearLongPress, onDismissFailedMessage, onHydrateMessage, onJumpToMessage, onOpenImage, onOpenMessageActions, onOpenMessageUserProfile, onOpenThread, onReactToMessage, onReplyToMessage, onReportMessage, onReportUser, onRetryMessage, onStartPin, onVotePoll, pinnedMessageIds, reactionOptions, reportingIds, unreadMessageId, votingPollIds]);

  if (isLoadingChannel) {
    const loadingIsDark = fullLayout || isDirectMessage;

    return (
      <div className={["grid min-h-0 min-w-0 flex-1 place-items-center overflow-hidden p-3 sm:p-4", fullLayout ? "xl:px-6" : "h-[58vh] max-h-[58vh]"].join(" ")}>
        <div className={["mx-auto grid w-full max-w-4xl place-items-center rounded-md border border-dashed p-6 text-center", loadingIsDark ? "min-h-36 border-white/10 bg-[#203244]/80 text-slate-200" : "h-full min-h-[18rem] border-line bg-white"].join(" ")}>
          <p className={["text-sm font-black", loadingIsDark ? "text-slate-200" : "text-muted"].join(" ")}>{isDirectMessage ? "Opening conversation..." : "Loading channel..."}</p>
        </div>
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className={["grid min-h-0 min-w-0 flex-1 place-items-center overflow-hidden p-3 sm:p-4", fullLayout ? "xl:px-6" : "h-[58vh] max-h-[58vh]"].join(" ")}>
        <div className="mx-auto grid w-full max-w-2xl place-items-center rounded-2xl border border-white/10 bg-[#203244]/80 p-6 text-center text-slate-200 shadow-tight">
          <div>
            <h3 className="text-lg font-black text-white">No messages yet</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">{isDirectMessage ? "Say hello and start the conversation." : "Start the conversation in this channel."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={["relative min-h-0 min-w-0 flex-1 overflow-hidden p-3 sm:p-4", fullLayout ? "xl:px-6" : "h-[58vh] max-h-[58vh]"].join(" ")}>
      <div className="mx-auto h-full w-full max-w-4xl">
        <Virtuoso
          atBottomStateChange={onNearLatestChange}
          className="h-full overflow-x-hidden overscroll-contain"
          components={{ Header }}
          computeItemKey={(_, message) => message.id}
          data={messages}
          data-testid="chat-thread-virtual-list"
          firstItemIndex={firstItemIndex}
          followOutput={() => "smooth"}
          increaseViewportBy={{ bottom: 900, top: 900 }}
          initialTopMostItemIndex={Math.max(0, messages.length - 1)}
          itemContent={itemContent}
          ref={virtuosoRef}
          startReached={() => {
            if (pageInfoHasOlder && !isLoadingOlder) void onLoadOlder();
          }}
          style={{ height: "100%" }}
        />
      </div>
      {showJumpLatest || isContextView ? <button className="absolute bottom-5 right-5 z-10 min-h-10 rounded-full bg-sky-500 px-4 text-xs font-black text-white shadow-panel hover:bg-sky-400" data-testid="chat-jump-latest" onClick={() => void onJumpLatest()} type="button">Jump to latest</button> : null}
    </div>
  );
});
