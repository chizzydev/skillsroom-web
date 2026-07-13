"use client";
/* eslint-disable @next/next/no-img-element -- local attachment previews use browser blob URLs */

import type { FormEvent, RefObject } from "react";
import type { ChatChannel, ChatMessage } from "@/lib/match-room-api";
import {
  acceptedChatDocuments,
  channelTypeLabel,
  chatMessageMaxLength,
  documentBadge,
  initials
} from "./chat-state";
import type { ChatProfileUser, PendingAttachment } from "./chat-types";

const emojiGroups = [
  { key: "recent", label: "Recent", emojis: ["😀", "😂", "😍", "😭", "😅", "🤔", "😎", "🥳", "😮", "😡", "🥹", "🤩", "😴", "🙃", "🫡", "🤝"] },
  { key: "hands", label: "Hands", emojis: ["👍", "👎", "👏", "🙏", "💪", "✌️", "🤞", "👌", "🤟", "🤙", "👊", "🙌", "🫶", "👐", "👋", "☝️"] },
  { key: "games", label: "Games", emojis: ["🔥", "🏆", "🎮", "💯", "⚽", "🏀", "🎯", "🎲", "♟️", "🥇", "🥈", "🥉", "🚀", "⚡", "💎", "👑"] },
  { key: "hearts", label: "Hearts", emojis: ["❤️", "🩷", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "💕", "💞", "💓", "💗", "💖"] }
] as const;

export type EmojiGroupKey = (typeof emojiGroups)[number]["key"];

type ChatComposerProps = {
  activeChannel: ChatChannel;
  attachmentMenuRef: RefObject<HTMLDivElement | null>;
  attachmentTriggerRef: RefObject<HTMLButtonElement | null>;
  body: string;
  canModerateMessages: boolean;
  canSend: boolean;
  charactersLeft: number;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  cooldownSeconds: number;
  currentUserId: string;
  documentInputRef: RefObject<HTMLInputElement | null>;
  emojiGroup: EmojiGroupKey;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  emojiTriggerRef: RefObject<HTMLButtonElement | null>;
  error: string | null;
  imageInputRef: RefObject<HTMLInputElement | null>;
  isChatAdmin: boolean;
  isDirectMessage: boolean;
  isSending: boolean;
  lockdownSeconds: number;
  mentionSuggestions: ChatProfileUser[];
  pendingAttachments: PendingAttachment[];
  placeholder: string;
  replyTo: ChatMessage | null;
  showAttachmentMenu: boolean;
  showEmojiPicker: boolean;
  typingUsers: ChatProfileUser[];
  onBodyChange: (value: string | ((current: string) => string)) => void;
  onCreatePoll: () => void;
  onInsertMention: (username: string) => void;
  onLoadBookmarks: () => Promise<void>;
  onLoadScheduledAnnouncements: () => Promise<void>;
  onComposerFocus?: () => void;
  onRemoveAttachment: (attachment: PendingAttachment) => void;
  onRetryAttachment: (file: File, localId: string) => void;
  onSetEmojiGroup: (group: EmojiGroupKey) => void;
  onSetReplyTo: (message: ChatMessage | null) => void;
  onShowAttachmentMenuChange: (value: boolean | ((current: boolean) => boolean)) => void;
  onShowEmojiPickerChange: (value: boolean | ((current: boolean) => boolean)) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUploadAttachment: (file: File) => void;
};

