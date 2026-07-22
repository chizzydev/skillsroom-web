"use client";

import { memo, useCallback, useMemo } from "react";
import type { ChatAttachment, ChatMessage } from "@/lib/match-room-api";
import { ChatAttachmentTile } from "./chat-media";
import {
  displayHandle,
  initials,
  messageAttachmentCount,
  messageAttachmentSummary,
  messageHasDetail,
  messagePollSummary,
  messageTime
} from "./chat-state";
import type { ChatHydrationInclude } from "./chat-types";

export type ReactionOption = {
  key: string;
  label: string;
};

type ChatMessageRowProps = {
  activeChannelSlug: string;
  canManageAnyPin: boolean;
  currentUserId: string;
  hydrating: boolean;
  isDirectMessage: boolean;
  isPinned: boolean;
  isReporting: boolean;
  isRetrying: boolean;
  isVotingPoll: boolean;
  message: ChatMessage;
  reactionOptions: ReactionOption[];
  onBeginLongPress: (message: ChatMessage, target: EventTarget | null) => void;
  onBlockUser: (message: ChatMessage) => void;
  onClearLongPress: () => void;
  onDismissFailedMessage: (message: ChatMessage) => void;
  onHydrateMessage: (message: ChatMessage, include: ChatHydrationInclude) => Promise<ChatMessage | null>;
  onJumpToMessage: (messageId: string) => Promise<void>;
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

function renderMessageBody(body: string) {
  return body.split(/(@[A-Za-z0-9_]{3,24})/g).map((part, index) => (
    /^@[A-Za-z0-9_]{3,24}$/.test(part)
      ? <span className="font-black text-cyan" key={`${part}-${index}`}>{part}</span>
      : <span key={`${part}-${index}`}>{part}</span>
  ));
}

type ReplyPreviewProps = {
  mine: boolean;
  message: ChatMessage;
  onJumpToMessage: (messageId: string) => Promise<void>;
};

const ReplyPreview = memo(function ReplyPreview({ mine, message, onJumpToMessage }: ReplyPreviewProps) {
  const handleJump = useCallback(() => {
    if (message.reply_to_message_id) void onJumpToMessage(message.reply_to_message_id);
  }, [message.reply_to_message_id, onJumpToMessage]);

  if (!message.reply_to_message_id) return null;

  return (
    <button
      className={["mt-1 grid w-full gap-1 rounded-md border-l-4 px-3 py-2 text-left", mine ? "border-emerald-500 bg-white/70" : "border-sky-400 bg-white/10"].join(" ")}
      onClick={handleJump}
      type="button"
    >
      <span className={["text-xs font-black", mine ? "text-cyan" : "text-sky-300"].join(" ")}>{message.reply_to_sender_label ?? "Earlier message"}</span>
      <span className={["max-h-10 overflow-hidden text-xs", mine ? "text-muted" : "text-slate-300"].join(" ")}>{message.reply_to_body ?? "Message unavailable"}</span>
    </button>
  );
});

type AttachmentPreviewProps = {
  activeChannelSlug: string;
  attachment: ChatAttachment;
  autoLoadImage: boolean;
  className: string;
  onOpenImage: (attachment: ChatAttachment, url: string) => void;
};

const AttachmentPreview = memo(function AttachmentPreview({ activeChannelSlug, attachment, autoLoadImage, className, onOpenImage }: AttachmentPreviewProps) {
  const handleOpenImage = useCallback((url: string) => {
    onOpenImage(attachment, url);
  }, [attachment, onOpenImage]);

  return (
    <ChatAttachmentTile
      attachment={attachment}
      autoLoadImage={autoLoadImage}
      channelSlug={activeChannelSlug}
      className={className}
      onOpenImage={handleOpenImage}
    />
  );
});

type MessageAttachmentGridProps = {
  activeChannelSlug: string;
  currentUserId: string;
  isDirectMessage: boolean;
  message: ChatMessage;
  mine: boolean;
  onOpenImage: (attachment: ChatAttachment, url: string) => void;
};

const MessageAttachmentGrid = memo(function MessageAttachmentGrid({ activeChannelSlug, currentUserId, isDirectMessage, message, mine, onOpenImage }: MessageAttachmentGridProps) {
  const attachments = message.attachments;
  if (!attachments?.length) return null;
  const singleAttachment = attachments.length === 1;

  return (
    <div className={["mt-1 grid gap-1.5 overflow-hidden", singleAttachment ? "grid-cols-1" : "grid-cols-2"].join(" ")}>
      {attachments.map((attachment) => {
        const imageSizeClass = singleAttachment
          ? isDirectMessage
            ? "h-[20dvh] min-h-24 max-h-44 sm:max-h-56"
            : "h-[32dvh] min-h-36 max-h-80 sm:max-h-96"
          : "aspect-square max-h-56";
        return (
          <AttachmentPreview
            activeChannelSlug={activeChannelSlug}
            attachment={attachment}
            autoLoadImage={Boolean(attachment.client_preview_url && (mine || attachment.uploader_user_id === currentUserId))}
            className={attachment.attachment_type === "image" ? imageSizeClass : "min-h-24"}
            key={attachment.id}
            onOpenImage={onOpenImage}
          />
        );
      })}
    </div>
  );
});

type PollCardProps = {
  isVotingPoll: boolean;
  message: ChatMessage;
  mine: boolean;
  onVotePoll: (message: ChatMessage, optionId: string) => Promise<void>;
};

const PollCard = memo(function PollCard({ isVotingPoll, message, mine, onVotePoll }: PollCardProps) {
  if (message.status === "deleted" || !message.poll) return null;

  return (
    <div className={["mt-2 grid gap-2 rounded-lg border p-3", mine ? "border-emerald-300/40 bg-white/70" : "border-white/10 bg-white/10"].join(" ")}>
      <div className="flex items-center justify-between gap-3">
        <p className={["text-sm font-black", mine ? "text-ink" : "text-white"].join(" ")}>{message.poll.question}</p>
        <span className={["shrink-0 text-[0.68rem] font-black uppercase tracking-[0.12em]", mine ? "text-muted" : "text-slate-400"].join(" ")}>{message.poll.allow_multiple ? "Multi" : "Poll"}</span>
      </div>
      {message.poll.options.map((option) => {
        const percent = message.poll?.total_votes ? Math.round((option.vote_count / message.poll.total_votes) * 100) : 0;
        return (
          <button className={["relative overflow-hidden rounded-md border px-3 py-2 text-left text-sm font-black", option.voted_by_me ? "border-sky-300 bg-sky-100 text-ink" : mine ? "border-line bg-white/80 text-ink" : "border-white/10 bg-[#223447] text-white"].join(" ")} disabled={isVotingPoll || message.poll?.status !== "open"} key={option.id} onClick={() => void onVotePoll(message, option.id)} type="button">
            <span className="absolute inset-y-0 left-0 bg-sky-400/20" style={{ width: `${percent}%` }} />
            <span className="relative flex items-center justify-between gap-3"><span>{option.label}</span><span>{percent}% - {option.vote_count}</span></span>
          </button>
        );
      })}
      <p className={["text-xs font-bold", mine ? "text-muted" : "text-slate-400"].join(" ")}>{message.poll.total_votes} vote{message.poll.total_votes === 1 ? "" : "s"}{message.poll.status !== "open" ? " - closed" : ""}</p>
    </div>
  );
});

type ReactionBarProps = {
  message: ChatMessage;
  mine: boolean;
  reactionOptions: ReactionOption[];
  onReactToMessage: (message: ChatMessage, reaction: string) => void;
};

const ReactionBar = memo(function ReactionBar({ message, mine, reactionOptions, onReactToMessage }: ReactionBarProps) {
  const reactionByKey = useMemo(() => new Map((message.reactions ?? []).map((item) => [item.reaction, item])), [message.reactions]);
  const primaryReactions = useMemo(() => reactionOptions.slice(0, 6), [reactionOptions]);

  if (message.status === "deleted" || message.client_delivery_state) return null;

  return (
    <div className="mt-1.5 flex flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {primaryReactions.map((reaction) => {
        const summary = reactionByKey.get(reaction.key);
        return (
          <button
            className={[
              "grid h-8 min-w-8 shrink-0 place-items-center rounded-full border px-2 text-xs font-black",
              summary?.reacted_by_me ? "border-sky-300 bg-sky-300/20 text-white" : mine ? "border-white/10 bg-white/10 text-slate-200 hover:bg-white/20" : "border-white/10 bg-white/10 text-slate-200 hover:bg-white/20"
            ].join(" ")}
            key={reaction.key}
            onClick={() => onReactToMessage(message, reaction.key)}
            type="button"
          >
            {reaction.label}{summary?.count ? ` ${summary.count}` : ""}
          </button>
        );
      })}
    </div>
  );
});

