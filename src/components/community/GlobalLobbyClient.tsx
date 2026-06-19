"use client";
/* eslint-disable @next/next/no-img-element -- private signed URLs and local blob previews bypass the public image optimizer */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ChatAttachment, ChatBookmark, ChatChannel, ChatChannelControls, ChatDmRequest, ChatMessage, ChatMessagePageInfo, ChatNotificationLevel, ChatPinnedMessage, ChatPresenceSummary, ChatReactionMember, ChatSearchPageInfo, ChatUserBlock, ScheduledChatAnnouncement } from "@/lib/match-room-api";

type GlobalLobbyClientProps = {
  channels: ChatChannel[];
  currentUserId: string;
  currentUserRole: string;
  initialChannel: ChatChannel;
  initialMessages: ChatMessage[];
  initialPageInfo: ChatMessagePageInfo;
  initialPinnedMessages: ChatPinnedMessage[];
  initialPresence: ChatPresenceSummary;
  initialReadBoundary: string | null;
  initialDmRequests: ChatDmRequest[];
  layout?: "embedded" | "full";
};

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string; details?: { retry_after_seconds?: number; next_allowed_at?: string } } };

type RealtimeEvent = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
};

type PendingAttachment = {
  localId: string;
  file: File;
  previewUrl?: string;
  attachment?: ChatAttachment;
  state: "uploading" | "ready" | "failed";
  progress: number;
  error?: string;
};

type MediaPage = { attachments: ChatAttachment[]; page_info: { has_more: boolean; next_before: string | null } };

type ChatProfileUser = {
  user_id: string;
  label: string;
  username?: string | null;
  is_online?: boolean;
};

const chatImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const chatDocumentMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain"
] as const;
const chatImageExtensions = [".jpg", ".jpeg", ".png", ".webp"] as const;
const chatDocumentExtensions = [".pdf", ".doc", ".docx", ".odt", ".txt"] as const;
const acceptedChatDocuments = ".pdf,.doc,.docx,.odt,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,text/plain";
const chatMessageMaxLength = 5000;
const composerMinHeightPx = 44;
const composerMaxHeightPx = 128;
const chatLoadedImageStoragePrefix = "skillsroom-chat-image-opened:";

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
    // Ignore storage errors; chat still works without persistence.
  }
}

function isChatImageMime(mimeType: string | null | undefined) {
  return chatImageMimeTypes.includes(mimeType as (typeof chatImageMimeTypes)[number]);
}

function isChatDocumentMime(mimeType: string | null | undefined) {
  return chatDocumentMimeTypes.includes(mimeType as (typeof chatDocumentMimeTypes)[number]);
}

function fileExtension(fileName: string | null | undefined) {
  const normalized = fileName?.trim().toLowerCase() ?? "";
  const lastDot = normalized.lastIndexOf(".");
  return lastDot >= 0 ? normalized.slice(lastDot) : "";
}

function chatAttachmentKind(file: File): "image" | "document" | null {
  if (isChatImageMime(file.type)) return "image";
  if (isChatDocumentMime(file.type)) return "document";
  const extension = fileExtension(file.name);
  if (chatImageExtensions.includes(extension as (typeof chatImageExtensions)[number])) return "image";
  if (chatDocumentExtensions.includes(extension as (typeof chatDocumentExtensions)[number])) return "document";
  return null;
}

function formatAttachmentSize(bytes: number | null | undefined) {
  if (!bytes || bytes < 1) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function documentBadge(mimeType: string | null | undefined) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "text/plain") return "TXT";
  if (mimeType === "application/vnd.oasis.opendocument.text") return "ODT";
  if (mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "DOC";
  return "FILE";
}

function attachmentPreviewLabel(attachment: ChatAttachment) {
  if (attachment.original_name?.trim()) return attachment.original_name.trim();
  return attachment.attachment_type === "document" ? "Document" : "Photo";
}

function ChatImage({ attachment, autoLoad, channelSlug, className, onOpen }: { attachment: ChatAttachment; autoLoad?: boolean; channelSlug: string; className?: string; onOpen?: (url: string) => void }) {
  const [url, setUrl] = useState(attachment.client_preview_url ?? "");
  const [failed, setFailed] = useState(false);
  const [loadRequested, setLoadRequested] = useState(() =>
    Boolean(autoLoad || attachment.client_preview_url || hasLoadedImageBefore(attachment.id))
  );

  useEffect(() => {
    if (autoLoad && !loadRequested) setLoadRequested(true);
  }, [autoLoad, loadRequested]);

  useEffect(() => {
    if (hasLoadedImageBefore(attachment.id) && !loadRequested) setLoadRequested(true);
  }, [attachment.id, loadRequested]);

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
    fetch(`/api/community/channels/${encodeURIComponent(channelSlug)}/attachments/${encodeURIComponent(attachment.id)}/url`, { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as ApiEnvelope<{ url: string }>;
        if (!response.ok || payload.ok !== true) throw new Error("Image unavailable.");
        if (active) {
          setUrl(payload.data.url);
          rememberLoadedImage(attachment.id);
        }
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attachment.client_preview_url, attachment.id, attachment.status, channelSlug, loadRequested]);

  if (attachment.status === "hidden" || attachment.status === "deleted") {
    return <div className={["grid min-h-28 place-items-center rounded-md border border-dashed border-white/15 bg-black/10 p-4 text-center text-xs font-bold text-slate-400", className].filter(Boolean).join(" ")}>Image removed by moderation.</div>;
  }
  if (failed) return <button className={["grid min-h-28 place-items-center rounded-md bg-black/15 p-4 text-xs font-black text-slate-300", className].filter(Boolean).join(" ")} onClick={() => { setFailed(false); setLoadRequested(false); window.requestAnimationFrame(() => setLoadRequested(true)); }} type="button">Image unavailable. Tap to retry.</button>;
  if (!loadRequested) return <button aria-label={`Load image from ${attachment.uploader_label}`} className={["grid place-items-center rounded-md border border-white/10 bg-black/20 p-4 text-center text-slate-200", className].filter(Boolean).join(" ")} onClick={() => setLoadRequested(true)} type="button"><span className="grid gap-2"><span aria-hidden="true" className="text-2xl">&#8595;</span><span className="text-xs font-black">Load image</span><span className="text-[0.68rem] font-bold text-slate-400">{Math.max(1, Math.round(attachment.byte_size / 1024))} KB</span></span></button>;
  if (!url) return <div className={["grid animate-pulse place-items-center rounded-md bg-black/15 text-xs font-bold text-slate-400", className].filter(Boolean).join(" ")} aria-label="Loading image">Loading image...</div>;
  return <button aria-label={`Open image from ${attachment.uploader_label}`} className={["grid h-full min-w-0 place-items-center overflow-hidden rounded-md bg-black/20", className].filter(Boolean).join(" ")} onClick={() => onOpen?.(url)} type="button"><img alt={attachment.alt_text ?? attachment.original_name ?? "Chat image"} className="h-full max-h-full w-full object-contain" loading="lazy" src={url} /></button>;
}