export function ChatComposer({
  activeChannel,
  attachmentMenuRef,
  attachmentTriggerRef,
  body,
  canModerateMessages,
  canSend,
  charactersLeft,
  composerRef,
  cooldownSeconds,
  currentUserId,
  documentInputRef,
  emojiGroup,
  emojiPickerRef,
  emojiTriggerRef,
  error,
  imageInputRef,
  isChatAdmin,
  isDirectMessage,
  isSending,
  lockdownSeconds,
  mentionSuggestions,
  pendingAttachments,
  placeholder,
  replyTo,
  showAttachmentMenu,
  showEmojiPicker,
  typingUsers,
  onBodyChange,
  onCreatePoll,
  onInsertMention,
  onLoadBookmarks,
  onLoadScheduledAnnouncements,
  onComposerFocus,
  onRemoveAttachment,
  onRetryAttachment,
  onSetEmojiGroup,
  onSetReplyTo,
  onShowAttachmentMenuChange,
  onShowEmojiPickerChange,
  onSubmit,
  onUploadAttachment
}: ChatComposerProps) {
  const activeEmojiGroup = emojiGroups.find((group) => group.key === emojiGroup) ?? emojiGroups[0];

  return (
    <form className="z-20 min-w-0 shrink-0 border-t border-white/10 bg-[#172331] px-2 py-2 sm:px-3 sm:py-2.5 xl:px-6" data-testid="chat-composer-form" onSubmit={onSubmit}>
      <div className={["mx-auto grid w-full max-w-4xl gap-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]", showAttachmentMenu || showEmojiPicker ? "overflow-visible" : "overflow-y-auto overscroll-contain", isDirectMessage ? "max-h-[min(36dvh,18rem)]" : "max-h-[min(38dvh,20rem)]"].join(" ")}>
        {!canModerateMessages && lockdownSeconds > 0 ? (
          <p className="mb-2 rounded-md border border-amber-300/20 bg-amber-950/40 px-3 py-2 text-xs font-bold text-amber-100">
            Posting is paused for {Math.floor(lockdownSeconds / 60)}m {lockdownSeconds % 60}s{activeChannel.lockdown_reason ? `: ${activeChannel.lockdown_reason}` : "."}
          </p>
        ) : !canModerateMessages && cooldownSeconds > 0 ? (
          <p className="mb-2 rounded-md border border-sky-300/20 bg-sky-950/40 px-3 py-2 text-xs font-bold text-sky-100">
            Slow mode: you can send again in {cooldownSeconds}s.
          </p>
        ) : null}
        {error ? <p className="mb-2 rounded-md border border-danger bg-red-50 p-3 text-sm font-bold text-danger">{error}</p> : null}
        {typingUsers.length ? (
          <p className="mb-2 px-2 text-xs font-bold text-sky-300">
            {typingUsers.map((user) => user.label).slice(0, 3).join(", ")} typing...
          </p>
        ) : null}
        {replyTo ? (
          <div className="mb-2 flex min-w-0 items-start justify-between gap-3 rounded-xl border border-white/10 bg-[#223447] p-3">
            <div className="min-w-0">
              <p className="text-xs font-black text-sky-300">Replying to {replyTo.sender_user_id === currentUserId ? "you" : replyTo.sender_label}</p>
              <p className="mt-1 truncate text-sm text-slate-200">{replyTo.body}</p>
            </div>
            <button className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200 hover:bg-white/20" onClick={() => onSetReplyTo(null)} type="button">Cancel</button>
          </div>
        ) : null}
        {mentionSuggestions.length ? (
          <div className="mb-2 flex max-w-full gap-2 overflow-x-auto rounded-xl border border-white/10 bg-[#223447] p-2">
            {mentionSuggestions.map((user) => (
              <button
                className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-black text-white hover:bg-white/20"
                key={user.user_id}
                onClick={() => user.username ? onInsertMention(user.username) : undefined}
                type="button"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-navy-900 text-[0.62rem] text-white">{initials(user.label)}</span>
                @{user.username}
              </button>
            ))}
          </div>
        ) : null}
        {pendingAttachments.length ? (
          <div className="mb-2 flex max-w-full gap-2 overflow-x-auto overflow-y-hidden rounded-xl border border-white/10 bg-[#223447] p-2">
            {pendingAttachments.map((attachment) => (
              <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-md bg-black/20" key={attachment.localId}>
                {attachment.previewUrl ? (
                  <img alt={attachment.file.name} className="h-full w-full object-cover" src={attachment.previewUrl} />
                ) : (
                  <div className="grid h-full w-full place-items-center p-2 text-center">
                    <span className="grid gap-1">
                      <span className="mx-auto grid h-9 w-9 place-items-center rounded-md bg-sky-400/15 font-mono text-[0.62rem] font-black text-sky-200">{documentBadge(attachment.file.type)}</span>
                      <span className="max-h-8 overflow-hidden text-[0.62rem] font-black leading-4 text-white">{attachment.file.name}</span>
                    </span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/75 p-1.5 text-[0.62rem] font-black text-white">
                  {attachment.state === "uploading" ? <><span>{attachment.progress}%</span><span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/20"><span className="block h-full bg-sky-400" style={{ width: `${attachment.progress}%` }} /></span></> : attachment.state === "failed" ? <button className="w-full rounded-sm bg-red-600 px-1 py-1" onClick={() => onRetryAttachment(attachment.file, attachment.localId)} type="button">Retry</button> : "Ready"}
                </div>
                <button aria-label={`Remove ${attachment.file.name}`} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-xs font-black text-white" onClick={() => onRemoveAttachment(attachment)} type="button">X</button>
              </div>
            ))}
          </div>
        ) : null}
        {showEmojiPicker ? (
          <div className="mb-2 grid max-w-full gap-2 rounded-xl border border-white/10 bg-[#223447] p-2" ref={emojiPickerRef} role="dialog" aria-label="Emoji picker">
            <div className="flex gap-1 overflow-x-auto">
              {emojiGroups.map((group) => <button className={["min-h-8 shrink-0 rounded-full px-3 text-[0.68rem] font-black", emojiGroup === group.key ? "bg-sky-400 text-navy-950" : "bg-white/10 text-slate-200"].join(" ")} key={group.key} onClick={() => onSetEmojiGroup(group.key)} type="button">{group.label}</button>)}
            </div>
            <div className="grid grid-cols-8 gap-1 sm:grid-cols-12">
              {activeEmojiGroup.emojis.map((emoji) => <button className="grid h-9 w-9 place-items-center rounded-md text-xl hover:bg-white/10" key={emoji} onClick={() => { onBodyChange((current) => `${current}${emoji}`); composerRef.current?.focus(); }} type="button">{emoji}</button>)}
            </div>
          </div>
        ) : null}
        <div className="relative grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-end gap-1.5 sm:gap-2">
          <input accept="image/jpeg,image/png,image/webp" className="sr-only" multiple onChange={(event) => { Array.from(event.target.files ?? []).slice(0, Math.max(0, 4 - pendingAttachments.length)).forEach((file) => onUploadAttachment(file)); event.currentTarget.value = ""; }} ref={imageInputRef} type="file" />
          <input accept={acceptedChatDocuments} className="sr-only" multiple onChange={(event) => { Array.from(event.target.files ?? []).slice(0, Math.max(0, 4 - pendingAttachments.length)).forEach((file) => onUploadAttachment(file)); event.currentTarget.value = ""; }} ref={documentInputRef} type="file" />
          <button aria-expanded={showAttachmentMenu} aria-label="Add an attachment" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-[#223447] text-2xl font-light text-slate-200 hover:bg-[#2c4358]" onClick={() => { onShowAttachmentMenuChange((current) => !current); onShowEmojiPickerChange(false); }} ref={attachmentTriggerRef} title="Add attachment" type="button">+</button>
          {showAttachmentMenu ? <div className="absolute bottom-12 left-0 z-20 min-w-52 rounded-md border border-white/10 bg-[#26394b] p-1.5 text-white shadow-panel" ref={attachmentMenuRef}>
            <button className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm font-black hover:bg-white/10" onClick={() => { onShowAttachmentMenuChange(false); imageInputRef.current?.click(); }} type="button"><span aria-hidden="true">Photo</span> Add photo</button>
            <button className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm font-black hover:bg-white/10" onClick={() => { onShowAttachmentMenuChange(false); documentInputRef.current?.click(); }} type="button"><span aria-hidden="true">File</span> Add document</button>
            <button className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm font-black hover:bg-white/10" onClick={() => { onShowAttachmentMenuChange(false); onCreatePoll(); }} type="button"><span aria-hidden="true">Poll</span> Create poll</button>
            <button className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm font-black hover:bg-white/10" onClick={() => { onShowAttachmentMenuChange(false); void onLoadBookmarks(); }} type="button"><span aria-hidden="true">Saved</span> Saved messages</button>
            {isChatAdmin ? <button className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm font-black hover:bg-white/10" onClick={() => { onShowAttachmentMenuChange(false); void onLoadScheduledAnnouncements(); }} type="button"><span aria-hidden="true">Later</span> Schedule announcement</button> : null}
            <p className="px-3 pb-2 text-[0.68rem] font-bold text-slate-400">Photos must be smaller than 8MB. Documents must be smaller than 12MB.</p>
          </div> : null}
          <button aria-expanded={showEmojiPicker} aria-label="Choose emoji" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-[#223447] text-xl text-slate-200 hover:bg-[#2c4358]" onClick={() => { onShowEmojiPickerChange((current) => !current); onShowAttachmentMenuChange(false); }} ref={emojiTriggerRef} title="Emoji" type="button">:)</button>
          <label className="grid min-w-0 gap-1 self-end">
            <span className="sr-only">Message</span>
            <textarea
              className="h-11 min-h-0 w-full min-w-0 resize-none overflow-y-hidden rounded-2xl border border-white/10 bg-[#223447] px-3 py-[0.65rem] text-[0.95rem] leading-5 text-white outline-none placeholder:text-slate-400 focus:border-sky-400"
              data-testid="chat-composer-input"
              maxLength={chatMessageMaxLength}
              onChange={(event) => onBodyChange(event.target.value)}
              onFocus={onComposerFocus}
              placeholder={placeholder}
              ref={composerRef}
              rows={1}
              value={body}
            />
          </label>
          <button
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-lg font-black text-white shadow-action hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400 disabled:shadow-none sm:h-12 sm:w-12 sm:text-xl"
            data-testid="chat-send-button"
            disabled={!canSend}
            aria-label="Send message"
            type="submit"
          >
            {isSending ? "..." : ">"}
          </button>
        </div>
        <div className="mt-1 hidden flex-wrap items-center justify-between gap-2 px-2 text-xs font-bold text-slate-400 sm:flex">
          <span>{channelTypeLabel(activeChannel)} / {activeChannel.visibility}</span>
          <span className={charactersLeft < 80 ? "text-warning" : ""}>{charactersLeft}</span>
        </div>
      </div>
    </form>
  );
}