type MessageActionControlsProps = {
  canManageAnyPin: boolean;
  deleted: boolean;
  isPinned: boolean;
  isReporting: boolean;
  message: ChatMessage;
  mine: boolean;
  onBlockUser: (message: ChatMessage) => void;
  onOpenMessageActions: (message: ChatMessage) => void;
  onOpenThread: (message: ChatMessage) => Promise<void>;
  onReplyToMessage: (message: ChatMessage) => void;
  onReportMessage: (message: ChatMessage) => void;
  onReportUser: (message: ChatMessage) => void;
  onStartPin: (message: ChatMessage) => void;
};

const MessageActionControls = memo(function MessageActionControls({
  canManageAnyPin,
  deleted,
  isPinned,
  isReporting,
  message,
  mine,
  onBlockUser,
  onOpenMessageActions,
  onOpenThread,
  onReplyToMessage,
  onReportMessage,
  onReportUser,
  onStartPin
}: MessageActionControlsProps) {
  return (
    <>
      {!message.client_delivery_state ? <button aria-label="Open message actions" className="grid h-7 w-7 place-items-center rounded-full text-base font-black text-slate-300 hover:bg-white/10" onClick={() => onOpenMessageActions(message)} title="Message actions" type="button">...</button> : null}
      {!deleted && !message.client_delivery_state ? <span className="flex flex-wrap gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
        <button
          className="rounded-full px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10"
          onClick={() => onReplyToMessage(message)}
          type="button"
        >
          Reply
        </button>
        <button
          className="rounded-full px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10"
          onClick={() => void onOpenThread(message)}
          type="button"
        >
          {message.thread_reply_count ? `${message.thread_reply_count} replies` : "Thread"}
        </button>
        {(mine || canManageAnyPin) && !isPinned ? (
          <button
            className="rounded-full px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10"
            onClick={() => onStartPin(message)}
            type="button"
          >
            Pin
          </button>
        ) : null}
      </span> : null}
      {!mine && !deleted ? (
        <>
          <button
            className="rounded-full px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10"
            disabled={isReporting}
            onClick={() => onReportMessage(message)}
            type="button"
          >
            {isReporting ? "..." : "Report"}
          </button>
          <button
            className="hidden rounded-full px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10 sm:inline"
            onClick={() => onReportUser(message)}
            type="button"
          >
            Report user
          </button>
          <button
            className="hidden rounded-full px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10 sm:inline"
            onClick={() => onBlockUser(message)}
            type="button"
          >
            Block
          </button>
        </>
      ) : null}
    </>
  );
});

