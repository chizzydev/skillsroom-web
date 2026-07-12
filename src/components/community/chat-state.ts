import type { ChatAttachment, ChatChannel, ChatMessage, ChatPoll } from "@/lib/match-room-api";

export const chatImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const chatDocumentMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain"
] as const;
export const chatImageExtensions = [".jpg", ".jpeg", ".png", ".webp"] as const;
export const chatDocumentExtensions = [".pdf", ".doc", ".docx", ".odt", ".txt"] as const;
export const acceptedChatDocuments = ".pdf,.doc,.docx,.odt,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,text/plain";
export const chatMessageMaxLength = 5000;
export const composerMinHeightPx = 44;
export const composerMaxHeightPx = 128;

export type ChatChannelDisplay = Pick<ChatChannel, "slug" | "title" | "channel_type" | "dm_peer_label" | "dm_peer_display_name" | "dm_peer_username">;

export function isChatImageMime(mimeType: string | null | undefined) {
  return chatImageMimeTypes.includes(mimeType as (typeof chatImageMimeTypes)[number]);
}

export function isChatDocumentMime(mimeType: string | null | undefined) {
  return chatDocumentMimeTypes.includes(mimeType as (typeof chatDocumentMimeTypes)[number]);
}

export function fileExtension(fileName: string | null | undefined) {
  const normalized = fileName?.trim().toLowerCase() ?? "";
  const lastDot = normalized.lastIndexOf(".");
  return lastDot >= 0 ? normalized.slice(lastDot) : "";
}

export function chatAttachmentKind(file: File): "image" | "document" | null {
  if (isChatImageMime(file.type)) return "image";
  if (isChatDocumentMime(file.type)) return "document";
  const extension = fileExtension(file.name);
  if (chatImageExtensions.includes(extension as (typeof chatImageExtensions)[number])) return "image";
  if (chatDocumentExtensions.includes(extension as (typeof chatDocumentExtensions)[number])) return "document";
  return null;
}

export function formatAttachmentSize(bytes: number | null | undefined) {
  if (!bytes || bytes < 1) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function documentBadge(mimeType: string | null | undefined) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "text/plain") return "TXT";
  if (mimeType === "application/vnd.oasis.opendocument.text") return "ODT";
  if (mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "DOC";
  return "FILE";
}

export function attachmentPreviewLabel(attachment: ChatAttachment) {
  if (attachment.original_name?.trim()) return attachment.original_name.trim();
  return attachment.attachment_type === "document" ? "Document" : "Photo";
}

export function messageTime(value: string) {
  return new Date(value).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}

export function messageDate(value: string) {
  return new Date(value).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

export function pinExpiryLabel(value: string | null) {
  if (!value) return "Pinned until removed";
  return `Until ${new Date(value).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
}

export function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "SR";
}

export function channelDisplayName(channel: ChatChannelDisplay) {
  if (channel.slug === "global_lobby") return "Global Chat";
  if (channel.channel_type === "dm") {
    return channel.dm_peer_label ?? channel.dm_peer_display_name ?? channel.dm_peer_username ?? "DM";
  }
  return channel.title;
}

export function channelInitials(channel: ChatChannelDisplay) {
  if (channel.slug === "global_lobby") return "GC";
  const words = channelDisplayName(channel)
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !["of", "the", "and"].includes(word.toLowerCase()));
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 4).map((word) => word.charAt(0)).join("").toUpperCase() || "CH";
}

export function channelTypeLabel(channel: ChatChannel) {
  if (channel.slug === "global_lobby") return "Chat";
  if (channel.channel_type === "match_room") return "Room";
  if (channel.channel_type === "tournament") return "Tournament";
  if (channel.channel_type === "game") return "Game";
  if (channel.channel_type === "group") return "Community";
  if (channel.channel_type === "dm") return "DM";
  return "Channel";
}

export function channelTitle(channel: ChatChannelDisplay) {
  return channelDisplayName(channel);
}

export function channelPreview(channel: ChatChannel) {
  if (channel.last_message_body) {
    return `${channel.last_message_sender_label ?? "Player"}: ${channel.last_message_body}`;
  }
  if (channel.channel_type === "dm") {
    return channel.dm_peer_username ? `@${channel.dm_peer_username}` : "DM";
  }
  return channel.description ?? `${channelTypeLabel(channel)} channel`;
}

export function pendingMessage(channelId: string, userId: string, body: string, clientMessageId: string, replyTo: ChatMessage | null, attachments: ChatAttachment[]): ChatMessage {
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

export function preserveLocalAttachmentPreviews(next: ChatMessage, previous?: ChatMessage) {
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

export function mergeMessage(current: ChatMessage[], next: ChatMessage) {
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

export function isChatMessage(value: unknown): value is ChatMessage {
  return typeof value === "object" && value !== null && "id" in value && "body" in value && "channel_id" in value;
}

export function displayHandle(message: Pick<ChatMessage, "sender_username" | "sender_label">) {
  return message.sender_username ? `@${message.sender_username}` : message.sender_label;
}

export function messageAttachmentCount(message: ChatMessage) {
  return message.attachments?.length ?? message.attachment_count ?? (message.has_attachments ? 1 : 0);
}

export function messageAttachmentSummary(message: ChatMessage) {
  const preview = message.attachment_preview;
  const name = typeof preview?.original_name === "string" && preview.original_name.trim()
    ? preview.original_name.trim()
    : preview?.attachment_type === "document"
      ? "Document attached"
      : "Media attached";
  const size = typeof preview?.byte_size === "number" ? formatAttachmentSize(preview.byte_size) : "";
  return {
    name,
    size,
    type: typeof preview?.attachment_type === "string" ? preview.attachment_type : "attachment"
  };
}

export function messagePollSummary(message: ChatMessage): ChatPoll | Partial<ChatPoll> | null {
  return message.poll ?? message.poll_summary ?? null;
}

export function messageHasDetail(message: ChatMessage, include: "attachments" | "poll" | "thread" | "all"): boolean {
  if (include === "attachments") return messageAttachmentCount(message) === 0 || Boolean(message.attachments?.length);
  if (include === "poll") return !messagePollSummary(message) || Boolean(message.poll);
  if (include === "thread") return typeof message.thread_reply_count === "number";
  return messageHasDetail(message, "attachments") && messageHasDetail(message, "poll") && messageHasDetail(message, "thread");
}