function ChatAttachmentTile({ attachment, autoLoadImage, channelSlug, className, onOpenImage }: { attachment: ChatAttachment; autoLoadImage?: boolean; channelSlug: string; className?: string; onOpenImage?: (url: string) => void }) {
  const [isOpening, setIsOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  if (attachment.attachment_type === "image") {
    return <ChatImage attachment={attachment} autoLoad={autoLoadImage} channelSlug={channelSlug} className={className} onOpen={onOpenImage} />;
  }

  const unavailable = attachment.status === "hidden" || attachment.status === "deleted" || attachment.status === "failed";

  async function openDocument() {
    if (unavailable || isOpening) return;
    setIsOpening(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(channelSlug)}/attachments/${encodeURIComponent(attachment.id)}/url`, { headers: { accept: "application/json" }, cache: "no-store" });
      const payload = await response.json() as ApiEnvelope<{ url: string }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Document unavailable." : "Document unavailable.");
      window.open(payload.data.url, "_blank", "noopener,noreferrer");
    } catch {
      setFailed(true);
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <button
      aria-label={`Open ${attachmentPreviewLabel(attachment)}`}
      className={["flex min-h-24 min-w-0 items-center gap-3 rounded-md border border-white/10 bg-black/15 p-3 text-left hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60", className].filter(Boolean).join(" ")}
      disabled={unavailable || isOpening}
      onClick={() => void openDocument()}
      type="button"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-sky-400/15 font-mono text-xs font-black text-sky-200">{documentBadge(attachment.mime_type)}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-white">{attachmentPreviewLabel(attachment)}</span>
        <span className="mt-1 block text-xs font-bold text-slate-400">
          {unavailable ? "Attachment unavailable" : failed ? "Could not open. Tap to retry." : isOpening ? "Opening..." : `Open file${formatAttachmentSize(attachment.byte_size) ? ` · ${formatAttachmentSize(attachment.byte_size)}` : ""}`}
        </span>
      </span>
    </button>
  );
}

function messageTime(value: string) {
  return new Date(value).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}

function messageDate(value: string) {
  return new Date(value).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

function pinExpiryLabel(value: string | null) {
  if (!value) return "Pinned until removed";
  return `Until ${new Date(value).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "SR";
}

type ChatChannelDisplay = Pick<ChatChannel, "slug" | "title" | "channel_type" | "dm_peer_label" | "dm_peer_display_name" | "dm_peer_username">;

function channelDisplayName(channel: ChatChannelDisplay) {
  if (channel.slug === "global_lobby") return "Global Chat";
  if (channel.channel_type === "dm") {
    return channel.dm_peer_label ?? channel.dm_peer_display_name ?? channel.dm_peer_username ?? "DM";
  }
  return channel.title;
}

function channelInitials(channel: ChatChannelDisplay) {
  if (channel.slug === "global_lobby") return "GC";
  const words = channelDisplayName(channel)
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !["of", "the", "and"].includes(word.toLowerCase()));
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 4).map((word) => word.charAt(0)).join("").toUpperCase() || "CH";
}

function channelTypeLabel(channel: ChatChannel) {
  if (channel.slug === "global_lobby") return "Chat";
  if (channel.channel_type === "match_room") return "Room";
  if (channel.channel_type === "tournament") return "Tournament";
  if (channel.channel_type === "game") return "Game";
  if (channel.channel_type === "group") return "Community";
  if (channel.channel_type === "dm") return "DM";
  return "Channel";
}

function channelTitle(channel: ChatChannelDisplay) {
  return channelDisplayName(channel);
}

function channelPreview(channel: ChatChannel) {
  if (channel.last_message_body) {
    return `${channel.last_message_sender_label ?? "Player"}: ${channel.last_message_body}`;
  }
  if (channel.channel_type === "dm") {
    return channel.dm_peer_username ? `@${channel.dm_peer_username}` : "DM";
  }
  return channel.description ?? `${channelTypeLabel(channel)} channel`;
}

function pendingMessage(channelId: string, userId: string, body: string, clientMessageId: string, replyTo: ChatMessage | null, attachments: ChatAttachment[]): ChatMessage {
  const now = new Date().toISOString();
  return {
    id: clientMessageId,
    channel_id: channelId,
    sender_user_id: userId,
    message_kind: "user",
    status: "visible",
    body,
    client_message_id: clientMessageId,
    reply_to_message_id: replyTo?.id ?? null,
    reply_to_body: replyTo?.body ?? null,
    reply_to_sender_user_id: replyTo?.sender_user_id ?? null,
    reply_to_sender_label: replyTo?.sender_label ?? null,
    mentions: [],
    link_preview: {},
    reactions: [],
    bookmarked_by_me: false,
    thread_reply_count: 0,
    poll: null,
    attachments,
    pinned_at: null,
    pinned_by_user_id: null,
    hidden_by_user_id: null,
    hidden_at: null,
    deleted_by_user_id: null,
    deleted_at: null,
    edited_at: null,
    edit_count: 0,
    editable_until: new Date(Date.now() + 15 * 60_000).toISOString(),
    created_at: now,
    updated_at: now,
    sender_label: "You",
    client_delivery_state: "sending"
  };
}

function preserveLocalAttachmentPreviews(next: ChatMessage, previous?: ChatMessage) {
  if (!previous?.attachments?.length || !next.attachments?.length) return next;

  const previewByAttachmentId = new Map(
    previous.attachments
      .filter((attachment) => attachment.client_preview_url)
      .map((attachment) => [attachment.id, attachment.client_preview_url])
  );
  if (!previewByAttachmentId.size) return next;

  return {
    ...next,
    attachments: next.attachments.map((attachment, index) => {
      if (attachment.client_preview_url) return attachment;

      const previewById = previewByAttachmentId.get(attachment.id);
      if (previewById) {
        return { ...attachment, client_preview_url: previewById };
      }

      const previousAttachment = previous.attachments?.[index];
      if (
        previousAttachment?.client_preview_url &&
        previousAttachment.attachment_type === attachment.attachment_type
      ) {
        return { ...attachment, client_preview_url: previousAttachment.client_preview_url };
      }

      return attachment;
    })
  };
}

function mergeMessage(current: ChatMessage[], next: ChatMessage) {
  const previous = current.find((item) => (
    item.id === next.id ||
    Boolean(next.client_message_id && item.client_message_id === next.client_message_id)
  ));
  const mergedNext = preserveLocalAttachmentPreviews(next, previous);
  const withoutDuplicate = current.filter((item) => (
    item.id !== mergedNext.id &&
    (!mergedNext.client_message_id || item.client_message_id !== mergedNext.client_message_id)
  ));
  return [...withoutDuplicate, mergedNext]
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
    .slice(-120);
}

function isChatMessage(value: unknown): value is ChatMessage {
  return typeof value === "object" && value !== null && "id" in value && "body" in value && "channel_id" in value;
}

function renderMessageBody(body: string) {
  return body.split(/(@[A-Za-z0-9_]{3,24})/g).map((part, index) => (
    /^@[A-Za-z0-9_]{3,24}$/.test(part)
      ? <span className="font-black text-cyan" key={`${part}-${index}`}>{part}</span>
      : <span key={`${part}-${index}`}>{part}</span>
  ));
}

function displayHandle(message: Pick<ChatMessage, "sender_username" | "sender_label">) {
  return message.sender_username ? `@${message.sender_username}` : message.sender_label;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

const emptyMessages: ChatMessage[] = [];
const emptyPinnedMessages: ChatPinnedMessage[] = [];
const emptyPresence: ChatPresenceSummary = { online_count: 0, active: [], typing: [] };
const reactionOptions = [
  { key: "like", label: "👍" },
  { key: "gg", label: "GG" },
  { key: "fire", label: "🔥" },
  { key: "clap", label: "👏" },
  { key: "trophy", label: "🏆" },
  { key: "heart", label: "❤️" },
  { key: "laugh", label: "😂" },
  { key: "wow", label: "😮" },
  { key: "sad", label: "😢" },
  { key: "angry", label: "😡" },
  { key: "hundred", label: "💯" },
  { key: "game", label: "🎮" }
];

const emojiGroups = [
  { key: "recent", label: "Recent", emojis: ["😀", "😂", "😍", "😭", "😅", "🤔", "😎", "🥳", "😮", "😡", "🥹", "🤩", "😴", "🙃", "🫡", "🤝"] },
  { key: "hands", label: "Hands", emojis: ["👍", "👎", "👏", "🙏", "💪", "✌️", "🤞", "👌", "🤟", "🤙", "👊", "🙌", "🫶", "👐", "👋", "☝️"] },
  { key: "games", label: "Games", emojis: ["🔥", "🏆", "🎮", "💯", "⚽", "🏀", "🎯", "🎲", "♟️", "🥇", "🥈", "🥉", "🚀", "⚡", "💎", "👑"] },
  { key: "hearts", label: "Hearts", emojis: ["❤️", "🩷", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "💕", "💞", "💓", "💗", "💖"] }
] as const;

export function GlobalLobbyClient({ channels, currentUserId, currentUserRole, initialChannel, initialMessages, initialPageInfo, initialPinnedMessages, initialPresence, initialReadBoundary, initialDmRequests, layout = "embedded" }: GlobalLobbyClientProps) {
  const [channelList, setChannelList] = useState<ChatChannel[]>(channels);
  const [dmRequests, setDmRequests] = useState<ChatDmRequest[]>(initialDmRequests);
  const [dmUsername, setDmUsername] = useState("");
  const [dmIntro, setDmIntro] = useState("");
  const [activeChannel, setActiveChannel] = useState<ChatChannel>(initialChannel);
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, ChatMessage[]>>({
    [initialChannel.slug]: initialMessages
  });
  const [pinnedByChannel, setPinnedByChannel] = useState<Record<string, ChatPinnedMessage[]>>({
    [initialChannel.slug]: initialPinnedMessages
  });
  const [presenceByChannel, setPresenceByChannel] = useState<Record<string, ChatPresenceSummary>>({
    [initialChannel.slug]: initialPresence
  });
  const [pageInfoByChannel, setPageInfoByChannel] = useState<Record<string, ChatMessagePageInfo>>({
    [initialChannel.slug]: initialPageInfo
  });
  const [readBoundaryByChannel, setReadBoundaryByChannel] = useState<Record<string, string | null>>({
    [initialChannel.slug]: initialReadBoundary
  });
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingChannel, setIsLoadingChannel] = useState(false);
  const [reportingIds, setReportingIds] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [editTarget, setEditTarget] = useState<ChatMessage | null>(null);
  const [editBody, setEditBody] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<"starting" | "live" | "reconnecting">("starting");
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [infoTab, setInfoTab] = useState<"members" | "messages" | "channels" | "media" | "pins" | "settings">("members");
  const [mediaByChannel, setMediaByChannel] = useState<Record<string, MediaPage>>({});
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiGroup, setEmojiGroup] = useState<(typeof emojiGroups)[number]["key"]>("recent");
  const [viewer, setViewer] = useState<{ attachment: ChatAttachment; url: string } | null>(null);
  const [pinTarget, setPinTarget] = useState<ChatMessage | null>(null);
  const [pinDurationHours, setPinDurationHours] = useState<24 | 168 | 720>(168);
  const [pinClock, setPinClock] = useState(() => Date.now());
  const [pinBannerIndexByChannel, setPinBannerIndexByChannel] = useState<Record<string, number>>({});
  const [isPinning, setIsPinning] = useState(false);
  const [unpinningIds, setUnpinningIds] = useState<Set<string>>(new Set());
  const [chatViewport, setChatViewport] = useState<{ height: number; top: number; keyboardActive: boolean } | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [searchDateFrom, setSearchDateFrom] = useState("");
  const [searchDateTo, setSearchDateTo] = useState("");
  const [searchMentions, setSearchMentions] = useState<"" | "any" | "me">("");
  const [searchLinks, setSearchLinks] = useState(false);
  const [searchPinned, setSearchPinned] = useState(false);
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searchPageInfo, setSearchPageInfo] = useState<ChatSearchPageInfo>({ has_more: false, next_cursor: null });
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pendingJumpMessageId, setPendingJumpMessageId] = useState<string | null>(null);
  const [isContextView, setIsContextView] = useState(false);
  const [remoteMentionUsers, setRemoteMentionUsers] = useState<Array<{ user_id: string; label: string; username?: string | null; is_online?: boolean }>>([]);
  const [threadTarget, setThreadTarget] = useState<ChatMessage | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [threadBody, setThreadBody] = useState("");
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSendingThread, setIsSendingThread] = useState(false);
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null);
  const [forwardChannelSlug, setForwardChannelSlug] = useState("");
  const [isForwarding, setIsForwarding] = useState(false);
  const [bookmarks, setBookmarks] = useState<ChatBookmark[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);
  const [bookmarkingIds, setBookmarkingIds] = useState<Set<string>>(new Set());
  const [reactionTarget, setReactionTarget] = useState<ChatMessage | null>(null);
  const [reactionMembers, setReactionMembers] = useState<ChatReactionMember[]>([]);
  const [isLoadingReactions, setIsLoadingReactions] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollClosesAt, setPollClosesAt] = useState("");
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [votingPollIds, setVotingPollIds] = useState<Set<string>>(new Set());
  const [profileUser, setProfileUser] = useState<ChatProfileUser | null>(null);
  const [profileDmIntro, setProfileDmIntro] = useState("");
  const [isRequestingProfileDm, setIsRequestingProfileDm] = useState(false);
  const [profileAction, setProfileAction] = useState<"report" | "block" | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledBody, setScheduledBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduledAnnouncements, setScheduledAnnouncements] = useState<ScheduledChatAnnouncement[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [channelControls, setChannelControls] = useState<ChatChannelControls | null>(null);
  const [notificationLevel, setNotificationLevel] = useState<ChatNotificationLevel>("all");
  const [dmNotificationLevel, setDmNotificationLevel] = useState<ChatNotificationLevel>("all");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [lockdownMinutes, setLockdownMinutes] = useState(30);
  const [lockdownReason, setLockdownReason] = useState("");
  const [isLoadingControls, setIsLoadingControls] = useState(false);
  const [isSavingControls, setIsSavingControls] = useState(false);
  const [controlAction, setControlAction] = useState<"notifications" | "slow" | "lock" | "unlock" | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<ChatUserBlock[]>([]);
  const [isLoadingBlockedUsers, setIsLoadingBlockedUsers] = useState(false);
  const [unblockingIds, setUnblockingIds] = useState<Set<string>>(new Set());
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [cooldownClock, setCooldownClock] = useState(() => Date.now());
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentTriggerRef = useRef<HTMLButtonElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const emojiTriggerRef = useRef<HTMLButtonElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const uploadRequestsRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const longPressTimerRef = useRef<number | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set(initialMessages.map((message) => message.id)));
  const messagesByChannelRef = useRef(messagesByChannel);
  const shouldStickLatestRef = useRef(true);
  const initialLinkHandledRef = useRef(false);
  const backgroundAuthPauseUntilRef = useRef(0);

  const messages = messagesByChannel[activeChannel.slug] ?? emptyMessages;
  const pageInfo = pageInfoByChannel[activeChannel.slug] ?? { has_older: false, older_cursor: null };
  const readBoundary = readBoundaryByChannel[activeChannel.slug] ?? null;
  const unreadMessageId = readBoundary
    ? messages.find((message) => message.sender_user_id !== currentUserId && Date.parse(message.created_at) > Date.parse(readBoundary))?.id ?? null
    : (activeChannel.unread_count ?? 0) > 0
      ? messages.find((message) => message.sender_user_id !== currentUserId)?.id ?? null
      : null;
  const pinnedMessages = (pinnedByChannel[activeChannel.slug] ?? emptyPinnedMessages)
    .filter((pin) => !pin.expires_at || Date.parse(pin.expires_at) > pinClock);
  const bannerPinnedMessages = pinnedMessages.slice(0, 3);
  const pinBannerIndex = Math.min(pinBannerIndexByChannel[activeChannel.slug] ?? 0, Math.max(0, bannerPinnedMessages.length - 1));
  const currentPinnedMessage = bannerPinnedMessages[pinBannerIndex] ?? null;
  const presence = presenceByChannel[activeChannel.slug] ?? emptyPresence;
  const charactersLeft = chatMessageMaxLength - body.length;
  const readyAttachments = pendingAttachments.filter((attachment) => attachment.state === "ready" && attachment.attachment);
  const uploadInProgress = pendingAttachments.some((attachment) => attachment.state === "uploading");
  const canManageAnyPin = ["support", "moderator", "admin", "owner"].includes(currentUserRole);
  const canModerateMessages = ["moderator", "admin", "owner"].includes(currentUserRole);
  const cooldownSeconds = cooldownUntil ? Math.max(0, Math.ceil((Date.parse(cooldownUntil) - cooldownClock) / 1000)) : 0;
  const lockdownSeconds = activeChannel.lockdown_until ? Math.max(0, Math.ceil((Date.parse(activeChannel.lockdown_until) - cooldownClock) / 1000)) : 0;
  const isSendControlled = !canModerateMessages && (cooldownSeconds > 0 || lockdownSeconds > 0);
  const canSend = (body.trim().length > 0 || readyAttachments.length > 0) && body.trim().length <= chatMessageMaxLength && !uploadInProgress && !isSending && !isLoadingChannel && !isSendControlled;
  const fullLayout = layout === "full";
  const dmChannels = useMemo(() => channelList.filter((channel) => channel.channel_type === "dm"), [channelList]);
  const communityChannels = useMemo(() => channelList.filter((channel) => channel.channel_type !== "dm"), [channelList]);
  const pendingIncomingDmRequests = useMemo(
    () => dmRequests.filter((request) => request.status === "pending" && request.recipient_user_id === currentUserId),
    [currentUserId, dmRequests]
  );
  const typingUsers = presence.typing.filter((user) => user.user_id !== currentUserId);
  const userDirectory = useMemo(() => {
    const users = new Map<string, { user_id: string; label: string; username?: string | null; is_online?: boolean }>();
    for (const user of presence.active) {
      users.set(user.user_id, { user_id: user.user_id, label: user.label, username: user.username, is_online: user.is_online });
    }
    for (const message of messages) {
      if (message.sender_user_id && !users.has(message.sender_user_id)) {
        users.set(message.sender_user_id, {
          user_id: message.sender_user_id,
          label: message.sender_label,
          username: message.sender_username,
          is_online: false
        });
      }
    }
    return Array.from(users.values());
  }, [messages, presence.active]);
  const listedActiveChannel = useMemo(
    () => channelList.find((item) => item.id === activeChannel.id || item.slug === activeChannel.slug) ?? null,
    [activeChannel.id, activeChannel.slug, channelList]
  );
  const displayActiveChannel = useMemo(() => {
    if (activeChannel.channel_type !== "dm") return activeChannel;
    const peer = userDirectory.find((user) => user.user_id !== currentUserId);
    const peerLabel =
      activeChannel.dm_peer_label ??
      listedActiveChannel?.dm_peer_label ??
      activeChannel.dm_peer_display_name ??
      listedActiveChannel?.dm_peer_display_name ??
      activeChannel.dm_peer_username ??
      listedActiveChannel?.dm_peer_username ??
      peer?.label ??
      "DM";
    const peerUsername = activeChannel.dm_peer_username ?? listedActiveChannel?.dm_peer_username ?? peer?.username ?? null;
    return {
      ...activeChannel,
      dm_peer_label: peerLabel,
      dm_peer_display_name: activeChannel.dm_peer_display_name ?? listedActiveChannel?.dm_peer_display_name ?? peerLabel,
      dm_peer_username: peerUsername
    };
  }, [activeChannel, currentUserId, listedActiveChannel, userDirectory]);
  const isDirectMessage = activeChannel.channel_type === "dm";
  const activeChannelSubtitle = isDirectMessage
    ? `${presence.online_count} online / DM`
    : `${presence.online_count} online${communityChannels.length ? ` / ${communityChannels.length} channels` : ""}`;
  const mentionFragment = body.match(/(?:^|\s)@([A-Za-z0-9_]{0,24})$/)?.[1]?.toLowerCase() ?? null;
  const mentionSuggestions = mentionFragment === null ? [] : Array.from(new Map([...userDirectory, ...remoteMentionUsers]
    .filter((user) => user.username && user.user_id !== currentUserId && user.username.toLowerCase().startsWith(mentionFragment))
    .map((user) => [user.user_id, user])).values()).slice(0, 8);
  const isChatAdmin = ["admin", "owner"].includes(currentUserRole);
  const activeEmojiGroup = emojiGroups.find((group) => group.key === emojiGroup) ?? emojiGroups[0];
  const profileIsSelf = profileUser?.user_id === currentUserId;
  const composerPlaceholder = "Message";

  const statusLabel = useMemo(() => {
    if (streamStatus === "live") return "Live";
    if (streamStatus === "reconnecting") return "Reconnecting";
    return "Connecting";
  }, [streamStatus]);

  function insertMention(username: string) {
    setBody((current) => current.replace(/(^|\s)@([A-Za-z0-9_]{0,24})$/, `$1@${username} `));
  }

  const backgroundChatRequest = useCallback(async (input: string, init: RequestInit) => {
    if (Date.now() < backgroundAuthPauseUntilRef.current) return null;
    const response = await fetch(input, {
      ...init,
      credentials: "same-origin"
    });
    if (response.status === 401) {
      backgroundAuthPauseUntilRef.current = Date.now() + 60_000;
      return null;
    }
    return response;
  }, []);

  function openUserProfile(user: ChatProfileUser) {
    setProfileUser(user);
    setProfileDmIntro("");
    setError(null);
  }

  function openMessageUserProfile(message: ChatMessage) {
    if (!message.sender_user_id || message.message_kind === "system") return;
    const activeUser = presence.active.find((user) => user.user_id === message.sender_user_id);
    openUserProfile({
      user_id: message.sender_user_id,
      label: activeUser?.label ?? message.sender_label,
      username: activeUser?.username ?? message.sender_username,
      is_online: activeUser?.is_online ?? false
    });
  }

  function canEditMessage(message: ChatMessage) {
    return message.status === "visible" &&
      message.message_kind === "user" &&
      message.sender_user_id === currentUserId &&
      Boolean(message.editable_until && Date.parse(message.editable_until) > Date.now());
  }

  function canDeleteMessage(message: ChatMessage) {
    return message.status !== "deleted" && (message.sender_user_id === currentUserId || canModerateMessages);
  }

  function clearLongPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function beginLongPress(message: ChatMessage, target: EventTarget | null) {
    if (target instanceof Element && target.closest("button, a, input, textarea")) return;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      setActionMessage(message);
      longPressTimerRef.current = null;
    }, 550);
  }

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(successMessage);
      window.setTimeout(() => setNotice(null), 2200);
    } catch {
      setError("Your browser could not copy that message.");
    } finally {
      setActionMessage(null);
    }
  }

  function messageLink(message: ChatMessage) {
    const url = new URL("/chat", window.location.origin);
    url.searchParams.set("channel", activeChannel.slug);
    url.searchParams.set("message", message.id);
    return url.toString();
  }

  function openPinnedBannerMessage() {
    if (!currentPinnedMessage) return;
    const nextIndex = bannerPinnedMessages.length > 1 ? (pinBannerIndex + 1) % bannerPinnedMessages.length : 0;
    setPinBannerIndexByChannel((current) => ({ ...current, [activeChannel.slug]: nextIndex }));
    openPinnedMessage(currentPinnedMessage.message_id);
  }

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    let retryTimer: number | null = null;
    let retryCount = 0;
    const centerLinkedMessage = () => {
      const linkedMessageId = pendingJumpMessageId;
      const linkedMessage = linkedMessageId ? document.getElementById(`chat-message-${linkedMessageId}`) : null;
      if (linkedMessage) {
        const viewportRect = viewport.getBoundingClientRect();
        const messageRect = linkedMessage.getBoundingClientRect();
        const nextTop = viewport.scrollTop + messageRect.top - viewportRect.top - Math.max(0, (viewport.clientHeight - messageRect.height) / 2);
        viewport.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
        linkedMessage.animate(
          [{ outlineColor: "rgba(56, 189, 248, 0.9)" }, { outlineColor: "rgba(56, 189, 248, 0)" }],
          { duration: 1800, easing: "ease-out" }
        );
        if (pendingJumpMessageId) setPendingJumpMessageId(null);
      } else if (linkedMessageId) {
        retryCount += 1;
        if (retryCount <= 8) retryTimer = window.setTimeout(centerLinkedMessage, 120);
        else {
          setPendingJumpMessageId(null);
          setError("That pinned message could not be positioned. Please open it again.");
        }
      } else if (shouldStickLatestRef.current) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    };
    const frame = window.requestAnimationFrame(centerLinkedMessage);
    return () => {
      window.cancelAnimationFrame(frame);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [activeChannel.slug, messages.length, pendingJumpMessageId]);

  useEffect(() => {
    const saved = window.localStorage.getItem(`skillsroom:chat-draft:${currentUserId}:${activeChannel.slug}`) ?? "";
    setBody(saved);
  }, [activeChannel.slug, currentUserId]);

  useEffect(() => {
    const key = `skillsroom:chat-draft:${currentUserId}:${activeChannel.slug}`;
    const timer = window.setTimeout(() => {
      if (body) window.localStorage.setItem(key, body);
      else window.localStorage.removeItem(key);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeChannel.slug, body, currentUserId]);

  useEffect(() => {
    if (!fullLayout) return;

    const visualViewport = window.visualViewport;
    const root = document.documentElement;
    const bodyElement = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = bodyElement.style.overflow;
    const previousBodyOverscroll = bodyElement.style.overscrollBehavior;

    root.style.overflow = "hidden";
    bodyElement.style.overflow = "hidden";
    bodyElement.style.overscrollBehavior = "none";

    const updateViewport = () => {
      const viewportHeight = Math.round(visualViewport?.height ?? window.innerHeight);
      const offsetTop = Math.round(visualViewport?.offsetTop ?? 0);
      const keyboardActive = Boolean(visualViewport && window.innerHeight - visualViewport.height > 120);
      const next = {
        height: viewportHeight,
        top: keyboardActive ? offsetTop : 0,
        keyboardActive
      };
      setChatViewport((current) => current?.height === next.height && current.top === next.top && current.keyboardActive === next.keyboardActive ? current : next);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    visualViewport?.addEventListener("resize", updateViewport);
    visualViewport?.addEventListener("scroll", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      visualViewport?.removeEventListener("resize", updateViewport);
      visualViewport?.removeEventListener("scroll", updateViewport);
      root.style.overflow = previousRootOverflow;
      bodyElement.style.overflow = previousBodyOverflow;
      bodyElement.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [fullLayout]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = `${composerMinHeightPx}px`;
    composer.style.height = `${Math.min(Math.max(composer.scrollHeight, composerMinHeightPx), composerMaxHeightPx)}px`;
    composer.style.overflowY = composer.scrollHeight > composerMaxHeightPx ? "auto" : "hidden";
  }, [body]);

  useEffect(() => {
    if (!showAttachmentMenu && !showEmojiPicker) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const clickedAttachmentMenu = attachmentMenuRef.current?.contains(target) ?? false;
      const clickedAttachmentTrigger = attachmentTriggerRef.current?.contains(target) ?? false;
      const clickedEmojiPicker = emojiPickerRef.current?.contains(target) ?? false;
      const clickedEmojiTrigger = emojiTriggerRef.current?.contains(target) ?? false;

      if (showAttachmentMenu && !clickedAttachmentMenu && !clickedAttachmentTrigger) {
        setShowAttachmentMenu(false);
      }
      if (showEmojiPicker && !clickedEmojiPicker && !clickedEmojiTrigger) {
        setShowEmojiPicker(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [showAttachmentMenu, showEmojiPicker]);

  useEffect(() => {
    if (!pinnedMessages.length) return;
    const timer = window.setInterval(() => setPinClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [pinnedMessages.length]);

  useEffect(() => {
    setPinBannerIndexByChannel((current) => {
      const nextIndex = Math.min(current[activeChannel.slug] ?? 0, Math.max(0, bannerPinnedMessages.length - 1));
      return current[activeChannel.slug] === nextIndex ? current : { ...current, [activeChannel.slug]: nextIndex };
    });
  }, [activeChannel.slug, bannerPinnedMessages.length]);

  useEffect(() => {
    if (!cooldownUntil && !activeChannel.lockdown_until) return;
    const timer = window.setInterval(() => setCooldownClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeChannel.lockdown_until, cooldownUntil]);

  useEffect(() => {
    messagesByChannelRef.current = messagesByChannel;
  }, [messagesByChannel]);

  useEffect(() => {
    if (initialLinkHandledRef.current) return;
    const linkedMessageId = new URLSearchParams(window.location.search).get("message");
    if (!linkedMessageId) {
      initialLinkHandledRef.current = true;
      return;
    }
    initialLinkHandledRef.current = true;
    if (messages.some((message) => message.id === linkedMessageId)) setPendingJumpMessageId(linkedMessageId);
    else void jumpToMessage(linkedMessageId);
    // Deep links are consumed once; rerunning after message updates can replace the user's current view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel.slug, backgroundChatRequest]);

  const markRead = useCallback(async (channel: ChatChannel, nextMessages: ChatMessage[]) => {
    const lastMessage = nextMessages.at(-1);
    await backgroundChatRequest(`/api/community/channels/${encodeURIComponent(channel.slug)}/read`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ message_id: lastMessage?.id })
    }).catch(() => undefined);
  }, [backgroundChatRequest]);

  async function openChannel(channel: ChatChannel) {
    shouldStickLatestRef.current = true;
    setIsContextView(false);
    setActiveChannel(channel);
    setReplyTo(null);
    setSearchResults([]);
    setSearchPageInfo({ has_more: false, next_cursor: null });
    setError(null);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("channel", channel.slug);
    nextUrl.searchParams.delete("message");
    window.history.replaceState({}, "", nextUrl);
    setChannelList((current) => current.map((item) => item.id === channel.id ? { ...item, unread_count: 0 } : item));
    if (messagesByChannel[channel.slug]) return;

    setIsLoadingChannel(true);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(channel.slug)}/messages?limit=60`, {
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      const payload = (await response.json()) as ApiEnvelope<{ channel: ChatChannel; messages: ChatMessage[]; pinned_messages: ChatPinnedMessage[]; presence: ChatPresenceSummary; page_info: ChatMessagePageInfo; read_boundary: string | null }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Channel could not load." : "Channel could not load.");
      }
      payload.data.messages.forEach((message) => seenIdsRef.current.add(message.id));
      setActiveChannel(payload.data.channel);
      setMessagesByChannel((current) => ({ ...current, [payload.data.channel.slug]: payload.data.messages }));
      setPinnedByChannel((current) => ({ ...current, [payload.data.channel.slug]: payload.data.pinned_messages }));
      setPresenceByChannel((current) => ({ ...current, [payload.data.channel.slug]: payload.data.presence }));
      setPageInfoByChannel((current) => ({ ...current, [payload.data.channel.slug]: payload.data.page_info }));
      setReadBoundaryByChannel((current) => ({ ...current, [payload.data.channel.slug]: payload.data.read_boundary }));
      setChannelList((current) => current.map((item) => item.id === payload.data.channel.id ? { ...payload.data.channel, unread_count: 0 } : item));
      await markRead(payload.data.channel, payload.data.messages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Channel could not load.");
    } finally {
      setIsLoadingChannel(false);
    }
  }

  function closeLocalSurface() {
    if (viewer) {
      setViewer(null);
      return true;
    }
    if (showSearch) {
      setShowSearch(false);
      return true;
    }
    if (showBookmarks) {
      setShowBookmarks(false);
      return true;
    }
    if (showSchedule) {
      setShowSchedule(false);
      return true;
    }
    if (threadTarget) {
      setThreadTarget(null);
      return true;
    }
    if (forwardTarget) {
      setForwardTarget(null);
      return true;
    }
    if (reactionTarget) {
      setReactionTarget(null);
      return true;
    }
    if (showPollCreator) {
      setShowPollCreator(false);
      return true;
    }
    if (actionMessage) {
      setActionMessage(null);
      return true;
    }
    if (profileUser) {
      setProfileUser(null);
      return true;
    }
    if (showChannelInfo) {
      setShowChannelInfo(false);
      return true;
    }
    return false;
  }

  function handleBack() {
    if (closeLocalSurface()) return;
    if (activeChannel.channel_type === "dm") {
      setInfoTab("messages");
      setShowChannelInfo(true);
      return;
    }
    if (activeChannel.slug !== "global_lobby") {
      setInfoTab("channels");
      setShowChannelInfo(true);
      return;
    }
    window.location.assign("/");
  }

  function goHome() {
    window.location.assign("/");
  }

  useEffect(() => {
    let closed = false;

    async function beat() {
      try {
        const response = await backgroundChatRequest(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/heartbeat`, {
          method: "POST",
          headers: { accept: "application/json" }
        });
        if (!response) return;
        const payload = (await response.json()) as ApiEnvelope<{ channel: ChatChannel; presence: ChatPresenceSummary }>;
        if (!closed && response.ok && payload.ok === true) {
          setPresenceByChannel((current) => ({ ...current, [payload.data.channel.slug]: payload.data.presence }));
          setChannelList((current) => current.map((item) => item.id === payload.data.channel.id ? { ...item, online_count: payload.data.presence.online_count } : item));
        }
      } catch {
        // Presence is best-effort; messaging stays usable when a heartbeat misses.
      }
    }

    void beat();
    const timer = window.setInterval(beat, 25_000);
    return () => {
      closed = true;
      window.clearInterval(timer);
    };
  }, [activeChannel.slug, backgroundChatRequest]);

  useEffect(() => {
    if (!body.trim()) {
      void backgroundChatRequest(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/typing`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ is_typing: false })
      }).catch(() => undefined);
      return;
    }

    const timer = window.setTimeout(() => {
      void backgroundChatRequest(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/typing`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ is_typing: true })
      }).catch(() => undefined);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [activeChannel.slug, backgroundChatRequest, body]);

  useEffect(() => {
    if (mentionFragment === null || mentionFragment.length < 1) {
      setRemoteMentionUsers([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/community/users/mentions?q=${encodeURIComponent(mentionFragment)}`, {
        headers: { accept: "application/json" },
        cache: "no-store"
      })
        .then(async (response) => {
          const payload = await response.json() as ApiEnvelope<{ users: Array<{ user_id: string; label: string; username?: string | null }> }>;
          if (response.ok && payload.ok === true) setRemoteMentionUsers(payload.data.users);
        })
        .catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [mentionFragment]);

  useEffect(() => {
    const source = new EventSource("/api/community/realtime/stream");
    source.addEventListener("open", () => setStreamStatus("live"));
    source.addEventListener("error", () => setStreamStatus("reconnecting"));
    source.addEventListener("realtime-event", (event) => {
      try {
        const realtimeEvent = JSON.parse((event as MessageEvent).data) as RealtimeEvent;
        if (realtimeEvent.event_type === "chat.message.created" || realtimeEvent.event_type === "chat.system_message.created") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          const message = realtimeEvent.payload.message;
          if (typeof channelSlug !== "string" || !isChatMessage(message)) return;
          if (seenIdsRef.current.has(message.id)) return;
          seenIdsRef.current.add(message.id);
          setMessagesByChannel((current) => ({
            ...current,
            [channelSlug]: mergeMessage(current[channelSlug] ?? [], message)
          }));
          setChannelList((current) => current.map((item) => (
            item.slug === channelSlug
              ? {
                  ...item,
                  last_message_body: message.body,
                  last_message_sender_label: message.sender_label,
                  last_message_sender_user_id: message.sender_user_id,
                  last_message_at: message.created_at,
                  unread_count: item.slug === activeChannel.slug ? 0 : (item.unread_count ?? 0) + 1
                }
              : item
          )));
          if (channelSlug === activeChannel.slug) {
            void markRead(activeChannel, [...(messagesByChannelRef.current[channelSlug] ?? []), message]);
          }
          setThreadMessages((current) => {
            if (!threadTarget || current.some((item) => item.id === message.id)) return current;
            const rootId = threadTarget.thread_root_message_id ?? threadTarget.id;
            return message.id === rootId || message.thread_root_message_id === rootId ? mergeMessage(current, message) : current;
          });
          return;
        }

        if (realtimeEvent.event_type === "chat.message.reaction.changed" || realtimeEvent.event_type === "chat.message.updated" || realtimeEvent.event_type === "chat.poll.updated") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          const message = realtimeEvent.payload.message;
          if (typeof channelSlug !== "string" || !isChatMessage(message)) return;
          setMessagesByChannel((current) => ({
            ...current,
            [channelSlug]: (current[channelSlug] ?? []).map((item) => item.id === message.id ? message : item)
          }));
          setThreadMessages((current) => current.map((item) => item.id === message.id ? message : item));
          if (realtimeEvent.event_type === "chat.message.updated") {
            setChannelList((current) => current.map((channel) => channel.slug === channelSlug && channel.last_message_id === message.id
              ? { ...channel, last_message_body: message.body, last_message_sender_label: message.sender_label }
              : channel));
          }
          return;
        }

        if (realtimeEvent.event_type === "chat.message.pinned" || realtimeEvent.event_type === "chat.message.unpinned") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          const pinnedMessages = realtimeEvent.payload.pinned_messages;
          if (typeof channelSlug !== "string" || !Array.isArray(pinnedMessages)) return;
          setPinnedByChannel((current) => ({
            ...current,
            [channelSlug]: pinnedMessages.filter((item): item is ChatPinnedMessage => typeof item === "object" && item !== null && "message_id" in item)
          }));
          return;
        }

        if (realtimeEvent.event_type === "chat.channel.controls.updated") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          if (typeof channelSlug !== "string") return;
          const nextControls = {
            slow_mode_seconds: typeof realtimeEvent.payload.slow_mode_seconds === "number" ? realtimeEvent.payload.slow_mode_seconds : 0,
            lockdown_until: typeof realtimeEvent.payload.lockdown_until === "string" ? realtimeEvent.payload.lockdown_until : null,
            lockdown_reason: typeof realtimeEvent.payload.lockdown_reason === "string" ? realtimeEvent.payload.lockdown_reason : null
          };
          setChannelList((current) => current.map((channel) => channel.slug === channelSlug ? { ...channel, ...nextControls } : channel));
          if (channelSlug === activeChannel.slug) {
            setActiveChannel((current) => ({ ...current, ...nextControls }));
            setChannelControls((current) => current ? { ...current, ...nextControls } : current);
            setSlowModeSeconds(nextControls.slow_mode_seconds);
          }
          return;
        }

        if (realtimeEvent.event_type === "chat.typing.changed") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          const typing = realtimeEvent.payload.typing;
          const onlineCount = realtimeEvent.payload.online_count;
          if (typeof channelSlug !== "string" || !Array.isArray(typing)) return;
          setPresenceByChannel((current) => ({
            ...current,
            [channelSlug]: {
              ...(current[channelSlug] ?? emptyPresence),
              typing: typing.filter((item): item is ChatPresenceSummary["typing"][number] => typeof item === "object" && item !== null && "user_id" in item),
              online_count: typeof onlineCount === "number" ? onlineCount : current[channelSlug]?.online_count ?? 0
            }
          }));
          return;
        }

        if (realtimeEvent.event_type === "chat.presence.changed") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          const onlineCount = realtimeEvent.payload.online_count;
          if (typeof channelSlug !== "string" || typeof onlineCount !== "number") return;
          setPresenceByChannel((current) => ({
            ...current,
            [channelSlug]: { ...(current[channelSlug] ?? emptyPresence), online_count: onlineCount }
          }));
          setChannelList((current) => current.map((item) => item.slug === channelSlug ? { ...item, online_count: onlineCount } : item));
          return;
        }

        if (realtimeEvent.event_type === "chat.attachment.updated") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          const attachment = realtimeEvent.payload.attachment;
          if (typeof channelSlug !== "string" || typeof attachment !== "object" || attachment === null || !("id" in attachment)) return;
          const updated = attachment as ChatAttachment;
          setMessagesByChannel((current) => ({
            ...current,
            [channelSlug]: (current[channelSlug] ?? []).map((message) => ({
              ...message,
              attachments: message.attachments?.map((item) => item.id === updated.id ? updated : item)
            }))
          }));
          setMediaByChannel((current) => current[channelSlug] ? ({
            ...current,
            [channelSlug]: { ...current[channelSlug], attachments: current[channelSlug].attachments.map((item) => item.id === updated.id ? updated : item) }
          }) : current);
          setViewer((current) => current?.attachment.id === updated.id ? null : current);
          return;
        }

        if (!["chat.message.hidden", "chat.message.deleted"].includes(realtimeEvent.event_type)) return;
        const channelSlug = realtimeEvent.payload.channel_slug;
        const messageId = realtimeEvent.payload.message_id;
        if (typeof channelSlug !== "string" || typeof messageId !== "string") return;
        if (realtimeEvent.event_type === "chat.message.deleted" && isChatMessage(realtimeEvent.payload.message)) {
          const deletedMessage = realtimeEvent.payload.message;
          setMessagesByChannel((current) => ({
            ...current,
            [channelSlug]: (current[channelSlug] ?? []).map((message) => message.id === messageId ? deletedMessage : message)
          }));
          setChannelList((current) => current.map((channel) => {
            if (channel.slug !== channelSlug || channel.last_message_id !== messageId) return channel;
            const latestVisible = (messagesByChannelRef.current[channelSlug] ?? [])
              .filter((item) => item.id !== messageId && item.status === "visible")
              .at(-1);
            return {
              ...channel,
              last_message_id: latestVisible?.id ?? null,
              last_message_at: latestVisible?.created_at ?? null,
              last_message_body: latestVisible?.body ?? null,
              last_message_sender_label: latestVisible?.sender_label ?? null,
              last_message_sender_user_id: latestVisible?.sender_user_id ?? null
            };
          }));
          const pinnedMessages = realtimeEvent.payload.pinned_messages;
          if (Array.isArray(pinnedMessages)) {
            setPinnedByChannel((current) => ({
              ...current,
              [channelSlug]: pinnedMessages.filter((item): item is ChatPinnedMessage => typeof item === "object" && item !== null && "message_id" in item)
            }));
          }
          setReplyTo((current) => current?.id === messageId ? null : current);
          return;
        }
        setMessagesByChannel((current) => ({
          ...current,
          [channelSlug]: (current[channelSlug] ?? []).filter((message) => message.id !== messageId)
        }));
      } catch {
        // Keep the lobby stream alive when a non-chat event has an unexpected payload.
      }
    });

    return () => source.close();
  }, [activeChannel, markRead, threadTarget]);

  function uploadAttachment(file: File, existingLocalId?: string) {
    const localId = existingLocalId ?? crypto.randomUUID();
    const kind = chatAttachmentKind(file);
    if (!existingLocalId && pendingAttachments.length >= 4) {
      setError("You can add up to 4 attachments to one message.");
      return;
    }
    if (!kind) {
      setError("Choose a JPG, PNG, WEBP, PDF, DOC, DOCX, ODT, or TXT file.");
      return;
    }
    const maxBytes = kind === "image" ? 8 * 1024 * 1024 : 12 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(
        kind === "image"
          ? `Image is ${formatAttachmentSize(file.size)}. Max is 8 MB.`
          : `Document is ${formatAttachmentSize(file.size)}. Max is 12 MB.`
      );
      return;
    }
    const existingPreview = existingLocalId ? pendingAttachments.find((attachment) => attachment.localId === existingLocalId)?.previewUrl : undefined;
    const previewUrl = kind === "image" ? existingPreview ?? URL.createObjectURL(file) : undefined;
    const next: PendingAttachment = { localId, file, previewUrl, state: "uploading", progress: 0 };
    setError(null);
    setPendingAttachments((current) => existingLocalId ? current.map((attachment) => attachment.localId === localId ? next : attachment) : [...current, next]);
    const form = new FormData();
    form.append("media", file);
    const request = new XMLHttpRequest();
    uploadRequestsRef.current.set(localId, request);
    request.open("POST", `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/attachments`);
    request.setRequestHeader("accept", "application/json");
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      setPendingAttachments((current) => current.map((attachment) => attachment.localId === localId ? { ...attachment, progress: Math.max(1, Math.round((event.loaded / event.total) * 100)) } : attachment));
    };
    request.onload = () => {
      uploadRequestsRef.current.delete(localId);
      try {
        const payload = JSON.parse(request.responseText) as ApiEnvelope<{ attachment: ChatAttachment }>;
        if (request.status < 200 || request.status >= 300 || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Attachment upload failed." : "Attachment upload failed.");
        setPendingAttachments((current) => current.map((attachment) => attachment.localId === localId ? { ...attachment, attachment: attachment.previewUrl ? { ...payload.data.attachment, client_preview_url: attachment.previewUrl } : payload.data.attachment, state: "ready", progress: 100, error: undefined } : attachment));
      } catch (uploadError) {
        setPendingAttachments((current) => current.map((attachment) => attachment.localId === localId ? { ...attachment, state: "failed", error: uploadError instanceof Error ? uploadError.message : "Attachment upload failed." } : attachment));
      }
    };
    request.onerror = () => {
      uploadRequestsRef.current.delete(localId);
      setPendingAttachments((current) => current.map((attachment) => attachment.localId === localId ? { ...attachment, state: "failed", error: "Connection lost during upload." } : attachment));
    };
    request.onabort = () => uploadRequestsRef.current.delete(localId);
    request.send(form);
  }

  function removePendingAttachment(attachment: PendingAttachment) {
    uploadRequestsRef.current.get(attachment.localId)?.abort();
    if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setPendingAttachments((current) => current.filter((item) => item.localId !== attachment.localId));
  }

  async function loadMedia(before?: string | null) {
    if (isLoadingMedia) return;
    setIsLoadingMedia(true);
    setMediaError(null);
    try {
      const suffix = before ? `?before=${encodeURIComponent(before)}` : "";
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/media${suffix}`, { headers: { accept: "application/json" }, cache: "no-store" });
      const payload = await response.json() as ApiEnvelope<MediaPage>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Media could not load." : "Media could not load.");
      setMediaByChannel((current) => ({
        ...current,
        [activeChannel.slug]: before
          ? { attachments: [...(current[activeChannel.slug]?.attachments ?? []), ...payload.data.attachments], page_info: payload.data.page_info }
          : payload.data
      }));
    } catch (loadError) {
      setMediaError(loadError instanceof Error ? loadError.message : "Media could not load.");
    } finally { setIsLoadingMedia(false); }
  }

  async function reportAttachment(attachment: ChatAttachment) {
    if (!window.confirm("Report this attachment to the Skillsroom moderation team?")) return;
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/attachments/${encodeURIComponent(attachment.id)}/report`, {
        method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ reason: "Attachment reported from channel viewer." })
      });
      const payload = await response.json() as ApiEnvelope<unknown>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Attachment could not be reported." : "Attachment could not be reported.");
      setNotice("Attachment reported. The moderation team can now review it.");
      setViewer(null);
    } catch (reportError) { setError(reportError instanceof Error ? reportError.message : "Attachment could not be reported."); }
  }

  async function deliverMessage(channel: ChatChannel, message: ChatMessage) {
    setIsSending(true);
    setMessagesByChannel((current) => ({
      ...current,
      [channel.slug]: (current[channel.slug] ?? []).map((item) => item.client_message_id === message.client_message_id
        ? { ...item, client_delivery_state: "sending", client_error: undefined }
        : item)
    }));
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(channel.slug)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          body: message.body,
          client_message_id: message.client_message_id,
          reply_to_message_id: message.reply_to_message_id ?? undefined,
          attachment_ids: message.attachments?.map((attachment) => attachment.id) ?? []
        })
      });
      const payload = (await response.json()) as ApiEnvelope<{ message: ChatMessage }>;
      if (!response.ok || payload.ok !== true) {
        if (payload.ok === false && payload.error?.code === "CHAT_SLOW_MODE_COOLDOWN") {
          const nextAllowedAt = payload.error.details?.next_allowed_at;
          setCooldownUntil(nextAllowedAt ?? new Date(Date.now() + (payload.error.details?.retry_after_seconds ?? 1) * 1000).toISOString());
          setCooldownClock(Date.now());
        }
        throw new Error(payload.ok === false ? payload.error?.message ?? "Message could not be sent." : "Message could not be sent.");
      }
      seenIdsRef.current.add(payload.data.message.id);
      setMessagesByChannel((current) => ({
        ...current,
        [channel.slug]: mergeMessage(current[channel.slug] ?? [], payload.data.message)
      }));
      setChannelList((current) => current.map((item) => item.id === channel.id ? {
        ...item,
        last_message_body: payload.data.message.body,
        last_message_sender_label: "You",
        last_message_sender_user_id: currentUserId,
        last_message_at: payload.data.message.created_at
      } : item));
      void markRead(channel, [...(messagesByChannelRef.current[channel.slug] ?? []), payload.data.message]);
      void backgroundChatRequest(`/api/community/channels/${encodeURIComponent(channel.slug)}/typing`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ is_typing: false })
      }).catch(() => undefined);
      if ((channel.slow_mode_seconds ?? 0) > 0 && !canModerateMessages) {
        setCooldownUntil(new Date(Date.now() + (channel.slow_mode_seconds ?? 0) * 1000).toISOString());
        setCooldownClock(Date.now());
      }
    } catch (sendError) {
      setMessagesByChannel((current) => ({
        ...current,
        [channel.slug]: (current[channel.slug] ?? []).map((item) => item.client_message_id === message.client_message_id
          ? {
              ...item,
              client_delivery_state: "failed",
              client_error: sendError instanceof Error ? sendError.message : "Message could not be sent."
            }
          : item)
      }));
      setError(sendError instanceof Error ? sendError.message : "Message could not be sent.");
    } finally {
      setIsSending(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.replace(/\s+/g, " ").trim();
    if ((!trimmed && !readyAttachments.length) || trimmed.length > chatMessageMaxLength || uploadInProgress) return;
    const clientMessageId = `web:${crypto.randomUUID()}`;
    const attachments = readyAttachments.map((attachment) => attachment.previewUrl ? { ...attachment.attachment!, client_preview_url: attachment.previewUrl } : attachment.attachment!);
    const nextMessage = pendingMessage(activeChannel.id, currentUserId, trimmed, clientMessageId, replyTo, attachments);
    shouldStickLatestRef.current = true;
    setError(null);
    setBody("");
    setPendingAttachments([]);
    setReplyTo(null);
    setMessagesByChannel((current) => ({
      ...current,
      [activeChannel.slug]: mergeMessage(current[activeChannel.slug] ?? [], nextMessage)
    }));
    await deliverMessage(activeChannel, nextMessage);
  }

  async function retryMessage(message: ChatMessage) {
    shouldStickLatestRef.current = true;
    setError(null);
    await deliverMessage(activeChannel, message);
  }

  function dismissFailedMessage(message: ChatMessage) {
    setMessagesByChannel((current) => ({
      ...current,
      [activeChannel.slug]: (current[activeChannel.slug] ?? []).filter((item) => item.client_message_id !== message.client_message_id)
    }));
  }

  async function loadOlderMessages() {
    if (!pageInfo.has_older || !pageInfo.older_cursor || isLoadingOlder) return;
    const viewport = messageViewportRef.current;
    const previousHeight = viewport?.scrollHeight ?? 0;
    shouldStickLatestRef.current = false;
    setIsLoadingOlder(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages?limit=60&cursor=${encodeURIComponent(pageInfo.older_cursor)}`,
        { headers: { accept: "application/json" }, cache: "no-store" }
      );
      const payload = (await response.json()) as ApiEnvelope<{
        messages: ChatMessage[];
        page_info: ChatMessagePageInfo;
      }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Older messages could not load." : "Older messages could not load.");
      }
      setMessagesByChannel((current) => {
        const existing = current[activeChannel.slug] ?? [];
        const ids = new Set(existing.map((message) => message.id));
        return { ...current, [activeChannel.slug]: [...payload.data.messages.filter((message) => !ids.has(message.id)), ...existing] };
      });
      setPageInfoByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.page_info }));
      window.requestAnimationFrame(() => {
        if (viewport) viewport.scrollTop = viewport.scrollHeight - previousHeight;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Older messages could not load.");
    } finally {
      setIsLoadingOlder(false);
    }
  }

  async function jumpToLatest() {
    shouldStickLatestRef.current = true;
    setShowJumpLatest(false);
    if (isContextView) {
      setIsLoadingChannel(true);
      try {
        const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages?limit=60`, {
          headers: { accept: "application/json" }, cache: "no-store"
        });
        const payload = (await response.json()) as ApiEnvelope<{
          messages: ChatMessage[];
          pinned_messages: ChatPinnedMessage[];
          presence: ChatPresenceSummary;
          page_info: ChatMessagePageInfo;
          read_boundary: string | null;
        }>;
        if (!response.ok || payload.ok !== true) throw new Error("Latest messages could not load.");
        setMessagesByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.messages }));
        setPinnedByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.pinned_messages }));
        setPresenceByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.presence }));
        setPageInfoByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.page_info }));
        setReadBoundaryByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.read_boundary }));
        setIsContextView(false);
      } catch (latestError) {
        setError(latestError instanceof Error ? latestError.message : "Latest messages could not load.");
      } finally {
        setIsLoadingChannel(false);
      }
    }
    window.requestAnimationFrame(() => {
      const viewport = messageViewportRef.current;
      viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    });
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("message");
    window.history.replaceState({}, "", nextUrl);
    void markRead(activeChannel, messages);
  }

  async function jumpToMessage(messageId: string) {
    const existing = document.getElementById(`chat-message-${messageId}`);
    if (existing) {
      shouldStickLatestRef.current = false;
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("channel", activeChannel.slug);
      nextUrl.searchParams.set("message", messageId);
      window.history.replaceState({}, "", nextUrl);
      setShowSearch(false);
      setPendingJumpMessageId(messageId);
      return;
    }
    setError(null);
    try {
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(messageId)}/context`,
        { headers: { accept: "application/json" }, cache: "no-store" }
      );
      const payload = (await response.json()) as ApiEnvelope<{ messages: ChatMessage[]; target_message_id: string }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Message could not be opened." : "Message could not be opened.");
      }
      shouldStickLatestRef.current = false;
      setIsContextView(true);
      setMessagesByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.messages }));
      setPendingJumpMessageId(payload.data.target_message_id);
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("channel", activeChannel.slug);
      nextUrl.searchParams.set("message", payload.data.target_message_id);
      window.history.replaceState({}, "", nextUrl);
      setShowSearch(false);
    } catch (jumpError) {
      setError(jumpError instanceof Error ? jumpError.message : "Message could not be opened.");
    }
  }

  function openPinnedMessage(messageId: string) {
    setShowChannelInfo(false);
    void jumpToMessage(messageId);
  }

  async function runSearch(event?: FormEvent<HTMLFormElement>, cursor?: string | null) {
    event?.preventDefault();
    if (!searchQuery.trim() && !searchUser && !searchDateFrom && !searchDateTo && !searchMentions && !searchLinks && !searchPinned) {
      setSearchError("Choose a word or at least one filter.");
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ limit: "25" });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (searchUser) params.set("user", searchUser);
      if (searchDateFrom) params.set("date_from", searchDateFrom);
      if (searchDateTo) params.set("date_to", searchDateTo);
      if (searchMentions) params.set("mentions", searchMentions);
      if (searchLinks) params.set("links", "true");
      if (searchPinned) params.set("pinned", "true");
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/search?${params}`,
        { headers: { accept: "application/json" }, cache: "no-store" }
      );
      const payload = (await response.json()) as ApiEnvelope<{ messages: ChatMessage[]; page_info: ChatSearchPageInfo }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Search could not be completed." : "Search could not be completed.");
      }
      setSearchResults((current) => cursor ? [...current, ...payload.data.messages] : payload.data.messages);
      setSearchPageInfo(payload.data.page_info);
    } catch (nextError) {
      setSearchError(nextError instanceof Error ? nextError.message : "Search could not be completed.");
    } finally {
      setIsSearching(false);
    }
  }

  async function reportMessage(message: ChatMessage) {
    const reason = window.prompt("Why are you reporting this message?");
    const trimmed = reason?.trim();
    if (!trimmed) return;

    setError(null);
    setReportingIds((current) => new Set(current).add(message.id));
    try {
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(message.id)}/report`,
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ reason: trimmed })
        }
      );
      const payload = (await response.json()) as ApiEnvelope<{ event: { id: string } }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Report could not be sent." : "Report could not be sent.");
      }
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Report could not be sent.");
    } finally {
      setReportingIds((current) => {
        const next = new Set(current);
        next.delete(message.id);
        return next;
      });
    }
  }

  function beginEdit(message: ChatMessage) {
    setActionMessage(null);
    setEditTarget(message);
    setEditBody(message.body);
    setError(null);
  }

  async function saveMessageEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget || isEditing) return;
    const trimmed = editBody.replace(/\s+/g, " ").trim();
    if (!trimmed || trimmed === editTarget.body || trimmed.length > chatMessageMaxLength) return;

    setError(null);
    setIsEditing(true);
    try {
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(editTarget.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ body: trimmed })
        }
      );
      const payload = (await response.json()) as ApiEnvelope<{ channel: ChatChannel; message: ChatMessage }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Message could not be edited." : "Message could not be edited.");
      }
      setMessagesByChannel((current) => ({
        ...current,
        [activeChannel.slug]: (current[activeChannel.slug] ?? []).map((message) => message.id === payload.data.message.id ? payload.data.message : message)
      }));
      setChannelList((current) => current.map((channel) => channel.id === activeChannel.id && channel.last_message_id === payload.data.message.id
        ? { ...channel, last_message_body: payload.data.message.body }
        : channel));
      setEditTarget(null);
      setEditBody("");
      setNotice("Message edited.");
      window.setTimeout(() => setNotice(null), 2200);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Message could not be edited.");
    } finally {
      setIsEditing(false);
    }
  }

  async function deleteMessage(message: ChatMessage) {
    if (deletingIds.has(message.id)) return;
    setError(null);
    setDeletingIds((current) => new Set(current).add(message.id));
    try {
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(message.id)}/delete`,
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(canModerateMessages && message.sender_user_id !== currentUserId
            ? { reason: "Removed by a Skillsroom moderator." }
            : {})
        }
      );
      const payload = (await response.json()) as ApiEnvelope<{ message: ChatMessage; pinned_messages?: ChatPinnedMessage[] }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Message could not be deleted." : "Message could not be deleted.");
      }
      setMessagesByChannel((current) => ({
        ...current,
        [activeChannel.slug]: (current[activeChannel.slug] ?? []).map((item) => item.id === message.id ? payload.data.message : item)
      }));
      setPinnedByChannel((current) => ({
        ...current,
        [activeChannel.slug]: (current[activeChannel.slug] ?? []).filter((pin) => pin.message_id !== message.id)
      }));
      setChannelList((current) => current.map((channel) => {
        if (channel.id !== activeChannel.id || channel.last_message_id !== message.id) return channel;
        const latestVisible = (messagesByChannelRef.current[activeChannel.slug] ?? [])
          .filter((item) => item.id !== message.id && item.status === "visible")
          .at(-1);
        return {
          ...channel,
          last_message_id: latestVisible?.id ?? null,
          last_message_at: latestVisible?.created_at ?? null,
          last_message_body: latestVisible?.body ?? null,
          last_message_sender_label: latestVisible?.sender_label ?? null,
          last_message_sender_user_id: latestVisible?.sender_user_id ?? null
        };
      }));
      setReplyTo((current) => current?.id === message.id ? null : current);
      setDeleteTarget(null);
      setActionMessage(null);
      setNotice("Message deleted.");
      window.setTimeout(() => setNotice(null), 2200);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Message could not be deleted.");
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(message.id);
        return next;
      });
    }
  }

  async function reactToMessage(message: ChatMessage, reaction: string) {
    setError(null);
    try {
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(message.id)}/reactions`,
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ reaction })
        }
      );
      const payload = (await response.json()) as ApiEnvelope<{ message: ChatMessage; action: "added" | "removed" }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Reaction could not be updated." : "Reaction could not be updated.");
      }
      setMessagesByChannel((current) => ({
        ...current,
        [activeChannel.slug]: (current[activeChannel.slug] ?? []).map((item) => item.id === payload.data.message.id ? payload.data.message : item)
      }));
    } catch (reactionError) {
      setError(reactionError instanceof Error ? reactionError.message : "Reaction could not be updated.");
    }
  }

  async function pinMessage(message: ChatMessage, durationHours: 24 | 168 | 720) {
    if (isPinning) return;
    setError(null);
    setIsPinning(true);
    try {
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(message.id)}/pin`,
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ duration_hours: durationHours })
        }
      );
      const payload = (await response.json()) as ApiEnvelope<{ pinned_messages: ChatPinnedMessage[] }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Message could not be pinned." : "Message could not be pinned.");
      }
      setPinnedByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.pinned_messages }));
      setPinBannerIndexByChannel((current) => ({ ...current, [activeChannel.slug]: 0 }));
      if (payload.data.pinned_messages.length > 3) {
        setNotice("Pinned. The chat banner rotates the latest 3 pins; all pins stay in the Pins tab.");
        window.setTimeout(() => setNotice(null), 2800);
      }
      setPinTarget(null);
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "Message could not be pinned.");
    } finally {
      setIsPinning(false);
    }
  }

  async function unpinMessage(messageId: string) {
    if (unpinningIds.has(messageId)) return;
    setError(null);
    setUnpinningIds((current) => new Set(current).add(messageId));
    try {
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(messageId)}/unpin`,
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({})
        }
      );
      const payload = (await response.json()) as ApiEnvelope<{ pinned_messages: ChatPinnedMessage[] }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Message could not be unpinned." : "Message could not be unpinned.");
      }
      setPinnedByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.pinned_messages }));
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "Message could not be unpinned.");
    } finally {
      setUnpinningIds((current) => {
        const next = new Set(current);
        next.delete(messageId);
        return next;
      });
    }
  }

  async function openThread(message: ChatMessage) {
    setThreadTarget(message);
    setIsLoadingThread(true);
    setThreadBody("");
    setError(null);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(message.id)}/thread`, {
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      const payload = (await response.json()) as ApiEnvelope<{ root_message_id: string; messages: ChatMessage[] }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Thread could not load." : "Thread could not load.");
      setThreadMessages(payload.data.messages);
    } catch (threadError) {
      setError(threadError instanceof Error ? threadError.message : "Thread could not load.");
    } finally {
      setIsLoadingThread(false);
    }
  }

  async function sendThreadReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!threadTarget || isSendingThread) return;
    const trimmed = threadBody.replace(/\s+/g, " ").trim();
    if (!trimmed || trimmed.length > chatMessageMaxLength) return;
    setIsSendingThread(true);
    setError(null);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          body: trimmed,
          client_message_id: `web-thread:${crypto.randomUUID()}`,
          reply_to_message_id: threadTarget.thread_root_message_id ?? threadTarget.id
        })
      });
      const payload = (await response.json()) as ApiEnvelope<{ message: ChatMessage }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Thread reply could not be sent." : "Thread reply could not be sent.");
      setThreadMessages((current) => mergeMessage(current, payload.data.message));
      setMessagesByChannel((current) => ({ ...current, [activeChannel.slug]: mergeMessage(current[activeChannel.slug] ?? [], payload.data.message) }));
      setThreadBody("");
    } catch (threadError) {
      setError(threadError instanceof Error ? threadError.message : "Thread reply could not be sent.");
    } finally {
      setIsSendingThread(false);
    }
  }

  async function forwardMessage() {
    if (!forwardTarget || !forwardChannelSlug || isForwarding) return;
    setIsForwarding(true);
    setError(null);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(forwardTarget.id)}/forward`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ destination_channel: forwardChannelSlug })
      });
      const payload = (await response.json()) as ApiEnvelope<{ message: ChatMessage }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Message could not be forwarded." : "Message could not be forwarded.");
      if (forwardChannelSlug === activeChannel.slug) {
        setMessagesByChannel((current) => ({ ...current, [activeChannel.slug]: mergeMessage(current[activeChannel.slug] ?? [], payload.data.message) }));
      }
      setForwardTarget(null);
      setForwardChannelSlug("");
      setNotice("Message forwarded.");
      window.setTimeout(() => setNotice(null), 2200);
    } catch (forwardError) {
      setError(forwardError instanceof Error ? forwardError.message : "Message could not be forwarded.");
    } finally {
      setIsForwarding(false);
    }
  }

  async function toggleBookmark(message: ChatMessage) {
    if (bookmarkingIds.has(message.id)) return;
    setBookmarkingIds((current) => new Set(current).add(message.id));
    setError(null);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(message.id)}/bookmark`, {
        method: "POST",
        headers: { accept: "application/json" }
      });
      const payload = (await response.json()) as ApiEnvelope<{ bookmarked: boolean }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Saved state could not change." : "Saved state could not change.");
      setMessagesByChannel((current) => ({
        ...current,
        [activeChannel.slug]: (current[activeChannel.slug] ?? []).map((item) => item.id === message.id ? { ...item, bookmarked_by_me: payload.data.bookmarked } : item)
      }));
      setNotice(payload.data.bookmarked ? "Saved privately." : "Removed from saved.");
      window.setTimeout(() => setNotice(null), 2200);
    } catch (bookmarkError) {
      setError(bookmarkError instanceof Error ? bookmarkError.message : "Saved state could not change.");
    } finally {
      setBookmarkingIds((current) => {
        const next = new Set(current);
        next.delete(message.id);
        return next;
      });
    }
  }

  async function loadBookmarks() {
    setShowBookmarks(true);
    setIsLoadingBookmarks(true);
    setError(null);
    try {
      const response = await fetch("/api/community/bookmarks", { headers: { accept: "application/json" }, cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<{ bookmarks: ChatBookmark[] }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Saved messages could not load." : "Saved messages could not load.");
      setBookmarks(payload.data.bookmarks);
    } catch (bookmarkError) {
      setError(bookmarkError instanceof Error ? bookmarkError.message : "Saved messages could not load.");
    } finally {
      setIsLoadingBookmarks(false);
    }
  }

  async function openReactionDetails(message: ChatMessage) {
    setReactionTarget(message);
    setIsLoadingReactions(true);
    setError(null);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(message.id)}/reactions`, {
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      const payload = (await response.json()) as ApiEnvelope<{ reactions: ChatReactionMember[] }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Reaction details could not load." : "Reaction details could not load.");
      setReactionMembers(payload.data.reactions);
    } catch (reactionError) {
      setError(reactionError instanceof Error ? reactionError.message : "Reaction details could not load.");
    } finally {
      setIsLoadingReactions(false);
    }
  }

  async function createPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const options = pollOptions.map((option) => option.replace(/\s+/g, " ").trim()).filter(Boolean);
    const question = pollQuestion.replace(/\s+/g, " ").trim();
    if (!question || options.length < 2 || isCreatingPoll) return;
    setIsCreatingPoll(true);
    setError(null);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/polls`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ question, options, allow_multiple: pollMultiple, closes_at: pollClosesAt || undefined })
      });
      const payload = (await response.json()) as ApiEnvelope<{ message: ChatMessage }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Poll could not be created." : "Poll could not be created.");
      setMessagesByChannel((current) => ({ ...current, [activeChannel.slug]: mergeMessage(current[activeChannel.slug] ?? [], payload.data.message) }));
      setShowPollCreator(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollMultiple(false);
      setPollClosesAt("");
    } catch (pollError) {
      setError(pollError instanceof Error ? pollError.message : "Poll could not be created.");
    } finally {
      setIsCreatingPoll(false);
    }
  }

  async function votePoll(message: ChatMessage, optionId: string) {
    if (!message.poll || votingPollIds.has(message.poll.id)) return;
    setVotingPollIds((current) => new Set(current).add(message.poll!.id));
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(message.id)}/poll-votes`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ option_ids: [optionId] })
      });
      const payload = (await response.json()) as ApiEnvelope<{ message: ChatMessage }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Vote could not be saved." : "Vote could not be saved.");
      setMessagesByChannel((current) => ({
        ...current,
        [activeChannel.slug]: (current[activeChannel.slug] ?? []).map((item) => item.id === message.id ? payload.data.message : item)
      }));
    } catch (pollError) {
      setError(pollError instanceof Error ? pollError.message : "Vote could not be saved.");
    } finally {
      setVotingPollIds((current) => {
        const next = new Set(current);
        if (message.poll) next.delete(message.poll.id);
        return next;
      });
    }
  }

  async function loadScheduledAnnouncements() {
    if (!isChatAdmin) return;
    setShowSchedule(true);
    setIsLoadingSchedules(true);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/scheduled-announcements`, { headers: { accept: "application/json" }, cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<{ announcements: ScheduledChatAnnouncement[] }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Announcements could not load." : "Announcements could not load.");
      setScheduledAnnouncements(payload.data.announcements);
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Announcements could not load.");
    } finally {
      setIsLoadingSchedules(false);
    }
  }

  async function scheduleAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scheduledBody.trim() || !scheduledFor || isScheduling) return;
    setIsScheduling(true);
    setError(null);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/scheduled-announcements`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ body: scheduledBody.trim(), scheduled_for: new Date(scheduledFor).toISOString() })
      });
      const payload = (await response.json()) as ApiEnvelope<{ announcement: ScheduledChatAnnouncement }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Announcement could not be scheduled." : "Announcement could not be scheduled.");
      setScheduledAnnouncements((current) => [payload.data.announcement, ...current]);
      setScheduledBody("");
      setScheduledFor("");
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Announcement could not be scheduled.");
    } finally {
      setIsScheduling(false);
    }
  }

  async function createDmRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipientUsername = dmUsername.trim();
    if (!recipientUsername) return;
    setError(null);
    try {
      const response = await fetch("/api/community/dm-requests", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ recipient_username: recipientUsername, intro_message: dmIntro.trim() || undefined })
      });
      const payload = (await response.json()) as ApiEnvelope<{ request: ChatDmRequest }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "DM request could not be sent." : "DM request could not be sent.");
      }
      setDmRequests((current) => [payload.data.request, ...current.filter((item) => item.id !== payload.data.request.id)]);
      setDmUsername("");
      setDmIntro("");
    } catch (dmError) {
      if (dmError instanceof Error && /already pending/i.test(dmError.message)) {
        setNotice("DM request already pending. Open Inbox to check or respond.");
        window.setTimeout(() => setNotice(null), 3200);
        return;
      }
      setError(dmError instanceof Error ? dmError.message : "DM request could not be sent.");
    }
  }

  async function requestProfileDm() {
    if (!profileUser || profileIsSelf || isRequestingProfileDm) return;
    const target = profileUser;
    setIsRequestingProfileDm(true);
    setError(null);
    try {
      const response = await fetch("/api/community/dm-requests", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ recipient_user_id: target.user_id, intro_message: profileDmIntro.trim() || undefined })
      });
      const payload = (await response.json()) as ApiEnvelope<{ request: ChatDmRequest }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "DM request could not be sent." : "DM request could not be sent.");
      }
      setDmRequests((current) => [payload.data.request, ...current.filter((item) => item.id !== payload.data.request.id)]);
      setProfileDmIntro("");
      setProfileUser(null);
      setNotice("DM request sent.");
      window.setTimeout(() => setNotice(null), 2200);
    } catch (dmError) {
      if (dmError instanceof Error && /already pending/i.test(dmError.message)) {
        setProfileUser(null);
        setNotice("DM request already pending. Open Inbox to check or respond.");
        window.setTimeout(() => setNotice(null), 3200);
        return;
      }
      setError(dmError instanceof Error ? dmError.message : "DM request could not be sent.");
    } finally {
      setIsRequestingProfileDm(false);
    }
  }

  async function respondDmRequest(requestId: string, responseValue: "accepted" | "declined") {
    setError(null);
    try {
      const response = await fetch(`/api/community/dm-requests/${encodeURIComponent(requestId)}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ response: responseValue })
      });
      const payload = (await response.json()) as ApiEnvelope<{ request: ChatDmRequest; channel: ChatChannel | null }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "DM request could not be updated." : "DM request could not be updated.");
      }
      setDmRequests((current) => current.map((item) => item.id === payload.data.request.id ? payload.data.request : item));
      if (payload.data.channel) {
        setChannelList((current) => [payload.data.channel!, ...current.filter((item) => item.id !== payload.data.channel!.id)]);
        void openChannel(payload.data.channel);
      }
    } catch (dmError) {
      setError(dmError instanceof Error ? dmError.message : "DM request could not be updated.");
    }
  }

  async function blockUser(message: ChatMessage) {
    if (!message.sender_user_id) return;
    const reason = window.prompt("Why are you blocking this user?");
    if (reason === null) return;
    setError(null);
    try {
      const response = await fetch("/api/community/users/block", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ user_id: message.sender_user_id, reason: reason.trim() || undefined })
      });
      const payload = (await response.json()) as ApiEnvelope<{ block: { blocked_user_id: string } }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "User could not be blocked." : "User could not be blocked.");
      }
      setMessagesByChannel((current) => ({
        ...current,
        [activeChannel.slug]: (current[activeChannel.slug] ?? []).filter((item) => item.sender_user_id !== message.sender_user_id)
      }));
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : "User could not be blocked.");
    }
  }

  async function loadChannelControls() {
    setIsLoadingControls(true);
    setError(null);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/controls`, { headers: { accept: "application/json" }, cache: "no-store" });
      const payload = await response.json() as ApiEnvelope<{ channel: ChatChannel; controls: ChatChannelControls }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Chat settings could not load." : "Chat settings could not load.");
      setChannelControls(payload.data.controls);
      setNotificationLevel(payload.data.controls.notification_level);
      setDmNotificationLevel(payload.data.controls.dm_notification_level);
      setPushEnabled(payload.data.controls.push_enabled);
      setSlowModeSeconds(payload.data.controls.slow_mode_seconds);
      setActiveChannel(payload.data.channel);
      setChannelList((current) => current.map((channel) => channel.id === payload.data.channel.id ? { ...channel, ...payload.data.channel } : channel));
    } catch (controlError) {
      setError(controlError instanceof Error ? controlError.message : "Chat settings could not load.");
    } finally {
      setIsLoadingControls(false);
    }
  }

  async function ensurePushSubscription() {
    let publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
    if (!publicKey) {
      const configResponse = await fetch("/api/community/push-subscriptions", { headers: { accept: "application/json" }, cache: "no-store" });
      const configPayload = await configResponse.json() as ApiEnvelope<{ public_key: string | null }>;
      if (configResponse.ok && configPayload.ok === true) publicKey = configPayload.data.public_key ?? undefined;
    }
    if (!publicKey) throw new Error("Push notifications are not configured on this deployment yet.");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser does not support push notifications.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notification permission was not granted.");
    const registration = await navigator.serviceWorker.register("/chat-push-sw.js");
    const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    const json = subscription.toJSON();
    const response = await fetch("/api/community/push-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint, keys: json.keys ?? {}, enabled: true })
    });
    const payload = await response.json() as ApiEnvelope<{ subscription: unknown }>;
    if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Push subscription could not be saved." : "Push subscription could not be saved.");
  }

  async function saveNotificationControls() {
    setIsSavingControls(true);
    setControlAction("notifications");
    setError(null);
    try {
      if (pushEnabled) await ensurePushSubscription();
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/controls/notifications`, {
        method: "PATCH",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          notification_level: notificationLevel,
          dm_notification_level: dmNotificationLevel,
          push_enabled: pushEnabled
        })
      });
      const payload = await response.json() as ApiEnvelope<{ membership: { notification_level: ChatNotificationLevel; dm_notification_level: ChatNotificationLevel; push_enabled: boolean } }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Notification settings could not be saved." : "Notification settings could not be saved.");
      setNotice("Notification settings saved.");
    } catch (controlError) {
      setPushEnabled(false);
      setError(controlError instanceof Error ? controlError.message : "Notification settings could not be saved.");
    } finally {
      setIsSavingControls(false);
      setControlAction(null);
    }
  }

  async function saveModerationControls(action: "slow" | "lock" | "unlock") {
    setIsSavingControls(true);
    setControlAction(action);
    setError(null);
    try {
      const body = action === "slow"
        ? { slow_mode_seconds: slowModeSeconds }
        : action === "unlock"
          ? { slow_mode_seconds: slowModeSeconds, unlock: true }
          : {
              slow_mode_seconds: slowModeSeconds,
              lockdown_minutes: lockdownMinutes,
              lockdown_reason: lockdownReason
            };
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/controls/moderation`, {
        method: "PATCH",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json() as ApiEnvelope<{ channel: ChatChannel }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Channel controls could not be saved." : "Channel controls could not be saved.");
      setActiveChannel(payload.data.channel);
      setChannelList((current) => current.map((channel) => channel.id === payload.data.channel.id ? { ...channel, ...payload.data.channel } : channel));
      setChannelControls((current) => current ? {
        ...current,
        slow_mode_seconds: payload.data.channel.slow_mode_seconds ?? 0,
        lockdown_until: payload.data.channel.lockdown_until ?? null,
        lockdown_reason: payload.data.channel.lockdown_reason ?? null
      } : current);
      setNotice(action === "unlock" ? "Channel lockdown removed." : action === "lock" ? "Channel locked temporarily." : "Slow mode saved.");
    } catch (controlError) {
      setError(controlError instanceof Error ? controlError.message : "Channel controls could not be saved.");
    } finally {
      setIsSavingControls(false);
      setControlAction(null);
    }
  }

  async function loadBlockedUsers() {
    setIsLoadingBlockedUsers(true);
    setError(null);
    try {
      const response = await fetch("/api/community/users/blocked", { headers: { accept: "application/json" }, cache: "no-store" });
      const payload = await response.json() as ApiEnvelope<{ blocks: ChatUserBlock[] }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Blocked users could not load." : "Blocked users could not load.");
      setBlockedUsers(payload.data.blocks);
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : "Blocked users could not load.");
    } finally {
      setIsLoadingBlockedUsers(false);
    }
  }

  async function unblockUser(userId: string) {
    setUnblockingIds((current) => new Set(current).add(userId));
    setError(null);
    try {
      const response = await fetch(`/api/community/users/blocked/${encodeURIComponent(userId)}`, { method: "DELETE", headers: { accept: "application/json" } });
      const payload = await response.json() as ApiEnvelope<{ blocked_user_id: string }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "User could not be unblocked." : "User could not be unblocked.");
      setBlockedUsers((current) => current.filter((block) => block.blocked_user_id !== userId));
      setNotice("User unblocked.");
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : "User could not be unblocked.");
    } finally {
      setUnblockingIds((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
    }
  }

  async function reportUser(message: ChatMessage) {
    if (!message.sender_user_id) return;
    const reason = window.prompt("Why are you reporting this user?");
    const trimmed = reason?.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const response = await fetch("/api/community/users/report", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ user_id: message.sender_user_id, reason: trimmed })
      });
      const payload = (await response.json()) as ApiEnvelope<{ flag: { id: string } }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "User could not be reported." : "User could not be reported.");
      }
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "User could not be reported.");
    }
  }

  async function reportProfileUser() {
    if (!profileUser || profileIsSelf || profileAction) return;
    const target = profileUser;
    const reason = window.prompt(`Why are you reporting ${target.label}?`);
    const trimmed = reason?.trim();
    if (!trimmed) return;
    setProfileAction("report");
    setError(null);
    try {
      const response = await fetch("/api/community/users/report", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ user_id: target.user_id, reason: trimmed })
      });
      const payload = (await response.json()) as ApiEnvelope<{ flag: { id: string } }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "User could not be reported." : "User could not be reported.");
      }
      setNotice("User reported.");
      window.setTimeout(() => setNotice(null), 2200);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "User could not be reported.");
    } finally {
      setProfileAction(null);
    }
  }

  async function blockProfileUser() {
    if (!profileUser || profileIsSelf || profileAction) return;
    const target = profileUser;
    const confirmed = window.confirm(`Block ${target.label}? You will stop seeing their chat messages.`);
    if (!confirmed) return;
    setProfileAction("block");
    setError(null);
    try {
      const response = await fetch("/api/community/users/block", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ user_id: target.user_id })
      });
      const payload = (await response.json()) as ApiEnvelope<{ block: { blocked_user_id: string } }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "User could not be blocked." : "User could not be blocked.");
      }
      setMessagesByChannel((current) => ({
        ...current,
        [activeChannel.slug]: (current[activeChannel.slug] ?? []).filter((item) => item.sender_user_id !== target.user_id)
      }));
      setProfileUser(null);
      setNotice("User blocked.");
      window.setTimeout(() => setNotice(null), 2200);
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : "User could not be blocked.");
    } finally {
      setProfileAction(null);
    }
  }

  const fullLayoutHeight = fullLayout && chatViewport
    ? `min(${chatViewport.height}px, calc(100dvh - ${chatViewport.top}px))`
    : undefined;

  return (
    <section className={[
      "min-w-0 overflow-hidden shadow-tight",
      fullLayout ? "fixed inset-x-0 top-0 grid h-[100dvh] grid-rows-[auto_minmax(0,1fr)] border-0 bg-[#0f1b29]" : "rounded-lg border border-line bg-white"
    ].join(" ")} style={fullLayout && chatViewport ? { height: fullLayoutHeight, maxHeight: fullLayoutHeight, top: `${chatViewport.top}px` } : undefined}>
      <header className={[
        "flex min-w-0 items-center gap-3 border-b p-3 sm:p-4",
        fullLayout ? "border-white/10 bg-[#172331] text-white" : "border-line bg-white"
      ].join(" ")}>
        <button aria-label="Go back" className={fullLayout ? "grid h-10 w-10 shrink-0 place-items-center rounded-full text-2xl text-white md:hidden" : "hidden"} onClick={handleBack} type="button">‹</button>
        <button aria-label="Open channel details" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-black text-action shadow-tight" onClick={() => setShowChannelInfo(true)} type="button">
          {channelInitials(displayActiveChannel)}
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={() => setShowChannelInfo(true)} type="button">
          <h2 className={["truncate text-lg font-black leading-tight", fullLayout ? "text-white" : "text-ink"].join(" ")}>{channelTitle(displayActiveChannel)}</h2>
          <p className={["mt-0.5 truncate text-sm leading-5", fullLayout ? "text-slate-300" : "text-muted"].join(" ")}>
            {activeChannelSubtitle}
          </p>
        </button>
        <div className={["hidden min-h-9 w-fit items-center gap-2 rounded-full border px-3 text-xs font-black sm:inline-flex", fullLayout ? "border-white/10 bg-white/5 text-slate-300" : "border-line bg-white text-muted"].join(" ")}>
          <span className={streamStatus === "live" ? "text-success" : "text-warning"}>{statusLabel}</span>
        </div>
        <button aria-label="Open saved messages" className={["hidden h-9 min-w-9 shrink-0 place-items-center rounded-full border px-2 text-xs font-black sm:grid", fullLayout ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-surfaceHigh"].join(" ")} onClick={() => void loadBookmarks()} title="Saved messages" type="button">Saved</button>
        {isChatAdmin ? <button aria-label="Schedule announcement" className={["hidden h-9 min-w-9 shrink-0 place-items-center rounded-full border px-2 text-xs font-black sm:grid", fullLayout ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-surfaceHigh"].join(" ")} onClick={() => void loadScheduledAnnouncements()} title="Schedule announcement" type="button">Announce</button> : null}
        <button aria-label="Search channel messages" className={["grid h-9 min-w-9 shrink-0 place-items-center rounded-full border px-2 text-xs font-black", fullLayout ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-surfaceHigh"].join(" ")} onClick={() => setShowSearch(true)} title="Search messages" type="button">Search</button>
        <button aria-label="Open channel details" className={["grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-black", fullLayout ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-surfaceHigh"].join(" ")} onClick={() => setShowChannelInfo(true)} title="Channel details" type="button">i</button>
      </header>

      {showChannelInfo ? (
        <div aria-label={`${channelTitle(displayActiveChannel)} details`} aria-modal="true" className="fixed inset-0 z-50 grid max-w-[100vw] overflow-x-hidden bg-black/60 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:place-items-center sm:p-4" role="dialog">
          <section className="grid h-full min-h-0 w-full min-w-0 max-w-full grid-rows-[auto_auto_1fr] overflow-hidden bg-[#172331] text-white shadow-panel sm:h-[min(48rem,92vh)] sm:max-w-2xl sm:rounded-lg sm:border sm:border-white/10">
            <header className="flex min-w-0 items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:gap-3 sm:p-4">
              <button aria-label="Close channel details" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black text-white hover:bg-white/10" onClick={() => setShowChannelInfo(false)} title="Close details" type="button">X</button>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-black text-action shadow-tight sm:h-14 sm:w-14 sm:text-base">{channelInitials(displayActiveChannel)}</span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-black text-white sm:text-xl">{channelTitle(displayActiveChannel)}</h2>
                <p className="mt-0.5 truncate text-xs font-bold text-slate-300 sm:mt-1 sm:text-sm">{activeChannelSubtitle} / {userDirectory.length} active or recent</p>
              </div>
              <button aria-label="Go to home" className="min-h-9 shrink-0 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-black text-white hover:bg-white/10" onClick={goHome} title="Go to home" type="button">Home</button>
            </header>

            <div className="grid grid-cols-6 border-b border-white/10 px-1 sm:px-3">
              {(["members", "messages", "channels", "media", "pins", "settings"] as const).map((tab) => (
                <button className={["min-h-11 min-w-0 truncate border-b-2 px-1 text-[0.62rem] font-black capitalize sm:min-h-12 sm:px-2 sm:text-sm", infoTab === tab ? "border-sky-400 text-sky-300" : "border-transparent text-slate-400 hover:text-white"].join(" ")} key={tab} onClick={() => {
                  setInfoTab(tab);
                  if (tab === "media" && !mediaByChannel[activeChannel.slug]) void loadMedia();
                  if (tab === "settings") {
                    void loadChannelControls();
                    void loadBlockedUsers();
                  }
                }} type="button">
                  {tab === "messages" ? "DMs" : tab}{tab === "messages" && dmChannels.length ? ` ${dmChannels.length}` : tab === "channels" ? ` ${communityChannels.length}` : tab === "pins" && pinnedMessages.length ? ` ${pinnedMessages.length}` : ""}
                </button>
              ))}
            </div>

            <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
              {infoTab === "members" ? (
                <div className="grid gap-2">
                  <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Active and recent members</p>
                  {userDirectory.length ? userDirectory.map((user) => (
                    <button className="flex min-w-0 items-center gap-3 rounded-md bg-white/5 p-2.5 text-left hover:bg-white/10 sm:p-3" key={user.user_id} onClick={() => openUserProfile(user)} type="button">
                      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-black text-white sm:h-11 sm:w-11">
                        {initials(user.label)}
                        {user.is_online ? <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#172331] bg-success" /> : null}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">{user.label}</p>
                        <p className="truncate text-xs font-bold text-slate-400">{user.username ? `@${user.username} / ` : ""}{user.is_online ? "online" : "recent"}</p>
                      </div>
                    </button>
                  )) : <p className="rounded-md border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-400">Members appear here as they become active in this channel.</p>}
                </div>
              ) : null}

              {infoTab === "messages" ? (
                <div className="grid gap-2">
                  <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Direct messages</p>
                  {dmChannels.length ? dmChannels.map((item) => (
                    <button className={["flex min-w-0 items-center gap-3 rounded-md border p-3 text-left", item.id === activeChannel.id ? "border-sky-400 bg-sky-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"].join(" ")} key={item.id} onClick={() => { setShowChannelInfo(false); void openChannel(item); }} type="button">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 px-1 text-xs font-black text-action">{channelInitials(item)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-white">{channelTitle(item)}</span>
                        <span className="mt-1 block truncate text-xs font-bold text-slate-400">{channelPreview(item)}</span>
                      </span>
                      {(item.unread_count ?? 0) > 0 ? <span className="rounded-full bg-sky-500 px-2 py-1 text-xs font-black text-white">{item.unread_count}</span> : null}
                    </button>
                  )) : <p className="rounded-md border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-400">Accepted DMs will appear here.</p>}
                </div>
              ) : null}

              {infoTab === "channels" ? (
                <div className="grid gap-2">
                  <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Your accessible channels</p>
                  {communityChannels.map((item) => (
                    <button className={["flex min-w-0 items-center gap-3 rounded-md border p-3 text-left", item.id === activeChannel.id ? "border-sky-400 bg-sky-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"].join(" ")} key={item.id} onClick={() => { setShowChannelInfo(false); void openChannel(item); }} type="button">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white/10 px-1 text-xs font-black text-sky-300">{channelInitials(item)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-white">{channelTitle(item)}</span>
                        <span className="mt-1 block truncate text-xs font-bold text-slate-400">{channelTypeLabel(item)} / {item.online_count ?? 0} online / {channelPreview(item)}</span>
                      </span>
                      {(item.unread_count ?? 0) > 0 ? <span className="rounded-full bg-sky-500 px-2 py-1 text-xs font-black text-white">{item.unread_count}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}

              {infoTab === "media" ? (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Shared media and files</p>
                    <span className="text-xs font-bold text-slate-500">{mediaByChannel[activeChannel.slug]?.attachments.length ?? 0}</span>
                  </div>
                  {mediaError ? <p className="rounded-md border border-red-400/30 bg-red-950/30 p-3 text-sm font-bold text-red-200">{mediaError}</p> : null}
                  {mediaByChannel[activeChannel.slug]?.attachments.length ? (
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
                      {mediaByChannel[activeChannel.slug].attachments.map((attachment) => (
                        <ChatAttachmentTile attachment={attachment} channelSlug={activeChannel.slug} className={attachment.attachment_type === "image" ? "aspect-square" : "min-h-24"} key={attachment.id} onOpenImage={(url) => setViewer({ attachment, url })} />
                      ))}
                    </div>
                  ) : !isLoadingMedia ? <p className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-400">Images and documents shared here will appear here.</p> : null}
                  {isLoadingMedia ? <p className="p-4 text-center text-sm font-bold text-slate-400">Loading media...</p> : null}
                  {mediaByChannel[activeChannel.slug]?.page_info.has_more ? <button className="min-h-10 rounded-md border border-white/10 bg-white/5 text-sm font-black hover:bg-white/10" disabled={isLoadingMedia} onClick={() => void loadMedia(mediaByChannel[activeChannel.slug].page_info.next_before)} type="button">Load older media</button> : null}
                </div>
              ) : null}

              {infoTab === "pins" ? (
                <div className="grid gap-2">
                  <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Pinned messages</p>
                  {pinnedMessages.length ? pinnedMessages.map((pin) => (
                    <article className="rounded-md border border-white/10 bg-white/5 p-3" key={pin.id}>
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <button className="min-w-0 flex-1 text-left" onClick={() => openPinnedMessage(pin.message_id)} type="button">
                          <span className="block truncate text-sm font-black text-sky-300">{pin.sender_label}</span>
                          <span className="mt-2 block truncate text-sm leading-6 text-white">{pin.body?.trim() || "Photo"}</span>
                          <span className="mt-2 block text-xs font-bold text-slate-400">{pinExpiryLabel(pin.expires_at)}</span>
                        </button>
                        {canManageAnyPin || pin.pinned_by_user_id === currentUserId || pin.sender_user_id === currentUserId ? (
                          <button className="shrink-0 rounded-sm px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60" disabled={unpinningIds.has(pin.message_id)} onClick={() => void unpinMessage(pin.message_id)} type="button">{unpinningIds.has(pin.message_id) ? "Unpinning..." : "Unpin"}</button>
                        ) : null}
                      </div>
                    </article>
                  )) : <p className="rounded-md border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-400">No messages are pinned in this channel yet.</p>}
                </div>
              ) : null}

              {infoTab === "settings" ? (
                <div className="grid gap-5">
                  <section className="grid gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Notifications</p>
                      <p className="mt-1 text-sm text-slate-300">Choose what this channel can notify you about.</p>
                    </div>
                    {isLoadingControls ? <p className="text-sm font-bold text-slate-400">Loading settings...</p> : (
                      <>
                        <div className="grid grid-cols-3 gap-1 rounded-md bg-white/5 p-1">
                          {(["all", "mentions", "none"] as const).map((level) => (
                            <button className={["min-h-10 rounded-sm px-2 text-xs font-black capitalize", notificationLevel === level ? "bg-sky-400 text-navy-950" : "text-slate-300 hover:bg-white/10"].join(" ")} key={level} onClick={() => setNotificationLevel(level)} type="button">
                              {level === "all" ? "Everything" : level === "mentions" ? "Mentions" : "Nothing"}
                            </button>
                          ))}
                        </div>
                        {activeChannel.channel_type === "dm" ? (
                          <label className="grid gap-2 text-sm font-bold text-slate-200">
                            DM notifications
                            <select className="min-h-11 rounded-md border border-white/10 bg-[#223447] px-3 text-white" onChange={(event) => setDmNotificationLevel(event.target.value as ChatNotificationLevel)} value={dmNotificationLevel}>
                              <option value="all">Everything</option>
                              <option value="mentions">Mentions only</option>
                              <option value="none">Nothing</option>
                            </select>
                          </label>
                        ) : null}
                        <label className="flex min-h-12 items-center justify-between gap-4 rounded-md border border-white/10 bg-white/5 p-3 text-sm font-black">
                          Browser/mobile push
                          <input checked={pushEnabled} className="h-5 w-5 accent-sky-400" onChange={(event) => setPushEnabled(event.target.checked)} type="checkbox" />
                        </label>
                        <button className="min-h-11 rounded-md bg-sky-500 px-4 text-sm font-black text-white hover:bg-sky-400 disabled:opacity-60" disabled={isSavingControls} onClick={() => void saveNotificationControls()} type="button">
                          {controlAction === "notifications" ? "Saving..." : "Save notifications"}
                        </button>
                      </>
                    )}
                  </section>

                  {channelControls?.can_manage_channel ? (
                    <section className="grid gap-3 border-t border-white/10 pt-5">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Channel controls</p>
                        <p className="mt-1 text-sm text-slate-300">Slow mode limits members. Lockdown stops member posting temporarily.</p>
                      </div>
                      <label className="grid gap-2 text-sm font-bold text-slate-200">
                        Slow mode
                        <select className="min-h-11 rounded-md border border-white/10 bg-[#223447] px-3 text-white" onChange={(event) => setSlowModeSeconds(Number(event.target.value))} value={slowModeSeconds}>
                          <option value={0}>Off</option>
                          <option value={5}>5 seconds</option>
                          <option value={15}>15 seconds</option>
                          <option value={30}>30 seconds</option>
                          <option value={60}>1 minute</option>
                          <option value={300}>5 minutes</option>
                          <option value={3600}>1 hour</option>
                        </select>
                      </label>
                      <button className="min-h-11 rounded-md border border-sky-300/30 bg-sky-950/30 px-4 text-sm font-black text-sky-200 hover:bg-sky-950/50 disabled:opacity-60" disabled={isSavingControls} onClick={() => void saveModerationControls("slow")} type="button">
                        {controlAction === "slow" ? "Saving slow mode..." : "Save slow mode"}
                      </button>
                      <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
                        <label className="grid gap-2 text-xs font-bold text-slate-300">
                          Lock duration
                          <select className="min-h-11 rounded-md border border-white/10 bg-[#223447] px-2 text-white" onChange={(event) => setLockdownMinutes(Number(event.target.value))} value={lockdownMinutes}>
                            <option value={30}>30 min</option>
                            <option value={60}>1 hour</option>
                            <option value={360}>6 hours</option>
                            <option value={1440}>24 hours</option>
                          </select>
                        </label>
                        <label className="grid gap-2 text-xs font-bold text-slate-300">
                          Reason
                          <input className="min-h-11 min-w-0 rounded-md border border-white/10 bg-[#223447] px-3 text-base text-white" onChange={(event) => setLockdownReason(event.target.value)} placeholder="Why is posting paused?" value={lockdownReason} />
                        </label>
                      </div>
                      {channelControls.lockdown_until && Date.parse(channelControls.lockdown_until) > Date.now() ? (
                        <button className="min-h-11 rounded-md border border-red-300/30 bg-red-950/30 px-4 text-sm font-black text-red-200 hover:bg-red-950/50 disabled:opacity-60" disabled={isSavingControls} onClick={() => void saveModerationControls("unlock")} type="button">
                          {controlAction === "unlock" ? "Unlocking..." : "Remove lockdown"}
                        </button>
                      ) : (
                        <button className="min-h-11 rounded-md bg-amber-400 px-4 text-sm font-black text-navy-950 hover:bg-amber-300 disabled:opacity-60" disabled={isSavingControls || !lockdownReason.trim()} onClick={() => void saveModerationControls("lock")} type="button">
                          {controlAction === "lock" ? "Locking channel..." : "Start temporary lockdown"}
                        </button>
                      )}
                    </section>
                  ) : null}

                  <section className="grid gap-3 border-t border-white/10 pt-5">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Blocked users</p>
                      <p className="mt-1 text-sm text-slate-300">Blocked players cannot start or continue private DMs with you.</p>
                    </div>
                    {isLoadingBlockedUsers ? <p className="text-sm font-bold text-slate-400">Loading blocked users...</p> : blockedUsers.length ? blockedUsers.map((block) => (
                      <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 p-3" key={block.blocked_user_id}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{block.blocked_label}</p>
                          {block.reason ? <p className="mt-1 truncate text-xs text-slate-400">{block.reason}</p> : null}
                        </div>
                        <button className="shrink-0 rounded-sm px-3 py-2 text-xs font-black text-sky-300 hover:bg-white/10 disabled:opacity-60" disabled={unblockingIds.has(block.blocked_user_id)} onClick={() => void unblockUser(block.blocked_user_id)} type="button">
                          {unblockingIds.has(block.blocked_user_id) ? "Unblocking..." : "Unblock"}
                        </button>
                      </div>
                    )) : <p className="rounded-md border border-dashed border-white/10 p-4 text-center text-sm font-bold text-slate-400">You have not blocked anyone.</p>}
                  </section>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {profileUser ? (
        <div aria-label={`${profileUser.label} profile`} aria-modal="true" className="fixed inset-0 z-[62] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" onClick={() => setProfileUser(null)} role="dialog">
          <section className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg border border-white/10 bg-[#171b25] text-white shadow-panel" onClick={(event) => event.stopPropagation()}>
            <div className="h-20 rounded-t-lg bg-[linear-gradient(135deg,#22d3ee,#8b5cf6_55%,#111827)]" />
            <div className="px-5 pb-5">
              <div className="-mt-10 flex items-end justify-between gap-3">
                <span className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-[#171b25] bg-navy-900 text-2xl font-black text-action shadow-tight">
                  {initials(profileUser.label)}
                  {profileUser.is_online ? <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-[#171b25] bg-success" /> : null}
                </span>
                <button aria-label="Close profile" className="mb-2 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-lg font-black text-slate-200 hover:bg-white/20" onClick={() => setProfileUser(null)} type="button">X</button>
              </div>

              <div className="mt-4 min-w-0">
                <h2 className="break-words text-3xl font-black leading-tight text-white">{profileIsSelf ? "You" : profileUser.label}</h2>
                <p className="mt-1 break-words text-base font-bold text-slate-300">{profileUser.username ? `@${profileUser.username}` : profileUser.label}</p>
                <p className="mt-2 text-sm font-bold text-slate-400">{profileUser.is_online ? "Online now" : "Recent in this channel"} / {channelTitle(displayActiveChannel)}</p>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                {profileIsSelf ? (
                  <a className="grid min-h-11 place-items-center rounded-full bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-action/90" href="/profile">Edit profile</a>
                ) : (
                  <button className="min-h-11 rounded-full bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-action/90 disabled:cursor-wait disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-none" disabled={isRequestingProfileDm} onClick={() => void requestProfileDm()} type="button">
                    {isRequestingProfileDm ? "Requesting..." : "Request DM"}
                  </button>
                )}
                {!profileIsSelf ? <button className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-black text-white hover:bg-white/15 disabled:cursor-wait disabled:opacity-60" disabled={profileAction !== null} onClick={() => void reportProfileUser()} type="button">{profileAction === "report" ? "Reporting..." : "Report"}</button> : null}
                {!profileIsSelf ? <button className="min-h-11 rounded-full bg-red-500/20 px-4 text-sm font-black text-red-100 hover:bg-red-500/30 disabled:cursor-wait disabled:opacity-60" disabled={profileAction !== null} onClick={() => void blockProfileUser()} type="button">{profileAction === "block" ? "Blocking..." : "Block"}</button> : null}
              </div>

              {!profileIsSelf ? (
                <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3">
                  <label className="grid gap-2 text-sm font-bold text-slate-300">
                    <span className="font-black text-white">DM intro</span>
                    <textarea className="min-h-20 resize-y rounded-md border border-white/10 bg-[#223447] p-3 text-base leading-6 text-white outline-none placeholder:text-slate-500 focus:border-sky-400" maxLength={240} onChange={(event) => setProfileDmIntro(event.target.value)} placeholder={`Say why you want to message ${profileUser.label}`} value={profileDmIntro} />
                  </label>
                  <p className="mt-2 text-xs leading-5 text-slate-400">DMs use request-and-accept first. Be careful with links, payment requests, and off-platform claims.</p>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3">
                <section className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Skillsroom identity</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">This public identity follows the player across Global Chat, game channels, room channels, and future DMs when they update their profile.</p>
                </section>
                <section className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Channel status</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">{profileUser.is_online ? "Active now" : "Recent"}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">{profileIsSelf ? "Your account" : "Member"}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">{channelTypeLabel(activeChannel)}</span>
                  </div>
                </section>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {showSearch ? (
        <div aria-label={`Search ${channelTitle(displayActiveChannel)}`} aria-modal="true" className="fixed inset-0 z-[60] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
          <section className="grid max-h-[92svh] w-full max-w-2xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/10 bg-[#172331] text-white shadow-panel">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black">Search {channelTitle(displayActiveChannel)}</h2>
                <p className="mt-0.5 text-xs text-slate-400">Find messages without leaving the channel.</p>
              </div>
              <button aria-label="Close search" className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-white/10" onClick={() => setShowSearch(false)} type="button">X</button>
            </header>
            <form className="grid gap-3 border-b border-white/10 p-3 sm:p-4" onSubmit={(event) => void runSearch(event)}>
              <input className="min-h-11 rounded-md border border-white/10 bg-[#223447] px-3 text-base text-white outline-none placeholder:text-slate-400 focus:border-sky-400" maxLength={120} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search message text" type="search" value={searchQuery} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <select className="min-h-10 min-w-0 rounded-md border border-white/10 bg-[#223447] px-2 text-base text-white sm:text-sm" onChange={(event) => setSearchUser(event.target.value)} value={searchUser}>
                  <option value="">Any user</option>
                  {userDirectory.map((user) => <option key={user.user_id} value={user.user_id}>{user.label}</option>)}
                </select>
                <select className="min-h-10 min-w-0 rounded-md border border-white/10 bg-[#223447] px-2 text-base text-white sm:text-sm" onChange={(event) => setSearchMentions(event.target.value as "" | "any" | "me")} value={searchMentions}>
                  <option value="">Any mention</option>
                  <option value="any">Has mentions</option>
                  <option value="me">Mentions me</option>
                </select>
                <input aria-label="Messages from date" className="min-h-10 min-w-0 rounded-md border border-white/10 bg-[#223447] px-2 text-base text-white sm:text-sm" onChange={(event) => setSearchDateFrom(event.target.value)} type="date" value={searchDateFrom} />
                <input aria-label="Messages through date" className="min-h-10 min-w-0 rounded-md border border-white/10 bg-[#223447] px-2 text-base text-white sm:text-sm" onChange={(event) => setSearchDateTo(event.target.value)} type="date" value={searchDateTo} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex min-h-9 items-center gap-2 text-sm font-bold"><input checked={searchLinks} className="h-4 w-4 accent-sky-400" onChange={(event) => setSearchLinks(event.target.checked)} type="checkbox" /> Has links</label>
                <label className="inline-flex min-h-9 items-center gap-2 text-sm font-bold"><input checked={searchPinned} className="h-4 w-4 accent-sky-400" onChange={(event) => setSearchPinned(event.target.checked)} type="checkbox" /> Pinned</label>
                <button className="ml-auto min-h-10 rounded-md bg-sky-500 px-4 text-sm font-black text-white hover:bg-sky-400 disabled:cursor-wait disabled:bg-slate-600" disabled={isSearching} type="submit">{isSearching ? "Searching..." : "Search"}</button>
              </div>
              {searchError ? <p className="rounded-md border border-red-400/30 bg-red-950/30 p-2 text-sm font-bold text-red-200">{searchError}</p> : null}
            </form>
            <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
              {searchResults.length ? (
                <div className="grid gap-2">
                  {searchResults.map((message) => (
                    <button className="grid gap-1 rounded-md border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10" key={message.id} onClick={() => void jumpToMessage(message.id)} type="button">
                      <span className="flex min-w-0 items-center justify-between gap-3"><strong className="truncate text-sm text-sky-300">{message.sender_label}</strong><span className="shrink-0 text-xs text-slate-400">{new Date(message.created_at).toLocaleString("en-NG")}</span></span>
                      <span className="line-clamp-3 text-sm leading-6 text-slate-200">{message.body}</span>
                    </button>
                  ))}
                  {searchPageInfo.has_more && searchPageInfo.next_cursor ? <button className="min-h-11 rounded-md border border-white/10 bg-white/5 font-black hover:bg-white/10 disabled:cursor-wait" disabled={isSearching} onClick={() => void runSearch(undefined, searchPageInfo.next_cursor)} type="button">{isSearching ? "Loading..." : "More results"}</button> : null}
                </div>
              ) : <p className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-400">Search results will appear here.</p>}
            </div>
          </section>
        </div>
      ) : null}

      {pinTarget ? (
        <div aria-label="Choose pin duration" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" role="dialog">
          <section className="w-full max-w-sm rounded-lg border border-white/10 bg-[#172331] p-5 text-white shadow-panel">
            <h2 className="text-xl font-black">Choose how long this pin lasts</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">You or an authorized team member can unpin it sooner.</p>
            <div className="mt-5 grid gap-2">
              {([
                [24, "24 hours"],
                [168, "7 days"],
                [720, "30 days"]
              ] as const).map(([hours, label]) => (
                <label className={["flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3", pinDurationHours === hours ? "border-sky-400 bg-sky-400/10" : "border-white/10 bg-white/5"].join(" ")} key={hours}>
                  <input checked={pinDurationHours === hours} className="h-5 w-5 accent-sky-400" disabled={isPinning} name="pin-duration" onChange={() => setPinDurationHours(hours)} type="radio" />
                  <span className="font-black">{label}</span>
                </label>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button className="min-h-11 rounded-md border border-white/10 bg-white/5 px-4 font-black text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50" disabled={isPinning} onClick={() => setPinTarget(null)} type="button">Cancel</button>
              <button className="min-h-11 rounded-md bg-sky-500 px-4 font-black text-white hover:bg-sky-400 disabled:cursor-wait disabled:bg-sky-700" disabled={isPinning} onClick={() => void pinMessage(pinTarget, pinDurationHours)} type="button">{isPinning ? "Pinning..." : "Pin"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {notice ? (
        <div aria-live="polite" className="fixed left-1/2 top-[max(env(safe-area-inset-top),1rem)] z-[80] -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-navy-950 shadow-panel">
          {notice}
        </div>
      ) : null}

      {actionMessage ? (
        <div aria-label="Message actions" aria-modal="true" className="fixed inset-0 z-[65] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" onClick={() => setActionMessage(null)} role="dialog">
          <section className="w-full max-w-md overflow-hidden rounded-lg border border-white/10 bg-[#172331] text-white shadow-panel" onClick={(event) => event.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{actionMessage.sender_user_id === currentUserId ? "Your message" : actionMessage.sender_label}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">{actionMessage.status === "deleted" ? "Deleted message" : actionMessage.body}</p>
              </div>
              <button aria-label="Close message actions" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl text-slate-300 hover:bg-white/10" onClick={() => setActionMessage(null)} type="button">X</button>
            </header>
            <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3">
              {actionMessage.status === "visible" ? (
                <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => { setReplyTo(actionMessage); setActionMessage(null); composerRef.current?.focus(); }} type="button">Reply</button>
              ) : null}
              {actionMessage.status === "visible" ? (
                <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => { setActionMessage(null); void openThread(actionMessage); }} type="button">Open thread</button>
              ) : null}
              {actionMessage.status === "visible" ? (
                <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => { setForwardTarget(actionMessage); setForwardChannelSlug(activeChannel.slug); setActionMessage(null); }} type="button">Forward</button>
              ) : null}
              {actionMessage.status === "visible" ? (
                <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" disabled={bookmarkingIds.has(actionMessage.id)} onClick={() => void toggleBookmark(actionMessage)} type="button">{actionMessage.bookmarked_by_me ? "Unsave" : "Save"}</button>
              ) : null}
              {actionMessage.status === "visible" && actionMessage.reactions?.some((reaction) => reaction.count > 0) ? (
                <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => { setActionMessage(null); void openReactionDetails(actionMessage); }} type="button">Reactions</button>
              ) : null}
              {actionMessage.status === "visible" ? (
                <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => void copyToClipboard(actionMessage.body, "Message copied.")} type="button">Copy text</button>
              ) : null}
              <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => void copyToClipboard(messageLink(actionMessage), "Message link copied.")} type="button">Copy link</button>
              {canEditMessage(actionMessage) ? (
                <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => beginEdit(actionMessage)} type="button">Edit</button>
              ) : null}
              {canDeleteMessage(actionMessage) ? (
                <button className="min-h-14 bg-[#172331] px-3 text-sm font-black text-red-300 hover:bg-red-950/40" onClick={() => { setDeleteTarget(actionMessage); setActionMessage(null); }} type="button">Delete</button>
              ) : null}
              {actionMessage.status === "visible" && (actionMessage.sender_user_id === currentUserId || canManageAnyPin) && !pinnedMessages.some((pin) => pin.message_id === actionMessage.id) ? (
                <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => { setPinTarget(actionMessage); setActionMessage(null); }} type="button">Pin</button>
              ) : null}
              {actionMessage.status === "visible" && actionMessage.sender_user_id !== currentUserId ? (
                <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => { setActionMessage(null); void reportMessage(actionMessage); }} type="button">Report</button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {editTarget ? (
        <div aria-label="Edit message" aria-modal="true" className="fixed inset-0 z-[70] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
          <form className="w-full max-w-lg rounded-lg border border-white/10 bg-[#172331] p-4 text-white shadow-panel sm:p-5" onSubmit={saveMessageEdit}>
            <h2 className="text-lg font-black">Edit message</h2>
            <p className="mt-1 text-sm text-slate-300">Your edit will be marked, and the previous version remains available to authorized moderators.</p>
            <textarea autoFocus className="mt-4 min-h-28 w-full resize-y rounded-md border border-white/10 bg-[#223447] p-3 text-base leading-6 text-white outline-none focus:border-sky-400" disabled={isEditing} maxLength={chatMessageMaxLength} onChange={(event) => setEditBody(event.target.value)} value={editBody} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="min-h-11 rounded-md border border-white/10 bg-white/5 px-4 font-black hover:bg-white/10 disabled:opacity-50" disabled={isEditing} onClick={() => { setEditTarget(null); setEditBody(""); }} type="button">Cancel</button>
              <button className="min-h-11 rounded-md bg-sky-500 px-4 font-black hover:bg-sky-400 disabled:cursor-wait disabled:bg-slate-600" disabled={isEditing || !editBody.trim() || editBody.replace(/\s+/g, " ").trim() === editTarget.body} type="submit">{isEditing ? "Saving..." : "Save edit"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div aria-label="Confirm message deletion" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" role="alertdialog">
          <section className="w-full max-w-sm rounded-lg border border-white/10 bg-[#172331] p-5 text-white shadow-panel">
            <h2 className="text-xl font-black">Delete this message?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Everyone will see &quot;This message was deleted.&quot; Replies will stay connected, and the original is retained only for authorized audit review.</p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button className="min-h-11 rounded-md border border-white/10 bg-white/5 px-4 font-black hover:bg-white/10 disabled:opacity-50" disabled={deletingIds.has(deleteTarget.id)} onClick={() => setDeleteTarget(null)} type="button">No, keep it</button>
              <button className="min-h-11 rounded-md bg-red-600 px-4 font-black hover:bg-red-500 disabled:cursor-wait disabled:bg-red-900" disabled={deletingIds.has(deleteTarget.id)} onClick={() => void deleteMessage(deleteTarget)} type="button">{deletingIds.has(deleteTarget.id) ? "Deleting..." : "Yes, delete"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {threadTarget ? (
        <div aria-label="Thread" aria-modal="true" className="fixed inset-0 z-[70] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
          <section className="grid max-h-[92svh] w-full max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-white/10 bg-[#172331] text-white shadow-panel">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0"><h2 className="text-lg font-black">Thread</h2><p className="truncate text-xs text-slate-400">{threadTarget.sender_label}: {threadTarget.body || "Photo"}</p></div>
              <button className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-white/10" onClick={() => setThreadTarget(null)} type="button">X</button>
            </header>
            <div className="min-h-0 overflow-y-auto p-3">
              {isLoadingThread ? <p className="p-4 text-center text-sm font-bold text-slate-400">Loading thread...</p> : (
                <div className="grid gap-2">
                  {threadMessages.map((message) => <article className="rounded-md border border-white/10 bg-white/5 p-3" key={message.id}><p className="text-xs font-black text-sky-300">{message.sender_user_id === currentUserId ? "You" : message.sender_label} <span className="text-slate-500">{messageTime(message.created_at)}</span></p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.status === "deleted" ? "This message was deleted." : message.body}</p></article>)}
                </div>
              )}
            </div>
            <form className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-white/10 p-3" onSubmit={sendThreadReply}>
              <input className="min-h-11 rounded-full border border-white/10 bg-[#223447] px-4 text-base outline-none focus:border-sky-400" maxLength={chatMessageMaxLength} onChange={(event) => setThreadBody(event.target.value)} placeholder="Reply in thread" value={threadBody} />
              <button className="min-h-11 rounded-full bg-sky-500 px-4 font-black disabled:bg-slate-600" disabled={isSendingThread || !threadBody.trim()} type="submit">{isSendingThread ? "..." : "Send"}</button>
            </form>
          </section>
        </div>
      ) : null}

      {forwardTarget ? (
        <div aria-label="Forward message" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" role="dialog">
          <section className="w-full max-w-sm rounded-lg border border-white/10 bg-[#172331] p-5 text-white shadow-panel">
            <h2 className="text-xl font-black">Forward message</h2>
            <p className="mt-2 line-clamp-2 text-sm text-slate-300">{forwardTarget.body || "Photo"}</p>
            <select className="mt-4 min-h-11 w-full rounded-md border border-white/10 bg-[#223447] px-3 text-base" onChange={(event) => setForwardChannelSlug(event.target.value)} value={forwardChannelSlug}>
              {channelList.map((channel) => <option key={channel.id} value={channel.slug}>{channelTitle(channel)}</option>)}
            </select>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="min-h-11 rounded-md border border-white/10 bg-white/5 font-black" disabled={isForwarding} onClick={() => setForwardTarget(null)} type="button">Cancel</button>
              <button className="min-h-11 rounded-md bg-sky-500 font-black disabled:bg-slate-600" disabled={isForwarding || !forwardChannelSlug} onClick={() => void forwardMessage()} type="button">{isForwarding ? "Forwarding..." : "Forward"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {showBookmarks ? (
        <div aria-label="Saved messages" aria-modal="true" className="fixed inset-0 z-[70] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
          <section className="grid max-h-[90svh] w-full max-w-lg grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/10 bg-[#172331] text-white shadow-panel">
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h2 className="text-lg font-black">Saved messages</h2><button className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-white/10" onClick={() => setShowBookmarks(false)} type="button">X</button></header>
            <div className="min-h-0 overflow-y-auto p-3">
              {isLoadingBookmarks ? <p className="p-4 text-center text-sm font-bold text-slate-400">Loading saved messages...</p> : bookmarks.length ? <div className="grid gap-2">{bookmarks.map((bookmark) => <button className="grid gap-1 rounded-md border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10" key={bookmark.message_id} onClick={() => { const channel = channelList.find((item) => item.slug === bookmark.channel_slug); setShowBookmarks(false); if (channel && channel.slug !== activeChannel.slug) void openChannel(channel).then(() => jumpToMessage(bookmark.message_id)); else void jumpToMessage(bookmark.message_id); }} type="button"><span className="text-xs font-black text-sky-300">{bookmark.channel_title}</span><span className="line-clamp-2 text-sm leading-6">{bookmark.message.body || "Photo"}</span></button>)}</div> : <p className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-400">Messages you save privately will appear here.</p>}
            </div>
          </section>
        </div>
      ) : null}

      {reactionTarget ? (
        <div aria-label="Reaction details" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" role="dialog">
          <section className="w-full max-w-sm rounded-lg border border-white/10 bg-[#172331] p-5 text-white shadow-panel">
            <div className="flex items-center justify-between"><h2 className="text-xl font-black">Reactions</h2><button className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-white/10" onClick={() => setReactionTarget(null)} type="button">X</button></div>
            <div className="mt-4 grid gap-2">
              {isLoadingReactions ? <p className="text-sm font-bold text-slate-400">Loading...</p> : reactionMembers.length ? reactionMembers.map((member) => <div className="flex items-center justify-between rounded-md bg-white/5 p-3" key={`${member.user_id}-${member.reaction}`}><span className="font-black">{member.label}</span><span>{reactionOptions.find((item) => item.key === member.reaction)?.label ?? member.reaction}</span></div>) : <p className="text-sm font-bold text-slate-400">No reactions yet.</p>}
            </div>
          </section>
        </div>
      ) : null}

      {showPollCreator ? (
        <div aria-label="Create poll" aria-modal="true" className="fixed inset-0 z-[70] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
          <form className="w-full max-w-lg rounded-lg border border-white/10 bg-[#172331] p-4 text-white shadow-panel" onSubmit={createPoll}>
            <h2 className="text-lg font-black">Create poll</h2>
            <input className="mt-3 min-h-11 w-full rounded-md border border-white/10 bg-[#223447] px-3 text-base outline-none focus:border-sky-400" maxLength={160} onChange={(event) => setPollQuestion(event.target.value)} placeholder="Question" value={pollQuestion} />
            <div className="mt-3 grid gap-2">{pollOptions.map((option, index) => <input className="min-h-10 rounded-md border border-white/10 bg-[#223447] px-3 text-base outline-none focus:border-sky-400" key={index} maxLength={80} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Option ${index + 1}`} value={option} />)}</div>
            <div className="mt-3 flex flex-wrap gap-2"><button className="rounded-full border border-white/10 px-3 py-2 text-xs font-black" disabled={pollOptions.length >= 10} onClick={() => setPollOptions((current) => [...current, ""])} type="button">Add option</button><label className="inline-flex items-center gap-2 text-sm font-bold"><input checked={pollMultiple} className="h-4 w-4 accent-sky-400" onChange={(event) => setPollMultiple(event.target.checked)} type="checkbox" /> Multiple answers</label></div>
            <input className="mt-3 min-h-10 w-full rounded-md border border-white/10 bg-[#223447] px-3 text-base" onChange={(event) => setPollClosesAt(event.target.value)} type="datetime-local" value={pollClosesAt} />
            <div className="mt-4 grid grid-cols-2 gap-2"><button className="min-h-11 rounded-md border border-white/10 bg-white/5 font-black" disabled={isCreatingPoll} onClick={() => setShowPollCreator(false)} type="button">Cancel</button><button className="min-h-11 rounded-md bg-sky-500 font-black disabled:bg-slate-600" disabled={isCreatingPoll || !pollQuestion.trim() || pollOptions.filter((option) => option.trim()).length < 2} type="submit">{isCreatingPoll ? "Creating..." : "Create poll"}</button></div>
          </form>
        </div>
      ) : null}

      {showSchedule ? (
        <div aria-label="Scheduled announcements" aria-modal="true" className="fixed inset-0 z-[70] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
          <section className="grid max-h-[92svh] w-full max-w-lg grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/10 bg-[#172331] text-white shadow-panel">
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h2 className="text-lg font-black">Scheduled announcements</h2><button className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-white/10" onClick={() => setShowSchedule(false)} type="button">X</button></header>
            <form className="grid gap-2 border-b border-white/10 p-3" onSubmit={scheduleAnnouncement}><textarea className="min-h-24 rounded-md border border-white/10 bg-[#223447] p-3 text-base" maxLength={1000} onChange={(event) => setScheduledBody(event.target.value)} placeholder="Announcement message" value={scheduledBody} /><input className="min-h-10 rounded-md border border-white/10 bg-[#223447] px-3 text-base" onChange={(event) => setScheduledFor(event.target.value)} type="datetime-local" value={scheduledFor} /><button className="min-h-10 rounded-md bg-sky-500 font-black disabled:bg-slate-600" disabled={isScheduling || !scheduledBody.trim() || !scheduledFor} type="submit">{isScheduling ? "Scheduling..." : "Schedule"}</button></form>
            <div className="min-h-0 overflow-y-auto p-3">{isLoadingSchedules ? <p className="text-sm font-bold text-slate-400">Loading...</p> : scheduledAnnouncements.length ? <div className="grid gap-2">{scheduledAnnouncements.map((item) => <article className="rounded-md border border-white/10 bg-white/5 p-3" key={item.id}><p className="line-clamp-2 text-sm">{item.body}</p><p className="mt-2 text-xs font-bold text-slate-400">{new Date(item.scheduled_for).toLocaleString("en-NG")} · {item.status}</p></article>)}</div> : <p className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-400">No scheduled announcements.</p>}</div>
          </section>
        </div>
      ) : null}

      <div className={[
        "grid",
        fullLayout ? "h-full min-h-0 overflow-hidden bg-[#0f1b29] md:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(34rem,58rem)_20rem] 2xl:grid-cols-[20rem_minmax(38rem,64rem)_22rem] xl:justify-center" : "min-h-[34rem] lg:grid-cols-[20rem_minmax(0,1fr)]"
      ].join(" ")}>
        <aside className={[
          "border-line",
          fullLayout ? "hidden min-h-0 overflow-hidden border-r border-white/10 bg-[#162536] md:block" : "border-b bg-white lg:border-b-0 lg:border-r"
        ].join(" ")}>
          <div className={[
            "overflow-y-auto p-3",
            fullLayout ? "max-h-64 lg:h-full lg:max-h-none" : "max-h-72 lg:max-h-[62vh]"
          ].join(" ")}>
            <a
              className={[
                "mb-3 flex min-h-11 items-center justify-between rounded-md border px-3 text-sm font-black transition",
                fullLayout ? "border-sky-400/30 bg-sky-400/10 text-sky-200 hover:bg-sky-400/15" : "border-cyan bg-cyanSoft text-ink hover:border-action"
              ].join(" ")}
              href="/notifications"
            >
              <span>Message requests</span>
              <span className={["rounded-full px-2 py-0.5 text-xs", fullLayout ? "bg-white/10 text-white" : "bg-white text-cyan"].join(" ")}>
                {pendingIncomingDmRequests.length}
              </span>
            </a>
            <form className={["mb-3 grid gap-2 rounded-md border p-3", fullLayout ? "border-white/10 bg-white/5" : "border-line bg-surface"].join(" ")} onSubmit={createDmRequest}>
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">DM Request</p>
              <input
                className={["min-h-10 rounded-md border px-3 text-sm outline-none focus:border-action", fullLayout ? "border-white/10 bg-[#223447] text-white placeholder:text-slate-400" : "border-line bg-white"].join(" ")}
                onChange={(event) => setDmUsername(event.target.value)}
                placeholder="username"
                value={dmUsername}
              />
              <input
                className={["min-h-10 rounded-md border px-3 text-sm outline-none focus:border-action", fullLayout ? "border-white/10 bg-[#223447] text-white placeholder:text-slate-400" : "border-line bg-white"].join(" ")}
                maxLength={500}
                onChange={(event) => setDmIntro(event.target.value)}
                placeholder="intro message"
                value={dmIntro}
              />
              <button className="min-h-10 rounded-md bg-action px-3 text-sm font-black text-navy-950 shadow-action" type="submit">Request DM</button>
            </form>
            {pendingIncomingDmRequests.length ? (
              <div className="mb-3 grid gap-2 rounded-md border border-line bg-white p-3">
                <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-muted">Pending DMs</p>
                {pendingIncomingDmRequests.slice(0, 3).map((request) => (
                  <div className="grid gap-2 rounded-md bg-surfaceHigh p-2" key={request.id}>
                    <p className="text-xs font-bold text-ink">{request.requester_label}</p>
                    {request.intro_message ? <p className="text-xs text-muted">{request.intro_message}</p> : null}
                    <div className="grid grid-cols-2 gap-2">
                      <button className="rounded-md bg-action px-2 py-1 text-xs font-black text-navy-950" onClick={() => respondDmRequest(request.id, "accepted")} type="button">Accept</button>
                      <button className="rounded-md border border-line bg-white px-2 py-1 text-xs font-black text-ink" onClick={() => respondDmRequest(request.id, "declined")} type="button">Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mb-3 grid gap-2">
              <p className={["font-mono text-[0.68rem] font-black uppercase tracking-[0.14em]", fullLayout ? "text-sky-300" : "text-cyan"].join(" ")}>Messages</p>
              {dmChannels.length ? dmChannels.map((item) => {
                const active = item.id === activeChannel.id;
                return (
                  <button
                    className={[
                      "grid min-h-16 min-w-0 gap-1 rounded-md border px-3 py-2 text-left transition",
                      fullLayout
                        ? active ? "border-sky-400/50 bg-sky-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                        : active ? "border-cyan bg-cyanSoft" : "border-line bg-white hover:bg-surfaceHigh"
                    ].join(" ")}
                    key={item.id}
                    onClick={() => openChannel(item)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <strong className={["flex min-w-0 items-center gap-2 truncate text-sm font-black", fullLayout ? "text-white" : "text-ink"].join(" ")}><span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-full bg-navy-900 px-1 text-[0.62rem] text-action">{channelInitials(item)}</span><span className="truncate">{channelTitle(item)}</span></strong>
                      {(item.unread_count ?? 0) > 0 ? (
                        <span className="rounded-md bg-danger px-2 py-0.5 text-[0.65rem] font-black text-white">{item.unread_count}</span>
                      ) : null}
                    </span>
                    <span className={["truncate text-xs font-bold", fullLayout ? "text-slate-400" : "text-muted"].join(" ")}>{channelPreview(item)}</span>
                  </button>
                );
              }) : <p className={["rounded-md border border-dashed p-3 text-xs font-bold", fullLayout ? "border-white/10 text-slate-400" : "border-line text-muted"].join(" ")}>Accepted DMs appear here.</p>}
            </div>
            <div className="grid gap-2">
              <p className={["font-mono text-[0.68rem] font-black uppercase tracking-[0.14em]", fullLayout ? "text-sky-300" : "text-cyan"].join(" ")}>Channels</p>
              {communityChannels.map((item) => {
                const active = item.id === activeChannel.id;
                return (
                  <button
                    className={[
                      "grid min-h-16 min-w-0 gap-1 rounded-md border px-3 py-2 text-left transition",
                      fullLayout
                        ? active ? "border-sky-400/50 bg-sky-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                        : active ? "border-cyan bg-cyanSoft" : "border-line bg-white hover:bg-surfaceHigh"
                    ].join(" ")}
                    key={item.id}
                    onClick={() => openChannel(item)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <strong className={["flex min-w-0 items-center gap-2 truncate text-sm font-black", fullLayout ? "text-white" : "text-ink"].join(" ")}><span className="grid h-7 min-w-9 shrink-0 place-items-center rounded-sm bg-navy-900 px-1 text-[0.62rem] text-action">{channelInitials(item)}</span><span className="truncate">{channelTitle(item)}</span></strong>
                      {(item.unread_count ?? 0) > 0 ? (
                        <span className="rounded-md bg-danger px-2 py-0.5 text-[0.65rem] font-black text-white">{item.unread_count}</span>
                      ) : null}
                    </span>
                    <span className={["truncate text-xs font-bold", fullLayout ? "text-slate-400" : "text-muted"].join(" ")}>{channelTypeLabel(item)} - {item.online_count ?? 0} online - {channelPreview(item)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex h-full max-h-full min-h-0 min-w-0 flex-col overflow-hidden border-x border-white/10 bg-[#132333] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06)_0,rgba(255,255,255,0)_22rem)] shadow-panel">
          {currentPinnedMessage ? (
            <div className="z-10 grid min-h-12 min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 overflow-hidden border-b border-white/10 bg-[#172331] px-2 py-1.5 shadow-tight sm:gap-2 sm:px-4">
              <button className="flex min-w-0 items-center gap-2 overflow-hidden text-left" onClick={openPinnedBannerMessage} type="button">
                <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-white/10 text-sm text-sky-300">📌</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-sky-300">
                    Pinned message{pinnedMessages.length > 1 ? ` ${pinBannerIndex + 1}/${Math.min(pinnedMessages.length, 3)}` : ""}
                  </span>
                  <span className="block truncate text-xs font-bold text-white">{currentPinnedMessage.sender_label}: {currentPinnedMessage.body?.trim() || "Photo"}</span>
                </span>
              </button>
              {pinnedMessages.length > 1 ? (
                <button aria-label={`${pinnedMessages.length} pinned messages`} className="grid h-8 min-w-8 shrink-0 place-items-center rounded-full bg-white/10 px-1 text-[0.68rem] font-black text-sky-200 hover:bg-white/15" onClick={() => { setInfoTab("pins"); setShowChannelInfo(true); }} type="button">{pinnedMessages.length}</button>
              ) : null}
              {canManageAnyPin || currentPinnedMessage.pinned_by_user_id === currentUserId || currentPinnedMessage.sender_user_id === currentUserId ? (
                <button aria-label="Unpin current message" className="shrink-0 rounded-sm px-1.5 py-1 text-[0.56rem] font-black uppercase tracking-[0.06em] text-slate-300 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60 sm:px-2 sm:text-[0.62rem] sm:tracking-[0.1em]" disabled={unpinningIds.has(currentPinnedMessage.message_id)} onClick={() => void unpinMessage(currentPinnedMessage.message_id)} type="button">{unpinningIds.has(currentPinnedMessage.message_id) ? "..." : "Unpin"}</button>
              ) : null}
            </div>
          ) : null}
          <div className={[
            "min-h-0 min-w-0 flex-1 overflow-x-hidden overscroll-contain overflow-y-auto p-3 sm:p-4",
            fullLayout ? "xl:px-6" : "max-h-[58vh]"
          ].join(" ")} style={{ WebkitOverflowScrolling: "touch" }} onScroll={(event) => {
            const viewport = event.currentTarget;
            const nearLatest = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 120;
            shouldStickLatestRef.current = nearLatest;
            setShowJumpLatest(!nearLatest);
          }} ref={messageViewportRef}>
            <div className="mx-auto mb-2 flex w-full max-w-4xl min-w-0 flex-wrap items-center gap-2 rounded-md border border-white/10 bg-[#203244]/90 px-3 py-2 text-xs font-bold text-slate-300">
              <span>{presence.online_count} online</span>
              {presence.active.slice(0, 5).map((user) => (
                <span className="rounded-sm bg-surfaceHigh px-2 py-1" key={user.user_id}>{user.label}</span>
              ))}
            </div>
            {pageInfo.has_older ? (
              <div className="mb-3 flex justify-center">
                <button className="min-h-9 rounded-full border border-white/10 bg-[#223447] px-4 text-xs font-black text-slate-200 hover:bg-[#2c4358] disabled:cursor-wait disabled:opacity-60" disabled={isLoadingOlder} onClick={() => void loadOlderMessages()} type="button">{isLoadingOlder ? "Loading older..." : "Load older messages"}</button>
              </div>
            ) : null}
            {isLoadingChannel ? (
              <div className={["mx-auto grid w-full max-w-4xl place-items-center rounded-md border border-dashed p-6 text-center", isDirectMessage ? "min-h-36 border-white/10 bg-[#203244]/80 text-slate-200" : "h-full min-h-[18rem] border-line bg-white"].join(" ")}>
                <p className={["text-sm font-black", isDirectMessage ? "text-slate-200" : "text-muted"].join(" ")}>{isDirectMessage ? "Opening conversation..." : "Loading channel..."}</p>
              </div>
            ) : messages.length ? (
              <div className="mx-auto grid w-full max-w-4xl gap-2">
                {messages.map((message, index) => {
                  const mine = message.sender_user_id === currentUserId;
                  const system = message.message_kind === "system";
                  const deleted = message.status === "deleted";
                  const isPinned = pinnedMessages.some((pin) => pin.message_id === message.id);
                  const canOpenSenderProfile = Boolean(message.sender_user_id && !system);
                  const previous = messages[index - 1];
                  const showDate = !previous || messageDate(previous.created_at) !== messageDate(message.created_at);
                  return (
                    <div key={message.id}>
                      {showDate ? (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-full bg-[#223447]/90 px-3 py-1 text-xs font-black text-slate-300 shadow-tight">{messageDate(message.created_at)}</span>
                        </div>
                      ) : null}
                      {message.id === unreadMessageId ? (
                        <div className="my-3 flex items-center gap-3" role="separator">
                          <span className="h-px flex-1 bg-sky-400/50" />
                          <span className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-sky-300">New messages</span>
                          <span className="h-px flex-1 bg-sky-400/50" />
                        </div>
                      ) : null}
                    <article
                      id={`chat-message-${message.id}`}
                      className={[
                        "group grid max-w-[min(92%,38rem)] select-none gap-1.5 rounded-2xl border px-3 py-2 shadow-tight",
                        deleted ? (mine ? "ml-auto border-dashed border-white/15 bg-[#1d2b38] text-slate-400" : "mr-auto border-dashed border-white/15 bg-[#1d2b38] text-slate-400") : system ? "mx-auto border-action/30 bg-amber-50" : mine ? "ml-auto rounded-br-md border-emerald-300/20 bg-[#d7f9df]" : "mr-auto rounded-bl-md border-white/10 bg-[#26394b] text-white"
                      ].join(" ")}
                      onContextMenu={(event) => { event.preventDefault(); if (!message.client_delivery_state) setActionMessage(message); }}
                      onPointerCancel={clearLongPress}
                      onPointerDown={(event) => { if (!message.client_delivery_state) beginLongPress(message, event.target); }}
                      onPointerLeave={clearLongPress}
                      onPointerUp={clearLongPress}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        {!mine && !system ? <button aria-label={`Open ${message.sender_label} profile`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-black text-white hover:ring-2 hover:ring-sky-300" disabled={!canOpenSenderProfile} onClick={() => openMessageUserProfile(message)} type="button">{initials(message.sender_label)}</button> : null}
                        {canOpenSenderProfile ? (
                          <button className={["break-words text-left text-sm font-black [overflow-wrap:anywhere]", mine ? "text-ink hover:text-cyan" : "text-sky-300 hover:text-sky-200"].join(" ")} onClick={() => openMessageUserProfile(message)} type="button">{mine ? "You" : message.sender_label}</button>
                        ) : (
                          <strong className={["break-words text-sm font-black [overflow-wrap:anywhere]", mine || system ? "text-ink" : "text-sky-300"].join(" ")}>{system ? "Skillsroom" : mine ? "You" : message.sender_label}</strong>
                        )}
                        {!mine && !system ? <button className="text-xs font-bold text-slate-300 hover:text-white" onClick={() => openMessageUserProfile(message)} type="button">{displayHandle(message)}</button> : null}
                        <span className={["font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em]", mine || system ? "text-muted" : "text-slate-400"].join(" ")}>{messageTime(message.created_at)}</span>
                        {message.edited_at && !deleted ? <span className={["text-[0.68rem] font-bold", mine || system ? "text-muted" : "text-slate-400"].join(" ")}>edited</span> : null}
                        {isPinned ? <span className="rounded-sm bg-action/20 px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-ink">Pinned</span> : null}
                        {message.bookmarked_by_me ? <span className={["text-[0.68rem] font-black uppercase tracking-[0.12em]", mine ? "text-muted" : "text-slate-300"].join(" ")}>Saved</span> : null}
                        {!message.client_delivery_state ? <button aria-label="Open message actions" className={["grid h-7 w-7 place-items-center rounded-full text-base font-black", mine && !deleted ? "text-muted hover:bg-white" : "text-slate-300 hover:bg-white/10"].join(" ")} onClick={() => setActionMessage(message)} title="Message actions" type="button">...</button> : null}
                        {!deleted && !message.client_delivery_state ? <span className="flex flex-wrap gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                          <button
                            className={["rounded-full px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em]", mine ? "text-muted hover:bg-white" : "text-slate-300 hover:bg-white/10"].join(" ")}
                            onClick={() => setReplyTo(message)}
                            type="button"
                          >
                            ↩
                          </button>
                          <button
                            className={["rounded-full px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em]", mine ? "text-muted hover:bg-white" : "text-slate-300 hover:bg-white/10"].join(" ")}
                            onClick={() => void openThread(message)}
                            type="button"
                          >
                            {message.thread_reply_count ? `${message.thread_reply_count} replies` : "Thread"}
                          </button>
                        {(mine || canManageAnyPin) && !isPinned ? (
                          <button
                            className={["rounded-full px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em]", mine ? "text-muted hover:bg-white" : "text-slate-300 hover:bg-white/10"].join(" ")}
                            onClick={() => {
                              setPinDurationHours(168);
                              setPinTarget(message);
                            }}
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
                              disabled={reportingIds.has(message.id)}
                              onClick={() => reportMessage(message)}
                              type="button"
                            >
                              {reportingIds.has(message.id) ? "..." : "Report"}
                            </button>
                            <button
                              className="hidden rounded-full px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10 sm:inline"
                              onClick={() => reportUser(message)}
                              type="button"
                            >
                              Report user
                            </button>
                            <button
                              className="hidden rounded-full px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10 sm:inline"
                              onClick={() => blockUser(message)}
                              type="button"
                            >
                              Block
                            </button>
                          </>
                        ) : null}
                      </div>
                      {message.reply_to_message_id ? (
                        <button
                          className={["mt-1 grid w-full gap-1 rounded-md border-l-4 px-3 py-2 text-left", mine ? "border-emerald-500 bg-white/70" : "border-sky-400 bg-white/10"].join(" ")}
                          onClick={() => message.reply_to_message_id ? void jumpToMessage(message.reply_to_message_id) : undefined}
                          type="button"
                        >
                          <span className={["text-xs font-black", mine ? "text-cyan" : "text-sky-300"].join(" ")}>{message.reply_to_sender_label ?? "Earlier message"}</span>
                          <span className={["max-h-10 overflow-hidden text-xs", mine ? "text-muted" : "text-slate-300"].join(" ")}>{message.reply_to_body ?? "Message unavailable"}</span>
                        </button>
                      ) : null}
                      {message.forwarded_from_message_id ? (
                        <p className={["text-[0.68rem] font-black uppercase tracking-[0.14em]", mine ? "text-muted" : "text-slate-400"].join(" ")}>Forwarded message</p>
                      ) : null}
                      {message.attachments?.length ? (
                        <div className={["mt-1 grid gap-1.5 overflow-hidden", message.attachments.length === 1 ? "grid-cols-1" : "grid-cols-2"].join(" ")}>
                          {message.attachments.map((attachment) => {
                            const singleAttachment = message.attachments?.length === 1;
                            const imageSizeClass = singleAttachment
                              ? isDirectMessage
                                ? "h-[20dvh] min-h-24 max-h-44 sm:max-h-56"
                                : "h-[32dvh] min-h-36 max-h-80 sm:max-h-96"
                              : "aspect-square max-h-56";
                            return (
                              <ChatAttachmentTile attachment={attachment} autoLoadImage={mine || attachment.uploader_user_id === currentUserId} channelSlug={activeChannel.slug} className={attachment.attachment_type === "image" ? imageSizeClass : "min-h-24"} key={attachment.id} onOpenImage={(url) => setViewer({ attachment, url })} />
                            );
                          })}
                        </div>
                      ) : null}
                      {!deleted && message.poll ? (
                        <div className={["mt-2 grid gap-2 rounded-lg border p-3", mine ? "border-emerald-300/40 bg-white/70" : "border-white/10 bg-white/10"].join(" ")}>
                          <div className="flex items-center justify-between gap-3">
                            <p className={["text-sm font-black", mine ? "text-ink" : "text-white"].join(" ")}>{message.poll.question}</p>
                            <span className={["shrink-0 text-[0.68rem] font-black uppercase tracking-[0.12em]", mine ? "text-muted" : "text-slate-400"].join(" ")}>{message.poll.allow_multiple ? "Multi" : "Poll"}</span>
                          </div>
                          {message.poll.options.map((option) => {
                            const percent = message.poll?.total_votes ? Math.round((option.vote_count / message.poll.total_votes) * 100) : 0;
                            return (
                              <button className={["relative overflow-hidden rounded-md border px-3 py-2 text-left text-sm font-black", option.voted_by_me ? "border-sky-300 bg-sky-100 text-ink" : mine ? "border-line bg-white/80 text-ink" : "border-white/10 bg-[#223447] text-white"].join(" ")} disabled={votingPollIds.has(message.poll?.id ?? "") || message.poll?.status !== "open"} key={option.id} onClick={() => void votePoll(message, option.id)} type="button">
                                <span className="absolute inset-y-0 left-0 bg-sky-400/20" style={{ width: `${percent}%` }} />
                                <span className="relative flex items-center justify-between gap-3"><span>{option.label}</span><span>{percent}% · {option.vote_count}</span></span>
                              </button>
                            );
                          })}
                          <p className={["text-xs font-bold", mine ? "text-muted" : "text-slate-400"].join(" ")}>{message.poll.total_votes} vote{message.poll.total_votes === 1 ? "" : "s"}{message.poll.status !== "open" ? " · closed" : ""}</p>
                        </div>
                      ) : null}
                      {deleted || message.body ? <p className={["mt-1 whitespace-pre-wrap break-words text-[0.98rem] leading-6 [overflow-wrap:anywhere]", deleted ? "italic text-slate-400" : mine || system ? "text-ink" : "text-white"].join(" ")}>{deleted ? "This message was deleted." : renderMessageBody(message.body)}</p> : null}
                      {message.client_delivery_state ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-red-300/40 pt-2 text-xs font-bold text-red-700">
                          <span>{message.client_delivery_state === "sending" ? "Sending..." : message.client_error ?? "Message failed to send."}</span>
                          {message.client_delivery_state === "failed" ? <button className="rounded-full bg-red-700 px-3 py-1 font-black text-white disabled:opacity-60" disabled={isSending} onClick={() => void retryMessage(message)} type="button">{isSending ? "Retrying..." : "Retry"}</button> : null}
                          {message.client_delivery_state === "failed" ? <button className="rounded-full border border-red-300 px-3 py-1 font-black" onClick={() => dismissFailedMessage(message)} type="button">Discard</button> : null}
                        </div>
                      ) : null}
                      {!deleted && message.link_preview?.url && message.link_preview.host ? (
                        <a className={["mt-2 block rounded-md border p-3 text-sm", mine ? "border-line bg-white hover:bg-surfaceHigh" : "border-white/10 bg-white/10 hover:bg-white/15"].join(" ")} href={message.link_preview.url} rel="noreferrer" target="_blank">
                          <span className={["block font-black", mine ? "text-ink" : "text-white"].join(" ")}>{message.link_preview.title ?? message.link_preview.host}</span>
                          <span className={["mt-1 block break-all text-xs font-bold", mine ? "text-muted" : "text-slate-300"].join(" ")}>{message.link_preview.host}</span>
                        </a>
                      ) : null}
                      {!deleted && !message.client_delivery_state ? <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {reactionOptions.map((reaction) => {
                          const summary = message.reactions?.find((item) => item.reaction === reaction.key);
                          return (
                            <button
                              className={[
                                "rounded-full border px-2.5 py-1 text-xs font-black",
                                summary?.reacted_by_me ? "border-sky-300 bg-sky-100 text-ink" : mine ? "border-white bg-white/80 text-muted hover:bg-white" : "border-white/10 bg-white/10 text-slate-200 hover:bg-white/20"
                              ].join(" ")}
                              key={reaction.key}
                              onClick={() => reactToMessage(message, reaction.key)}
                              type="button"
                            >
                              {reaction.label}{summary?.count ? ` ${summary.count}` : ""}
                            </button>
                          );
                        })}
                      </div> : null}
                    </article>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mx-auto grid w-full max-w-2xl place-items-center rounded-2xl border border-white/10 bg-[#203244]/80 p-6 text-center text-slate-200 shadow-tight">
                <div>
                  <h3 className="text-lg font-black text-white">No messages yet</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">{isDirectMessage ? "Say hello and start the conversation." : "Start the conversation in this channel."}</p>
                </div>
              </div>
            )}
            {showJumpLatest || isContextView ? <button className="sticky bottom-2 ml-auto mt-3 block min-h-10 rounded-full bg-sky-500 px-4 text-xs font-black text-white shadow-panel hover:bg-sky-400" onClick={() => void jumpToLatest()} type="button">Jump to latest</button> : null}
          </div>

          <form className="z-20 min-w-0 shrink-0 border-t border-white/10 bg-[#172331] px-2 py-2 sm:px-3 sm:py-2.5 xl:px-6" onSubmit={sendMessage}>
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
                <button className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200 hover:bg-white/20" onClick={() => setReplyTo(null)} type="button">Cancel</button>
              </div>
            ) : null}
            {mentionSuggestions.length ? (
              <div className="mb-2 flex max-w-full gap-2 overflow-x-auto rounded-xl border border-white/10 bg-[#223447] p-2">
                {mentionSuggestions.map((user) => (
                  <button
                    className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-black text-white hover:bg-white/20"
                    key={user.user_id}
                    onClick={() => user.username ? insertMention(user.username) : undefined}
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
                      {attachment.state === "uploading" ? <><span>{attachment.progress}%</span><span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/20"><span className="block h-full bg-sky-400" style={{ width: `${attachment.progress}%` }} /></span></> : attachment.state === "failed" ? <button className="w-full rounded-sm bg-red-600 px-1 py-1" onClick={() => uploadAttachment(attachment.file, attachment.localId)} type="button">Retry</button> : "Ready"}
                    </div>
                    <button aria-label={`Remove ${attachment.file.name}`} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-xs font-black text-white" onClick={() => removePendingAttachment(attachment)} type="button">X</button>
                  </div>
                ))}
              </div>
            ) : null}
              {showEmojiPicker ? (
              <div className="mb-2 grid max-w-full gap-2 rounded-xl border border-white/10 bg-[#223447] p-2" ref={emojiPickerRef} role="dialog" aria-label="Emoji picker">
                <div className="flex gap-1 overflow-x-auto">
                  {emojiGroups.map((group) => <button className={["min-h-8 shrink-0 rounded-full px-3 text-[0.68rem] font-black", emojiGroup === group.key ? "bg-sky-400 text-navy-950" : "bg-white/10 text-slate-200"].join(" ")} key={group.key} onClick={() => setEmojiGroup(group.key)} type="button">{group.label}</button>)}
                </div>
                <div className="grid grid-cols-8 gap-1 sm:grid-cols-12">
                  {activeEmojiGroup.emojis.map((emoji) => <button className="grid h-9 w-9 place-items-center rounded-md text-xl hover:bg-white/10" key={emoji} onClick={() => { setBody((current) => `${current}${emoji}`); composerRef.current?.focus(); }} type="button">{emoji}</button>)}
                </div>
              </div>
            ) : null}
            <div className="relative grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-end gap-1.5 sm:gap-2">
              <input accept="image/jpeg,image/png,image/webp" className="sr-only" multiple onChange={(event) => { Array.from(event.target.files ?? []).slice(0, Math.max(0, 4 - pendingAttachments.length)).forEach((file) => uploadAttachment(file)); event.currentTarget.value = ""; }} ref={imageInputRef} type="file" />
              <input accept={acceptedChatDocuments} className="sr-only" multiple onChange={(event) => { Array.from(event.target.files ?? []).slice(0, Math.max(0, 4 - pendingAttachments.length)).forEach((file) => uploadAttachment(file)); event.currentTarget.value = ""; }} ref={documentInputRef} type="file" />
              <button aria-expanded={showAttachmentMenu} aria-label="Add an attachment" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-[#223447] text-2xl font-light text-slate-200 hover:bg-[#2c4358]" onClick={() => { setShowAttachmentMenu((current) => !current); setShowEmojiPicker(false); }} ref={attachmentTriggerRef} title="Add attachment" type="button">+</button>
              {showAttachmentMenu ? <div className="absolute bottom-12 left-0 z-20 min-w-52 rounded-md border border-white/10 bg-[#26394b] p-1.5 text-white shadow-panel" ref={attachmentMenuRef}>
                <button className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm font-black hover:bg-white/10" onClick={() => { setShowAttachmentMenu(false); imageInputRef.current?.click(); }} type="button"><span aria-hidden="true">▣</span> Add photo</button>
                <button className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm font-black hover:bg-white/10" onClick={() => { setShowAttachmentMenu(false); documentInputRef.current?.click(); }} type="button"><span aria-hidden="true">▤</span> Add document</button>
                <button className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm font-black hover:bg-white/10" onClick={() => { setShowAttachmentMenu(false); setShowPollCreator(true); }} type="button"><span aria-hidden="true">◉</span> Create poll</button>
                <button className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm font-black hover:bg-white/10" onClick={() => { setShowAttachmentMenu(false); void loadBookmarks(); }} type="button"><span aria-hidden="true">★</span> Saved messages</button>
                {isChatAdmin ? <button className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm font-black hover:bg-white/10" onClick={() => { setShowAttachmentMenu(false); void loadScheduledAnnouncements(); }} type="button"><span aria-hidden="true">⌚</span> Schedule announcement</button> : null}
                <p className="px-3 pb-2 text-[0.68rem] font-bold text-slate-400">Photos must be smaller than 8MB. Documents must be smaller than 12MB.</p>
              </div> : null}
              <button aria-expanded={showEmojiPicker} aria-label="Choose emoji" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-[#223447] text-xl text-slate-200 hover:bg-[#2c4358]" onClick={() => { setShowEmojiPicker((current) => !current); setShowAttachmentMenu(false); }} ref={emojiTriggerRef} title="Emoji" type="button">☺</button>
              <label className="grid min-w-0 gap-1 self-end">
                <span className="sr-only">Message</span>
                <textarea
                  className="h-11 min-h-0 w-full min-w-0 resize-none overflow-y-hidden rounded-2xl border border-white/10 bg-[#223447] px-3 py-[0.65rem] text-[0.95rem] leading-5 text-white outline-none placeholder:text-slate-400 focus:border-sky-400"
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={composerPlaceholder}
                  ref={composerRef}
                  rows={1}
                  value={body}
                />
              </label>
              <button
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-lg font-black text-white shadow-action hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400 disabled:shadow-none sm:h-12 sm:w-12 sm:text-xl"
                disabled={!canSend}
                aria-label="Send message"
                type="submit"
              >
                {isSending ? "…" : "➤"}
              </button>
            </div>
            <div className="mt-1 hidden flex-wrap items-center justify-between gap-2 px-2 text-xs font-bold text-slate-400 sm:flex">
              <span>{channelTypeLabel(activeChannel)} · {activeChannel.visibility}</span>
              <span className={charactersLeft < 80 ? "text-warning" : ""}>{charactersLeft}</span>
            </div>
            </div>
          </form>
        </div>
        {fullLayout ? (
          <aside className="hidden min-h-0 overflow-y-auto border-l border-white/10 bg-[#162536] text-white xl:block">
            <div className="grid gap-4 p-4">
              <section>
                <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Active now</p>
                <div className="mt-3 grid gap-2">
                  {userDirectory.length ? userDirectory.slice(0, 18).map((user) => (
                    <button className="flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-2 text-left hover:bg-white/10" key={user.user_id} onClick={() => openUserProfile(user)} type="button">
                      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-black text-white">
                        {initials(user.label)}
                        {user.is_online ? <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#162536] bg-success" /> : null}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">{user.label}</p>
                        <p className="truncate text-xs font-bold text-slate-400">{user.username ? `@${user.username}` : user.is_online ? "online" : "recent"}</p>
                      </div>
                    </button>
                  )) : (
                    <p className="rounded-md border border-dashed border-white/10 p-3 text-sm font-bold text-slate-400">Active players will appear here.</p>
                  )}
                </div>
              </section>
              <section className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Mentions</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Type @ and choose an active username when available.</p>
              </section>
            </div>
          </aside>
        ) : null}
      </div>
      {viewer ? (
        <div aria-label="Image viewer" aria-modal="true" className="fixed inset-0 z-[80] grid grid-rows-[auto_minmax(0,1fr)_auto] bg-black/95 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white" role="dialog">
          <header className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{viewer.attachment.uploader_label}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{viewer.attachment.original_name ?? "Shared image"}</p>
            </div>
            <button aria-label="Close image viewer" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-lg font-black hover:bg-white/20" onClick={() => setViewer(null)} type="button">X</button>
          </header>
          <div className="grid min-h-0 place-items-center overflow-auto p-2 sm:p-5">
            <img alt={viewer.attachment.alt_text ?? viewer.attachment.original_name ?? "Chat image"} className="max-h-full max-w-full object-contain" src={viewer.url} />
          </div>
          <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2.5 sm:px-5">
            <span className="text-xs font-bold text-slate-400">{Math.max(1, Math.round(viewer.attachment.byte_size / 1024))} KB</span>
            {viewer.attachment.uploader_user_id !== currentUserId ? <button className="min-h-10 rounded-full border border-red-400/40 px-4 text-xs font-black text-red-200 hover:bg-red-500/10" onClick={() => void reportAttachment(viewer.attachment)} type="button">Report attachment</button> : null}
          </footer>
        </div>
      ) : null}
    </section>
  );
}