export const ChatMessageRow = memo(function ChatMessageRow({
  activeChannelSlug,
  canManageAnyPin,
  currentUserId,
  hydrating,
  isDirectMessage,
  isPinned,
  isReporting,
  isRetrying,
  isVotingPoll,
  message,
  reactionOptions,
  onBeginLongPress,
  onBlockUser,
  onClearLongPress,
  onDismissFailedMessage,
  onHydrateMessage,
  onJumpToMessage,
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
}: ChatMessageRowProps) {
  const mine = message.sender_user_id === currentUserId;
  const system = message.message_kind === "system";
  const deleted = message.status === "deleted";
  const canOpenSenderProfile = Boolean(message.sender_user_id && !system);
  const attachmentCount = messageAttachmentCount(message);
  const attachmentSummary = messageAttachmentSummary(message);
  const pollSummary = messagePollSummary(message);
  const hasAttachmentsDetail = messageHasDetail(message, "attachments");
  const hasPollDetail = messageHasDetail(message, "poll");

  return (
    <article
      id={`chat-message-${message.id}`}
      className={[
        "group grid max-w-[min(96%,38rem)] select-none gap-2 rounded-2xl border px-3 py-3 shadow-tight",
        deleted ? "mr-auto border-dashed border-white/15 bg-[#1d2b38] text-slate-400" : system ? "mx-auto border-action/30 bg-amber-50" : mine ? "mr-auto border-[#2e5f6d] bg-[#1c2b3a] text-white" : "mr-auto border-white/10 bg-[#26394b] text-white"
      ].join(" ")}
      data-testid="chat-message-row"
      onContextMenu={(event) => { event.preventDefault(); if (!message.client_delivery_state) onOpenMessageActions(message); }}
      onPointerCancel={onClearLongPress}
      onPointerDown={(event) => { if (!message.client_delivery_state) onBeginLongPress(message, event.target); }}
      onPointerLeave={onClearLongPress}
      onPointerUp={onClearLongPress}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {!system ? (
          mine
            ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-900 text-[0.62rem] font-black text-sky-300">YOU</span>
            : <button aria-label={`Open ${message.sender_label} profile`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-black text-white hover:ring-2 hover:ring-sky-300" disabled={!canOpenSenderProfile} onClick={() => onOpenMessageUserProfile(message)} type="button">{initials(message.sender_label)}</button>
        ) : null}
        {canOpenSenderProfile ? (
          <button className={["break-words text-left text-sm font-black [overflow-wrap:anywhere]", mine ? "text-white hover:text-sky-200" : "text-sky-300 hover:text-sky-200"].join(" ")} onClick={() => onOpenMessageUserProfile(message)} type="button">{mine ? "You" : message.sender_label}</button>
        ) : (
          <strong className={["break-words text-sm font-black [overflow-wrap:anywhere]", system ? "text-ink" : mine ? "text-white" : "text-sky-300"].join(" ")}>{system ? "Skillsroom" : mine ? "You" : message.sender_label}</strong>
        )}
        {!mine && !system ? <button className="text-xs font-bold text-slate-300 hover:text-white" onClick={() => onOpenMessageUserProfile(message)} type="button">{displayHandle(message)}</button> : null}
        <span className={["font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em]", system ? "text-muted" : "text-slate-400"].join(" ")}>{messageTime(message.created_at)}</span>
        {message.edited_at && !deleted ? <span className={["text-[0.68rem] font-bold", system ? "text-muted" : "text-slate-400"].join(" ")}>edited</span> : null}
        {isPinned ? <span className="rounded-sm bg-action/20 px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-ink">Pinned</span> : null}
        {message.bookmarked_by_me ? <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300">Saved</span> : null}
        <MessageActionControls canManageAnyPin={canManageAnyPin} deleted={deleted} isPinned={isPinned} isReporting={isReporting} message={message} mine={mine} onBlockUser={onBlockUser} onOpenMessageActions={onOpenMessageActions} onOpenThread={onOpenThread} onReplyToMessage={onReplyToMessage} onReportMessage={onReportMessage} onReportUser={onReportUser} onStartPin={onStartPin} />
      </div>
      <ReplyPreview message={message} mine={false} onJumpToMessage={onJumpToMessage} />
      {message.forwarded_from_message_id ? (
        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">Forwarded message</p>
      ) : null}
      <MessageAttachmentGrid activeChannelSlug={activeChannelSlug} currentUserId={currentUserId} isDirectMessage={isDirectMessage} message={message} mine={mine} onOpenImage={onOpenImage} />
      {!deleted && !hasAttachmentsDetail && attachmentCount > 0 ? (
        <button
          className="mt-1 flex min-w-0 items-center gap-3 rounded-md border border-white/10 bg-white/10 p-3 text-left transition hover:bg-white/15"
          disabled={hydrating}
          onClick={() => void onHydrateMessage(message, "attachments")}
          type="button"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-sky-400/15 text-xs font-black uppercase text-sky-200">{attachmentSummary.type === "document" ? "File" : "Media"}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-white">{attachmentSummary.name}</span>
            <span className="mt-1 block text-xs font-bold text-slate-300">
              {hydrating ? "Loading details..." : `${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}${attachmentSummary.size ? ` - ${attachmentSummary.size}` : ""}`}
            </span>
          </span>
        </button>
      ) : null}
      <PollCard isVotingPoll={isVotingPoll} message={message} mine={false} onVotePoll={onVotePoll} />
      {!deleted && !hasPollDetail && pollSummary ? (
        <button
          className="mt-2 grid w-full gap-1 rounded-lg border border-white/10 bg-white/10 p-3 text-left transition hover:bg-white/15"
          disabled={hydrating}
          onClick={() => void onHydrateMessage(message, "poll")}
          type="button"
        >
          <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-400">{pollSummary.allow_multiple ? "Multi-choice poll" : "Poll"}</span>
          <span className="text-sm font-black text-white">{pollSummary.question ?? "Poll"}</span>
          <span className="text-xs font-bold text-slate-300">{hydrating ? "Loading poll..." : `${pollSummary.total_votes ?? 0} vote${pollSummary.total_votes === 1 ? "" : "s"} - open details`}</span>
        </button>
      ) : null}
      {deleted || message.body ? <p className={["mt-1 whitespace-pre-wrap break-words text-[0.98rem] leading-6 [overflow-wrap:anywhere]", deleted ? "italic text-slate-400" : system ? "text-ink" : "text-white"].join(" ")}>{deleted ? "This message was deleted." : renderMessageBody(message.body)}</p> : null}
      {message.client_delivery_state ? (
        <div className={["mt-2 flex flex-wrap items-center gap-2 border-t pt-2 text-xs font-bold", message.client_delivery_state === "sending" ? "border-white/10 text-slate-300" : "border-red-300/40 text-red-200"].join(" ")}>
          <span>{message.client_delivery_state === "sending" ? "Sending..." : message.client_error ?? "Message failed to send."}</span>
          {message.client_delivery_state === "failed" ? <button className="rounded-full bg-red-700 px-3 py-1 font-black text-white disabled:opacity-60" disabled={isRetrying} onClick={() => void onRetryMessage(message)} type="button">{isRetrying ? "Retrying..." : "Retry"}</button> : null}
          {message.client_delivery_state === "failed" ? <button className="rounded-full border border-red-300 px-3 py-1 font-black" onClick={() => onDismissFailedMessage(message)} type="button">Discard</button> : null}
        </div>
      ) : null}
      {!deleted && message.link_preview?.url && message.link_preview.host ? (
        <a className="mt-2 block rounded-md border border-white/10 bg-white/10 p-3 text-sm hover:bg-white/15" href={message.link_preview.url} rel="noreferrer" target="_blank">
          <span className="block font-black text-white">{message.link_preview.title ?? message.link_preview.host}</span>
          <span className="mt-1 block break-all text-xs font-bold text-slate-300">{message.link_preview.host}</span>
        </a>
      ) : null}
      <ReactionBar message={message} mine={mine} onReactToMessage={onReactToMessage} reactionOptions={reactionOptions} />
    </article>
  );
});
