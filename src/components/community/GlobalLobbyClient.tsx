"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ChatAttachment, ChatBookmark, ChatChannel, ChatChannelControls, ChatDmRequest, ChatMessage, ChatMessagePageInfo, ChatNotificationLevel, ChatPinnedMessage, ChatPresenceSummary, ChatReactionMember, ChatSearchPageInfo, ChatUserBlock, ScheduledChatAnnouncement } from "@/lib/match-room-api";
import { ChannelListPanel } from "./ChannelListPanel";
import { ChatActionModals } from "./ChatActionModals";
import { ChatComposer, type EmojiGroupKey } from "./ChatComposer";
import { ChatImageViewer } from "./ChatImageViewer";
import { ChatInfoPanel, type ChatInfoTab } from "./ChatInfoPanel";
import { ChatProfileModal } from "./ChatProfileModal";
import { ChatSearchPanel } from "./ChatSearchPanel";
import { ChatSideRail } from "./ChatSideRail";
import { ChatThreadPanel } from "./ChatThreadPanel";
import { ChatVirtualThread } from "./ChatVirtualThread";
import { Toast } from "@/components/ui/Toast";
import { useStableCallback } from "./chat-hooks";
import { useChatStore } from "./chat-store";
import {
  channelInitials,
  channelTitle,
  chatAttachmentKind,
  chatMessageMaxLength,
  composerMaxHeightPx,
  composerMinHeightPx,
  formatAttachmentSize,
  isChatMessage,
  mergeMessage,
  messageHasDetail,
  pendingMessage,
  preserveLocalAttachmentPreviews
} from "./chat-state";
import type { ApiEnvelope, ChatProfileUser, GlobalLobbyClientProps, MediaPage, PendingAttachment, RealtimeEvent } from "./chat-types";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

const emptyMessages: ChatMessage[] = [];
const emptyPinnedMessages: ChatPinnedMessage[] = [];
const emptyPresence: ChatPresenceSummary = { online_count: 0, active: [], typing: [] };
const readReceiptDebounceMs = 900;
const typingRefreshMs = 8_000;
type ChatActionNotice = {
  id: number;
  title: string;
  description?: string;
  tone: "success" | "warning" | "danger" | "neutral";
};
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

function documentIsVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function browserPushSettingsMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/push service error|registration failed/i.test(message)) {
    return "Browser notifications could not be enabled on this browser. You can keep using live in-app updates.";
  }
  if (/permission/i.test(message)) {
    return message;
  }
  return message || "Browser notifications could not be enabled.";
}

function mergeAttachmentsById(current: ChatAttachment[], next: ChatAttachment[]) {
  const seen = new Set(current.map((attachment) => attachment.id));
  return [...current, ...next.filter((attachment) => !seen.has(attachment.id))];
}

function threadRootId(message: Pick<ChatMessage, "id" | "thread_root_message_id">) {
  return message.thread_root_message_id ?? message.id;
}


export function GlobalLobbyClient({ channels, currentUserId, currentUserRole, initialChannel, initialMessages, initialPageInfo, initialPinnedMessages, initialPresence, initialReadBoundary, initialDmRequests, layout = "embedded" }: GlobalLobbyClientProps) {
  const chatStore = useChatStore({
    channels,
    initialChannelSlug: initialChannel.slug,
    initialMessages,
    initialPresence
  });
  const {
    channelList,
    messagesByChannel,
    presenceByChannel,
    patchChannel,
    patchChannelBySlug,
    replaceChannelMessages,
    upsertMessage,
    updateMessage,
    patchMessage,
    filterChannelMessages,
    setChannelPresence,
    patchChannelPresence
  } = chatStore;
  const [dmRequests, setDmRequests] = useState<ChatDmRequest[]>(initialDmRequests);
  const [dmUsername, setDmUsername] = useState("");
  const [dmIntro, setDmIntro] = useState("");
  const [activeChannel, setActiveChannel] = useState<ChatChannel>(initialChannel);
  const [pinnedByChannel, setPinnedByChannel] = useState<Record<string, ChatPinnedMessage[]>>({
    [initialChannel.slug]: initialPinnedMessages
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
  const [notice, setNotice] = useState<ChatActionNotice | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<{ tone: "success" | "danger" | "warning"; message: string } | null>(null);
  const [streamStatus, setStreamStatus] = useState<"starting" | "live" | "reconnecting">("starting");
  const [streamReconnectKey, setStreamReconnectKey] = useState(0);
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [infoTab, setInfoTab] = useState<ChatInfoTab>("members");
  const [mediaByChannel, setMediaByChannel] = useState<Record<string, MediaPage>>({});
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiGroup, setEmojiGroup] = useState<EmojiGroupKey>("recent");
  const [viewer, setViewer] = useState<{ attachment: ChatAttachment; url: string } | null>(null);
  const [pinTarget, setPinTarget] = useState<ChatMessage | null>(null);
  const [pinDurationHours, setPinDurationHours] = useState<24 | 168 | 720>(168);
  const [pinClock, setPinClock] = useState(() => Date.now());
  const [pinBannerIndexByChannel, setPinBannerIndexByChannel] = useState<Record<string, number>>({});
  const [isPinning, setIsPinning] = useState(false);
  const [unpinningIds, setUnpinningIds] = useState<Set<string>>(new Set());
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
  const [jumpLatestToken, setJumpLatestToken] = useState(0);
  const [isContextView, setIsContextView] = useState(false);
  const [remoteMentionUsers, setRemoteMentionUsers] = useState<Array<{ user_id: string; label: string; username?: string | null; is_online?: boolean }>>([]);
  const [threadTarget, setThreadTarget] = useState<ChatMessage | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [threadPageInfo, setThreadPageInfo] = useState<ChatMessagePageInfo>({ has_older: false, older_cursor: null });
  const [threadBody, setThreadBody] = useState("");
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isLoadingOlderThread, setIsLoadingOlderThread] = useState(false);
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
  const [hydratingMessageIds, setHydratingMessageIds] = useState<Set<string>>(new Set());
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
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentTriggerRef = useRef<HTMLButtonElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const emojiTriggerRef = useRef<HTMLButtonElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const uploadRequestsRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const longPressTimerRef = useRef<number | null>(null);
  const activeChannelRef = useRef(activeChannel);
  const channelListRef = useRef(channelList);
  const seenIdsRef = useRef<Set<string>>(new Set(initialMessages.map((message) => message.id)));
  const messagesByChannelRef = useRef(messagesByChannel);
  const presenceByChannelRef = useRef(presenceByChannel);
  const hydratedMessagesRef = useRef<Map<string, ChatMessage>>(new Map(initialMessages.map((message) => [message.id, message])));
  const shouldStickLatestRef = useRef(true);
  const threadTargetRef = useRef<ChatMessage | null>(null);
  const initialLinkHandledRef = useRef(false);
  const backgroundAuthPauseUntilRef = useRef(0);
  const backgroundQuietUntilRef = useRef(Date.now() + 3000);
  const bodyRef = useRef(body);
  const readReceiptTimerRef = useRef<number | null>(null);
  const pendingReadReceiptRef = useRef<{ channel: ChatChannel; messageId: string | null; createdAt: string | null } | null>(null);
  const lastReadReceiptSentRef = useRef<Record<string, string | null>>({});
  const typingRefreshTimerRef = useRef<number | null>(null);
  const typingStateRef = useRef<{ channelSlug: string | null; isTyping: boolean }>({ channelSlug: null, isTyping: false });
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchCacheRef = useRef<Map<string, { messages: ChatMessage[]; pageInfo: ChatSearchPageInfo }>>(new Map());
  const threadCacheRef = useRef<Map<string, { rootMessageId: string; messages: ChatMessage[]; pageInfo: ChatMessagePageInfo }>>(new Map());

  const messages = messagesByChannel[activeChannel.slug] ?? emptyMessages;
  const pageInfo = pageInfoByChannel[activeChannel.slug] ?? { has_older: false, older_cursor: null };
  const readBoundary = readBoundaryByChannel[activeChannel.slug] ?? null;
  const unreadMessageId = useMemo(() => {
    if (readBoundary) {
      return messages.find((message) => message.sender_user_id !== currentUserId && Date.parse(message.created_at) > Date.parse(readBoundary))?.id ?? null;
    }
    return (activeChannel.unread_count ?? 0) > 0
      ? messages.find((message) => message.sender_user_id !== currentUserId)?.id ?? null
      : null;
  }, [activeChannel.unread_count, currentUserId, messages, readBoundary]);
  const rawPinnedMessages = pinnedByChannel[activeChannel.slug] ?? emptyPinnedMessages;
  const pinnedMessages = useMemo(
    () => rawPinnedMessages.filter((pin) => !pin.expires_at || Date.parse(pin.expires_at) > pinClock),
    [pinClock, rawPinnedMessages]
  );
  const pinnedMessageIds = useMemo(() => new Set(pinnedMessages.map((pin) => pin.message_id)), [pinnedMessages]);
  const bannerPinnedMessages = pinnedMessages.slice(0, 3);
  const pinBannerIndex = Math.min(pinBannerIndexByChannel[activeChannel.slug] ?? 0, Math.max(0, bannerPinnedMessages.length - 1));
  const currentPinnedMessage = bannerPinnedMessages[pinBannerIndex] ?? null;
  const presence = presenceByChannel[activeChannel.slug] ?? emptyPresence;
  const activePresenceByUserId = useMemo(() => new Map(presence.active.map((user) => [user.user_id, user])), [presence.active]);
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

  const suppressBackgroundChat = useCallback((durationMs = 3500) => {
    backgroundQuietUntilRef.current = Math.max(backgroundQuietUntilRef.current, Date.now() + durationMs);
  }, []);

  const backgroundChatRequest = useCallback(async (input: string, init: RequestInit) => {
    if (Date.now() < backgroundAuthPauseUntilRef.current) return null;
    if (Date.now() < backgroundQuietUntilRef.current) return null;
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

  const showNotice = useCallback((title: string, options?: { description?: string; tone?: ChatActionNotice["tone"] }) => {
    setNotice({
      id: Date.now(),
      title,
      description: options?.description,
      tone: options?.tone ?? "success"
    });
  }, []);

  const showSettingsNotice = useCallback((message: string, tone: "success" | "danger" | "warning" = "success") => {
    setSettingsNotice({ message, tone });
    window.setTimeout(() => {
      setSettingsNotice((current) => current?.message === message && current.tone === tone ? null : current);
    }, tone === "success" ? 5000 : 8000);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice((current) => current?.id === notice.id ? null : current), notice.tone === "danger" ? 7600 : 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function openUserProfile(user: ChatProfileUser) {
    setProfileUser(user);
    setProfileDmIntro("");
    setError(null);
  }

  function openMessageUserProfile(message: ChatMessage) {
    if (!message.sender_user_id || message.message_kind === "system") return;
    const activeUser = activePresenceByUserId.get(message.sender_user_id);
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

  function openMessageActions(message: ChatMessage) {
    setActionMessage(message);
    if (!messageHasDetail(message, "all")) {
      void hydrateMessage(message.id, "all");
    }
  }

  function beginLongPress(message: ChatMessage, target: EventTarget | null) {
    if (target instanceof Element && target.closest("button, a, input, textarea")) return;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      openMessageActions(message);
      longPressTimerRef.current = null;
    }, 550);
  }

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      showNotice(successMessage);
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

    const root = document.documentElement;
    const bodyElement = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = bodyElement.style.overflow;
    const previousBodyOverscroll = bodyElement.style.overscrollBehavior;

    root.style.overflow = "hidden";
    bodyElement.style.overflow = "hidden";
    bodyElement.style.overscrollBehavior = "none";

    return () => {
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
    bodyRef.current = body;
  }, [body]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
    channelListRef.current = channelList;
    messagesByChannelRef.current = messagesByChannel;
    presenceByChannelRef.current = presenceByChannel;
    threadTargetRef.current = threadTarget;
    for (const channelMessages of Object.values(messagesByChannel)) {
      for (const message of channelMessages) {
        const cached = hydratedMessagesRef.current.get(message.id);
        hydratedMessagesRef.current.set(message.id, cached ? preserveLocalAttachmentPreviews({ ...cached, ...message }, cached) : message);
      }
    }
  }, [activeChannel, channelList, messagesByChannel, presenceByChannel, threadTarget]);

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

  const flushReadReceipt = useCallback(() => {
    const pending = pendingReadReceiptRef.current;
    pendingReadReceiptRef.current = null;
    if (!pending) return;
    if (!documentIsVisible()) return;
    if (activeChannelRef.current.slug !== pending.channel.slug) return;
    if (!shouldStickLatestRef.current) return;
    if (lastReadReceiptSentRef.current[pending.channel.slug] === pending.messageId) return;

    lastReadReceiptSentRef.current[pending.channel.slug] = pending.messageId;
    if (pending.createdAt) {
      setReadBoundaryByChannel((current) => ({ ...current, [pending.channel.slug]: pending.createdAt }));
    }
    patchChannelBySlug(pending.channel.slug, { unread_count: 0 });
    void backgroundChatRequest(`/api/community/channels/${encodeURIComponent(pending.channel.slug)}/read`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ message_id: pending.messageId })
    }).catch(() => {
      delete lastReadReceiptSentRef.current[pending.channel.slug];
    });
  }, [backgroundChatRequest, patchChannelBySlug]);

  const markRead = useCallback((channel: ChatChannel, nextMessages: ChatMessage[]) => {
    const lastMessage = nextMessages.at(-1);
    if (!lastMessage) return;
    if (!documentIsVisible()) return;
    if (activeChannelRef.current.slug !== channel.slug) return;
    if (!shouldStickLatestRef.current) return;
    if (lastReadReceiptSentRef.current[channel.slug] === lastMessage.id) return;
    if (pendingReadReceiptRef.current?.channel.slug === channel.slug && pendingReadReceiptRef.current.messageId === lastMessage.id) return;

    pendingReadReceiptRef.current = { channel, messageId: lastMessage.id, createdAt: lastMessage.created_at };
    if (readReceiptTimerRef.current !== null) window.clearTimeout(readReceiptTimerRef.current);
    readReceiptTimerRef.current = window.setTimeout(() => {
      readReceiptTimerRef.current = null;
      flushReadReceipt();
    }, readReceiptDebounceMs);
  }, [flushReadReceipt]);

  async function openChannel(channel: ChatChannel) {
    suppressBackgroundChat(4500);
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
    patchChannelBySlug(channel.slug, { unread_count: 0 });
    if (messagesByChannel[channel.slug]) return;

    setIsLoadingChannel(true);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(channel.slug)}/messages?limit=60&view=list`, {
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      const payload = (await response.json()) as ApiEnvelope<{ channel: ChatChannel; messages: ChatMessage[]; pinned_messages: ChatPinnedMessage[]; presence: ChatPresenceSummary; page_info: ChatMessagePageInfo; read_boundary: string | null }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Channel could not load." : "Channel could not load.");
      }
      payload.data.messages.forEach((message) => seenIdsRef.current.add(message.id));
      setActiveChannel(payload.data.channel);
      replaceChannelMessages(payload.data.channel.slug, payload.data.messages);
      setPinnedByChannel((current) => ({ ...current, [payload.data.channel.slug]: payload.data.pinned_messages }));
      setChannelPresence(payload.data.channel.slug, payload.data.presence);
      setPageInfoByChannel((current) => ({ ...current, [payload.data.channel.slug]: payload.data.page_info }));
      setReadBoundaryByChannel((current) => ({ ...current, [payload.data.channel.slug]: payload.data.read_boundary }));
      patchChannel({ ...payload.data.channel, unread_count: 0 });
      markRead(payload.data.channel, payload.data.messages);
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
    window.location.replace("/chat");
  }

  function goHome() {
    window.location.replace("/chat");
  }

  function replaceThreadCache(rootMessageId: string, nextMessages: ChatMessage[], pageInfo: ChatMessagePageInfo = { has_older: false, older_cursor: null }) {
    threadCacheRef.current.set(rootMessageId, { rootMessageId, messages: nextMessages, pageInfo });
    const currentThreadRoot = threadTargetRef.current ? threadRootId(threadTargetRef.current) : null;
    if (currentThreadRoot === rootMessageId) {
      setThreadMessages(nextMessages);
      setThreadPageInfo(pageInfo);
    }
  }

  function patchThreadCacheMessage(message: ChatMessage) {
    const messageRootId = threadRootId(message);
    let updatedCurrentThread = false;
    for (const [rootMessageId, cached] of threadCacheRef.current.entries()) {
      const belongsToCachedThread = rootMessageId === messageRootId || cached.messages.some((item) => item.id === message.id);
      if (!belongsToCachedThread) continue;
      const nextMessages = mergeMessage(cached.messages, message);
      threadCacheRef.current.set(rootMessageId, { ...cached, messages: nextMessages });
      if (threadTargetRef.current && threadRootId(threadTargetRef.current) === rootMessageId) {
        setThreadMessages(nextMessages);
        updatedCurrentThread = true;
      }
    }
    if (!updatedCurrentThread && threadTargetRef.current && threadRootId(threadTargetRef.current) === messageRootId) {
      setThreadMessages((current) => mergeMessage(current, message));
    }
  }

  const postTypingState = useCallback((channelSlug: string, isTyping: boolean, allowWhenHidden = false) => {
    if (!allowWhenHidden && !documentIsVisible()) return;
    void backgroundChatRequest(`/api/community/channels/${encodeURIComponent(channelSlug)}/typing`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ is_typing: isTyping })
    }).catch(() => undefined);
  }, [backgroundChatRequest]);

  const clearTypingRefresh = useCallback(() => {
    if (typingRefreshTimerRef.current === null) return;
    window.clearTimeout(typingRefreshTimerRef.current);
    typingRefreshTimerRef.current = null;
  }, []);

  const scheduleTypingRefresh = useCallback((channelSlug: string) => {
    clearTypingRefresh();
    typingRefreshTimerRef.current = window.setTimeout(() => {
      typingRefreshTimerRef.current = null;
      if (!documentIsVisible()) return;
      if (!bodyRef.current.trim()) return;
      if (activeChannelRef.current.slug !== channelSlug) return;
      if (!typingStateRef.current.isTyping || typingStateRef.current.channelSlug !== channelSlug) return;
      postTypingState(channelSlug, true);
      scheduleTypingRefresh(channelSlug);
    }, typingRefreshMs);
  }, [clearTypingRefresh, postTypingState]);

  const stopTyping = useCallback((channelSlug = typingStateRef.current.channelSlug, allowWhenHidden = true) => {
    clearTypingRefresh();
    if (!channelSlug) return;
    if (!typingStateRef.current.isTyping || typingStateRef.current.channelSlug !== channelSlug) return;
    typingStateRef.current = { channelSlug, isTyping: false };
    postTypingState(channelSlug, false, allowWhenHidden);
  }, [clearTypingRefresh, postTypingState]);

  useEffect(() => {
    let closed = false;

    async function beat() {
      if (!documentIsVisible()) return;
      try {
        const response = await backgroundChatRequest(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/heartbeat`, {
          method: "POST",
          headers: { accept: "application/json" }
        });
        if (!response) return;
        const payload = (await response.json()) as ApiEnvelope<{ channel: ChatChannel; presence: ChatPresenceSummary }>;
        if (!closed && response.ok && payload.ok === true) {
          patchChannelPresence(payload.data.channel.slug, { online_count: payload.data.presence.online_count });
          patchChannelBySlug(payload.data.channel.slug, { online_count: payload.data.presence.online_count });
        }
      } catch {
        // Presence is best-effort; messaging stays usable when a heartbeat misses.
      }
    }

    void beat();
    const timer = window.setInterval(beat, 25_000);
    function handleVisibilityChange() {
      if (documentIsVisible()) void beat();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      closed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeChannel.slug, backgroundChatRequest, patchChannelBySlug, patchChannelPresence]);

  useEffect(() => {
    const channelSlug = activeChannel.slug;
    const hasBody = body.trim().length > 0;

    if (!documentIsVisible()) {
      if (typingStateRef.current.channelSlug === channelSlug) stopTyping(channelSlug);
      return;
    }

    if (!hasBody) {
      stopTyping(channelSlug);
      return;
    }

    if (typingStateRef.current.isTyping && typingStateRef.current.channelSlug === channelSlug) return;
    if (typingStateRef.current.isTyping && typingStateRef.current.channelSlug !== channelSlug) {
      stopTyping(typingStateRef.current.channelSlug);
    }
    typingStateRef.current = { channelSlug, isTyping: true };
    postTypingState(channelSlug, true);
    scheduleTypingRefresh(channelSlug);
  }, [activeChannel.slug, body, postTypingState, scheduleTypingRefresh, stopTyping]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (!documentIsVisible()) {
        if (readReceiptTimerRef.current !== null) {
          window.clearTimeout(readReceiptTimerRef.current);
          readReceiptTimerRef.current = null;
        }
        pendingReadReceiptRef.current = null;
        stopTyping();
        return;
      }

      const currentChannel = activeChannelRef.current;
      if (shouldStickLatestRef.current) {
        markRead(currentChannel, messagesByChannelRef.current[currentChannel.slug] ?? []);
      }
      if (bodyRef.current.trim()) {
        typingStateRef.current = { channelSlug: currentChannel.slug, isTyping: true };
        postTypingState(currentChannel.slug, true);
        scheduleTypingRefresh(currentChannel.slug);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (readReceiptTimerRef.current !== null) {
        window.clearTimeout(readReceiptTimerRef.current);
        readReceiptTimerRef.current = null;
      }
      pendingReadReceiptRef.current = null;
      stopTyping();
    };
  }, [markRead, postTypingState, scheduleTypingRefresh, stopTyping]);

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
    const markOffline = () => setStreamStatus("reconnecting");
    const markOnline = () => {
      setStreamStatus("reconnecting");
      setStreamReconnectKey((current) => current + 1);
    };
    const source = new EventSource("/api/community/realtime/stream");
    source.addEventListener("open", () => setStreamStatus("live"));
    source.addEventListener("error", () => setStreamStatus("reconnecting"));
    window.addEventListener("offline", markOffline);
    window.addEventListener("online", markOnline);
    const onlineCheck = window.setInterval(() => {
      if (!navigator.onLine) setStreamStatus("reconnecting");
    }, 750);
    source.addEventListener("realtime-event", (event) => {
      try {
        const realtimeEvent = JSON.parse((event as MessageEvent).data) as RealtimeEvent;
        if (realtimeEvent.event_type === "chat.message.created" || realtimeEvent.event_type === "chat.system_message.created") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          const message = realtimeEvent.payload.message;
          if (typeof channelSlug !== "string" || !isChatMessage(message)) return;
          if (seenIdsRef.current.has(message.id)) return;
          seenIdsRef.current.add(message.id);
          upsertMessage(channelSlug, message, 120);
          patchChannelBySlug(channelSlug, {
            last_message_body: message.body,
            last_message_sender_label: message.sender_label,
            last_message_sender_user_id: message.sender_user_id,
            last_message_at: message.created_at,
            unread_count: channelSlug === activeChannelRef.current.slug ? 0 : ((channelListRef.current.find((channel) => channel.slug === channelSlug)?.unread_count ?? 0) + 1)
          });
          if (channelSlug === activeChannelRef.current.slug) {
            void markRead(activeChannelRef.current, [...(messagesByChannelRef.current[channelSlug] ?? []), message]);
          }
          patchThreadCacheMessage(message);
          return;
        }

        if (realtimeEvent.event_type === "chat.message.reaction.changed" || realtimeEvent.event_type === "chat.message.updated" || realtimeEvent.event_type === "chat.poll.updated") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          const message = realtimeEvent.payload.message;
          if (typeof channelSlug !== "string" || !isChatMessage(message)) return;
          updateMessage(channelSlug, message);
          patchThreadCacheMessage(message);
          if (realtimeEvent.event_type === "chat.message.updated") {
            const channel = channelListRef.current.find((item) => item.slug === channelSlug);
            if (channel?.last_message_id === message.id) {
              patchChannelBySlug(channelSlug, { last_message_body: message.body, last_message_sender_label: message.sender_label });
            }
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
          patchChannelBySlug(channelSlug, nextControls);
          if (channelSlug === activeChannelRef.current.slug) {
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
          patchChannelPresence(channelSlug, {
            typing: typing.filter((item): item is ChatPresenceSummary["typing"][number] => typeof item === "object" && item !== null && "user_id" in item),
            online_count: typeof onlineCount === "number" ? onlineCount : presenceByChannelRef.current[channelSlug]?.online_count ?? 0
          });
          return;
        }

        if (realtimeEvent.event_type === "chat.presence.changed") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          const onlineCount = realtimeEvent.payload.online_count;
          if (typeof channelSlug !== "string" || typeof onlineCount !== "number") return;
          patchChannelPresence(channelSlug, { online_count: onlineCount });
          patchChannelBySlug(channelSlug, { online_count: onlineCount });
          return;
        }

        if (realtimeEvent.event_type === "chat.attachment.updated") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          const attachment = realtimeEvent.payload.attachment;
          if (typeof channelSlug !== "string" || typeof attachment !== "object" || attachment === null || !("id" in attachment)) return;
          const updated = attachment as ChatAttachment;
          for (const message of messagesByChannelRef.current[channelSlug] ?? []) {
            if (message.attachments?.some((item) => item.id === updated.id)) {
              patchMessage(channelSlug, message.id, {
                attachments: message.attachments.map((item) => item.id === updated.id ? updated : item)
              });
            }
          }
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
          updateMessage(channelSlug, deletedMessage);
          const channel = channelListRef.current.find((item) => item.slug === channelSlug);
          if (channel?.last_message_id === messageId) {
            const latestVisible = (messagesByChannelRef.current[channelSlug] ?? [])
              .filter((item) => item.id !== messageId && item.status === "visible")
              .at(-1);
            patchChannelBySlug(channelSlug, {
              last_message_id: latestVisible?.id ?? null,
              last_message_at: latestVisible?.created_at ?? null,
              last_message_body: latestVisible?.body ?? null,
              last_message_sender_label: latestVisible?.sender_label ?? null,
              last_message_sender_user_id: latestVisible?.sender_user_id ?? null
            });
          }
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
        filterChannelMessages(channelSlug, (message) => message.id !== messageId);
      } catch {
        // Keep the lobby stream alive when a non-chat event has an unexpected payload.
      }
    });

    return () => {
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("online", markOnline);
      window.clearInterval(onlineCheck);
      source.close();
    };
  }, [filterChannelMessages, markRead, patchChannelBySlug, patchChannelPresence, patchMessage, streamReconnectKey, updateMessage, upsertMessage]);

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
    suppressBackgroundChat(2500);
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
          ? {
              attachments: mergeAttachmentsById(current[activeChannel.slug]?.attachments ?? [], payload.data.attachments),
              page_info: payload.data.page_info
            }
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
      showNotice("Attachment reported. The moderation team can now review it.");
      setViewer(null);
    } catch (reportError) { setError(reportError instanceof Error ? reportError.message : "Attachment could not be reported."); }
  }

  async function hydrateMessage(messageId: string, include: "attachments" | "poll" | "thread" | "all") {
    suppressBackgroundChat(2500);
    const cached = hydratedMessagesRef.current.get(messageId)
      ?? messagesByChannelRef.current[activeChannel.slug]?.find((message) => message.id === messageId)
      ?? null;
    if (cached && messageHasDetail(cached, include)) return cached;
    if (hydratingMessageIds.has(messageId)) return cached;
    setHydratingMessageIds((current) => new Set(current).add(messageId));
    setError(null);
    try {
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(messageId)}?include=${encodeURIComponent(include)}`,
        { headers: { accept: "application/json" }, cache: "no-store" }
      );
      const payload = await response.json() as ApiEnvelope<{ channel: ChatChannel; message: ChatMessage }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Message details could not load." : "Message details could not load.");
      }
      const previous = hydratedMessagesRef.current.get(payload.data.message.id);
      const hydrated = previous ? preserveLocalAttachmentPreviews({ ...previous, ...payload.data.message }, previous) : payload.data.message;
      hydratedMessagesRef.current.set(hydrated.id, hydrated);
      upsertMessage(activeChannel.slug, hydrated, 120);
      patchThreadCacheMessage(hydrated);
      setActionMessage((current) => current?.id === hydrated.id ? hydrated : current);
      setReplyTo((current) => current?.id === hydrated.id ? hydrated : current);
      setThreadTarget((current) => current?.id === hydrated.id ? hydrated : current);
      return hydrated;
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Message details could not load.");
      return null;
    } finally {
      setHydratingMessageIds((current) => {
        const next = new Set(current);
        next.delete(messageId);
        return next;
      });
    }
  }

  async function hydrateMessageDetail(message: ChatMessage, include: "attachments" | "poll" | "thread" | "all") {
    return hydrateMessage(message.id, include);
  }

  async function deliverMessage(channel: ChatChannel, message: ChatMessage) {
    suppressBackgroundChat(5000);
    setIsSending(true);
    patchMessage(channel.slug, message.id, { client_delivery_state: "sending", client_error: undefined });
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
      upsertMessage(channel.slug, payload.data.message, 120);
      patchChannelBySlug(channel.slug, {
        last_message_body: payload.data.message.body,
        last_message_sender_label: "You",
        last_message_sender_user_id: currentUserId,
        last_message_at: payload.data.message.created_at
      });
      void markRead(channel, [...(messagesByChannelRef.current[channel.slug] ?? []), payload.data.message]);
      stopTyping(channel.slug);
      if ((channel.slow_mode_seconds ?? 0) > 0 && !canModerateMessages) {
        setCooldownUntil(new Date(Date.now() + (channel.slow_mode_seconds ?? 0) * 1000).toISOString());
        setCooldownClock(Date.now());
      }
    } catch (sendError) {
      patchMessage(channel.slug, message.id, {
        client_delivery_state: "failed",
        client_error: sendError instanceof Error ? sendError.message : "Message could not be sent."
      });
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
    setShowJumpLatest(false);
    setError(null);
    setBody("");
    setPendingAttachments([]);
    setReplyTo(null);
    upsertMessage(activeChannel.slug, nextMessage, 120);
    await deliverMessage(activeChannel, nextMessage);
  }

  async function retryMessage(message: ChatMessage) {
    shouldStickLatestRef.current = true;
    setError(null);
    await deliverMessage(activeChannel, message);
  }

  function dismissFailedMessage(message: ChatMessage) {
    filterChannelMessages(activeChannel.slug, (item) => item.client_message_id !== message.client_message_id);
  }

  async function loadOlderMessages() {
    suppressBackgroundChat(3000);
    if (!pageInfo.has_older || !pageInfo.older_cursor || isLoadingOlder) return;
    shouldStickLatestRef.current = false;
    setIsLoadingOlder(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages?limit=60&view=list&cursor=${encodeURIComponent(pageInfo.older_cursor)}`,
        { headers: { accept: "application/json" }, cache: "no-store" }
      );
      const payload = (await response.json()) as ApiEnvelope<{
        messages: ChatMessage[];
        page_info: ChatMessagePageInfo;
      }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Older messages could not load." : "Older messages could not load.");
      }
      const existing = messagesByChannelRef.current[activeChannel.slug] ?? [];
      const ids = new Set(existing.map((message) => message.id));
      replaceChannelMessages(activeChannel.slug, [...payload.data.messages.filter((message) => !ids.has(message.id)), ...existing]);
      setPageInfoByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.page_info }));
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
        const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages?limit=60&view=list`, {
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
        replaceChannelMessages(activeChannel.slug, payload.data.messages);
        setPinnedByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.pinned_messages }));
        setChannelPresence(activeChannel.slug, payload.data.presence);
        setPageInfoByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.page_info }));
        setReadBoundaryByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.read_boundary }));
        setIsContextView(false);
      } catch (latestError) {
        setError(latestError instanceof Error ? latestError.message : "Latest messages could not load.");
      } finally {
        setIsLoadingChannel(false);
      }
    }
    setJumpLatestToken((current) => current + 1);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("message");
    window.history.replaceState({}, "", nextUrl);
    void markRead(activeChannel, messages);
  }

  async function jumpToMessage(messageId: string) {
    const loaded = messagesByChannelRef.current[activeChannel.slug]?.find((message) => message.id === messageId);
    if (loaded) {
      if (loaded && !messageHasDetail(loaded, "all")) {
        void hydrateMessage(messageId, "all");
      }
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
      payload.data.messages.forEach((message) => hydratedMessagesRef.current.set(message.id, message));
      shouldStickLatestRef.current = false;
      setIsContextView(true);
      replaceChannelMessages(activeChannel.slug, payload.data.messages);
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

  function mergeSearchResults(current: ChatMessage[], next: ChatMessage[]) {
    const seen = new Set(current.map((message) => message.id));
    return [...current, ...next.filter((message) => !seen.has(message.id))];
  }

  function searchHasFilters() {
    return Boolean(searchQuery.trim() || searchUser || searchDateFrom || searchDateTo || searchMentions || searchLinks || searchPinned);
  }

  function searchCacheKey(cursor?: string | null) {
    return JSON.stringify({
      channel: activeChannel.slug,
      q: searchQuery.trim(),
      user: searchUser,
      date_from: searchDateFrom,
      date_to: searchDateTo,
      mentions: searchMentions,
      links: searchLinks,
      pinned: searchPinned,
      cursor: cursor ?? null
    });
  }

  async function runSearch(event?: FormEvent<HTMLFormElement>, cursor?: string | null) {
    event?.preventDefault();
    suppressBackgroundChat(4500);
    if (!searchHasFilters()) {
      searchAbortRef.current?.abort();
      setSearchError("Choose a word or at least one filter.");
      setSearchResults([]);
      setSearchPageInfo({ has_more: false, next_cursor: null });
      return;
    }

    const cacheKey = searchCacheKey(cursor);
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached) {
      setSearchResults((current) => cursor ? mergeSearchResults(current, cached.messages) : cached.messages);
      setSearchPageInfo(cached.pageInfo);
      setSearchError(null);
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setIsSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ limit: "25", view: "list" });
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
        { headers: { accept: "application/json" }, cache: "no-store", signal: controller.signal }
      );
      const payload = (await response.json()) as ApiEnvelope<{ messages: ChatMessage[]; page_info: ChatSearchPageInfo }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Search could not be completed." : "Search could not be completed.");
      }
      searchCacheRef.current.set(cacheKey, { messages: payload.data.messages, pageInfo: payload.data.page_info });
      if (searchCacheRef.current.size > 30) {
        const oldest = searchCacheRef.current.keys().next().value;
        if (oldest) searchCacheRef.current.delete(oldest);
      }
      setSearchResults((current) => cursor ? mergeSearchResults(current, payload.data.messages) : payload.data.messages);
      setSearchPageInfo(payload.data.page_info);
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === "AbortError") return;
      setSearchError(nextError instanceof Error ? nextError.message : "Search could not be completed.");
    } finally {
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null;
        setIsSearching(false);
      }
    }
  }

  useEffect(() => {
    if (showSearch) suppressBackgroundChat(10_000);
  }, [showSearch, suppressBackgroundChat]);

  useEffect(() => {
    if (!showSearch) {
      searchAbortRef.current?.abort();
      return;
    }

    if (!searchHasFilters()) {
      searchAbortRef.current?.abort();
      setSearchResults([]);
      setSearchPageInfo({ has_more: false, next_cursor: null });
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void runSearch(undefined, null);
    }, 400);

    return () => window.clearTimeout(timer);
    // Search is intentionally debounced from primitive filter state; runSearch reads the same values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel.slug, searchDateFrom, searchDateTo, searchLinks, searchMentions, searchPinned, searchQuery, searchUser, showSearch]);

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
      updateMessage(activeChannel.slug, payload.data.message);
      if (activeChannel.last_message_id === payload.data.message.id) {
        patchChannelBySlug(activeChannel.slug, { last_message_body: payload.data.message.body });
      }
      setEditTarget(null);
      setEditBody("");
      showNotice("Message edited.");
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
      updateMessage(activeChannel.slug, payload.data.message);
      setPinnedByChannel((current) => ({
        ...current,
        [activeChannel.slug]: (current[activeChannel.slug] ?? []).filter((pin) => pin.message_id !== message.id)
      }));
      if (activeChannel.last_message_id === message.id) {
        const latestVisible = (messagesByChannelRef.current[activeChannel.slug] ?? [])
          .filter((item) => item.id !== message.id && item.status === "visible")
          .at(-1);
        patchChannelBySlug(activeChannel.slug, {
          last_message_id: latestVisible?.id ?? null,
          last_message_at: latestVisible?.created_at ?? null,
          last_message_body: latestVisible?.body ?? null,
          last_message_sender_label: latestVisible?.sender_label ?? null,
          last_message_sender_user_id: latestVisible?.sender_user_id ?? null
        });
      }
      setReplyTo((current) => current?.id === message.id ? null : current);
      setDeleteTarget(null);
      setActionMessage(null);
      showNotice("Message deleted.");
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
      updateMessage(activeChannel.slug, payload.data.message);
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
        showNotice("Pinned. The chat banner rotates the latest 3 pins; all pins stay in the Pins tab.");
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
    suppressBackgroundChat(3500);
    const hydratedTarget = await hydrateMessage(message.id, "thread");
    const target = hydratedTarget ?? message;
    const rootMessageId = threadRootId(target);
    const cached = threadCacheRef.current.get(rootMessageId);
    setThreadTarget(target);
    setThreadBody("");
    setError(null);
    if (cached) {
      setThreadMessages(cached.messages);
      setThreadPageInfo(cached.pageInfo);
      setIsLoadingThread(false);
      return;
    }

    setIsLoadingThread(true);
    setThreadMessages([]);
    setThreadPageInfo({ has_older: false, older_cursor: null });
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(message.id)}/thread?limit=40&view=list`, {
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      const payload = (await response.json()) as ApiEnvelope<{ root_message_id: string; messages: ChatMessage[]; page_info?: ChatMessagePageInfo }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Thread could not load." : "Thread could not load.");
      payload.data.messages.forEach((threadMessage) => hydratedMessagesRef.current.set(threadMessage.id, threadMessage));
      replaceThreadCache(payload.data.root_message_id, payload.data.messages, payload.data.page_info ?? { has_older: false, older_cursor: null });
    } catch (threadError) {
      setError(threadError instanceof Error ? threadError.message : "Thread could not load.");
    } finally {
      setIsLoadingThread(false);
    }
  }

  async function loadOlderThreadReplies() {
    if (!threadTarget || isLoadingOlderThread || !threadPageInfo.has_older || !threadPageInfo.older_cursor) return;
    const rootMessageId = threadRootId(threadTarget);
    setIsLoadingOlderThread(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(rootMessageId)}/thread?limit=40&view=list&cursor=${encodeURIComponent(threadPageInfo.older_cursor)}`,
        { headers: { accept: "application/json" }, cache: "no-store" }
      );
      const payload = (await response.json()) as ApiEnvelope<{ root_message_id: string; messages: ChatMessage[]; page_info?: ChatMessagePageInfo }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Older replies could not load." : "Older replies could not load.");
      payload.data.messages.forEach((threadMessage) => hydratedMessagesRef.current.set(threadMessage.id, threadMessage));
      const current = threadCacheRef.current.get(payload.data.root_message_id)?.messages ?? threadMessages;
      const seen = new Set<string>();
      const merged = [...payload.data.messages, ...current]
        .filter((message) => {
          if (seen.has(message.id)) return false;
          seen.add(message.id);
          return true;
        })
        .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
      replaceThreadCache(payload.data.root_message_id, merged, payload.data.page_info ?? { has_older: false, older_cursor: null });
    } catch (threadError) {
      setError(threadError instanceof Error ? threadError.message : "Older replies could not load.");
    } finally {
      setIsLoadingOlderThread(false);
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
      patchThreadCacheMessage(payload.data.message);
      upsertMessage(activeChannel.slug, payload.data.message, 120);
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
        upsertMessage(activeChannel.slug, payload.data.message, 120);
      }
      setForwardTarget(null);
      setForwardChannelSlug("");
      showNotice("Message forwarded.");
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
      patchMessage(activeChannel.slug, message.id, { bookmarked_by_me: payload.data.bookmarked });
      showNotice(payload.data.bookmarked ? "Saved privately." : "Removed from saved.");
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
      upsertMessage(activeChannel.slug, payload.data.message, 120);
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
      updateMessage(activeChannel.slug, payload.data.message);
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
        showNotice("DM request already pending. Open Inbox to check or respond.");
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
      showNotice("DM request sent.");
    } catch (dmError) {
      if (dmError instanceof Error && /already pending/i.test(dmError.message)) {
        setProfileUser(null);
        showNotice("DM request already pending. Open Inbox to check or respond.");
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
        patchChannel(payload.data.channel);
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
      filterChannelMessages(activeChannel.slug, (item) => item.sender_user_id !== message.sender_user_id);
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
      setPushEnabled(payload.data.controls.browser_push_enabled ?? payload.data.controls.push_enabled);
      setSlowModeSeconds(payload.data.controls.slow_mode_seconds);
      setActiveChannel(payload.data.channel);
      patchChannel(payload.data.channel);
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
    if (!publicKey) throw new Error("Browser notifications are not available on this deployment yet.");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser does not support browser notifications.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Browser notification permission was not granted.");
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
    setSettingsNotice(null);
    setError(null);
    const requestedBrowserPushEnabled = pushEnabled;
    try {
      if (requestedBrowserPushEnabled) await ensurePushSubscription();
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/controls/notifications`, {
        method: "PATCH",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          notification_level: notificationLevel,
          dm_notification_level: dmNotificationLevel,
          browser_push_enabled: requestedBrowserPushEnabled,
          push_enabled: requestedBrowserPushEnabled
        })
      });
      const payload = await response.json() as ApiEnvelope<{ membership: { notification_level: ChatNotificationLevel; dm_notification_level: ChatNotificationLevel; browser_push_enabled?: boolean; push_enabled: boolean } }>;
      if (!response.ok || payload.ok !== true) throw new Error(payload.ok === false ? payload.error?.message ?? "Notification settings could not be saved." : "Notification settings could not be saved.");
      const savedBrowserPushEnabled = payload.data.membership.browser_push_enabled ?? payload.data.membership.push_enabled ?? requestedBrowserPushEnabled;
      setPushEnabled(savedBrowserPushEnabled);
      showSettingsNotice(savedBrowserPushEnabled === requestedBrowserPushEnabled
        ? "Notification settings saved."
        : "Notification settings saved, but browser alerts are still off.", savedBrowserPushEnabled === requestedBrowserPushEnabled ? "success" : "warning");
    } catch (controlError) {
      setPushEnabled(false);
      setError(null);
      showSettingsNotice(browserPushSettingsMessage(controlError), "danger");
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
      patchChannel(payload.data.channel);
      setChannelControls((current) => current ? {
        ...current,
        slow_mode_seconds: payload.data.channel.slow_mode_seconds ?? 0,
        lockdown_until: payload.data.channel.lockdown_until ?? null,
        lockdown_reason: payload.data.channel.lockdown_reason ?? null
      } : current);
      showNotice(action === "unlock" ? "Channel lockdown removed." : action === "lock" ? "Channel locked temporarily." : "Slow mode saved.");
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
      showNotice("User unblocked.");
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
      showNotice("User reported.");
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
      filterChannelMessages(activeChannel.slug, (item) => item.sender_user_id !== target.user_id);
      setProfileUser(null);
      showNotice("User blocked.");
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : "User could not be blocked.");
    } finally {
      setProfileAction(null);
    }
  }

  const handleBeginLongPress = useStableCallback(beginLongPress);
  const handleBlockUser = useStableCallback(blockUser);
  const handleClearLongPress = useStableCallback(clearLongPress);
  const handleDismissFailedMessage = useStableCallback(dismissFailedMessage);
  const handleHydrateMessageDetail = useStableCallback(hydrateMessageDetail);
  const handleJumpToMessage = useStableCallback(jumpToMessage);
  const handleOpenImage = useStableCallback((attachment: ChatAttachment, url: string) => {
    setViewer({ attachment, url });
  });
  const handleOpenMessageActions = useStableCallback(openMessageActions);
  const handleOpenMessageUserProfile = useStableCallback(openMessageUserProfile);
  const handleOpenThread = useStableCallback(openThread);
  const handleReactToMessage = useStableCallback(reactToMessage);
  const handleReplyToMessage = useStableCallback((message: ChatMessage) => {
    setReplyTo(message);
  });
  const handleReportMessage = useStableCallback(reportMessage);
  const handleReportUser = useStableCallback(reportUser);
  const handleRetryMessage = useStableCallback(retryMessage);
  const handleStartPin = useStableCallback((message: ChatMessage) => {
    setPinDurationHours(168);
    setPinTarget(message);
  });
  const handleVotePoll = useStableCallback(votePoll);

  return (
    <section className={[
      "min-w-0 overflow-hidden shadow-tight",
      fullLayout ? "fixed inset-0 grid h-[100dvh] max-h-[100dvh] grid-rows-[auto_minmax(0,1fr)] border-0 bg-[#0f1b29] overscroll-none" : "rounded-lg border border-line bg-white"
    ].join(" ")}>
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
        <div className={["inline-flex min-h-9 w-fit shrink-0 items-center gap-2 rounded-full border px-2 text-[0.68rem] font-black sm:px-3 sm:text-xs", fullLayout ? "border-white/10 bg-white/5 text-slate-300" : "border-line bg-white text-muted"].join(" ")} data-testid="chat-stream-status">
          <span className={streamStatus === "live" ? "text-success" : "text-warning"}>{statusLabel}</span>
        </div>
        <button aria-label="Open saved messages" className={["hidden h-9 min-w-9 shrink-0 place-items-center rounded-full border px-2 text-xs font-black sm:grid", fullLayout ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-surfaceHigh"].join(" ")} onClick={() => void loadBookmarks()} title="Saved messages" type="button">Saved</button>
        {isChatAdmin ? <button aria-label="Schedule announcement" className={["hidden h-9 min-w-9 shrink-0 place-items-center rounded-full border px-2 text-xs font-black sm:grid", fullLayout ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-surfaceHigh"].join(" ")} onClick={() => void loadScheduledAnnouncements()} title="Schedule announcement" type="button">Announce</button> : null}
        <button aria-label="Search channel messages" className={["grid h-9 min-w-9 shrink-0 place-items-center rounded-full border px-2 text-xs font-black", fullLayout ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-surfaceHigh"].join(" ")} onClick={() => setShowSearch(true)} title="Search messages" type="button">Search</button>
        <button aria-label="Open channel details" className={["grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-black", fullLayout ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-surfaceHigh"].join(" ")} onClick={() => setShowChannelInfo(true)} title="Channel details" type="button">i</button>
      </header>

      {showChannelInfo ? (
        <ChatInfoPanel
          activeChannel={activeChannel}
          activeChannelSubtitle={activeChannelSubtitle}
          blockedUsers={blockedUsers}
          canManageAnyPin={canManageAnyPin}
          channelControls={channelControls}
          communityChannels={communityChannels}
          controlAction={controlAction}
          currentUserId={currentUserId}
          displayActiveChannel={displayActiveChannel}
          dmChannels={dmChannels}
          dmNotificationLevel={dmNotificationLevel}
          infoTab={infoTab}
          isLoadingBlockedUsers={isLoadingBlockedUsers}
          isLoadingControls={isLoadingControls}
          isLoadingMedia={isLoadingMedia}
          isSavingControls={isSavingControls}
          lockdownMinutes={lockdownMinutes}
          lockdownReason={lockdownReason}
          mediaError={mediaError}
          mediaPage={mediaByChannel[activeChannel.slug]}
          notificationLevel={notificationLevel}
          pinnedMessages={pinnedMessages}
          pushEnabled={pushEnabled}
          settingsNotice={settingsNotice}
          slowModeSeconds={slowModeSeconds}
          unblockingIds={unblockingIds}
          unpinningIds={unpinningIds}
          userDirectory={userDirectory}
          onClose={() => setShowChannelInfo(false)}
          onGoHome={goHome}
          onInfoTabChange={(tab) => {
            setInfoTab(tab);
            if (tab === "media" && !mediaByChannel[activeChannel.slug]) void loadMedia();
            if (tab === "settings") {
              void loadChannelControls();
              void loadBlockedUsers();
            }
          }}
          onLoadMedia={loadMedia}
          onOpenChannel={async (channel) => {
            setShowChannelInfo(false);
            await openChannel(channel);
          }}
          onOpenPinnedMessage={openPinnedMessage}
          onOpenUserProfile={openUserProfile}
          onSaveModerationControls={saveModerationControls}
          onSaveNotificationControls={saveNotificationControls}
          onSetDmNotificationLevel={setDmNotificationLevel}
          onSetLockdownMinutes={setLockdownMinutes}
          onSetLockdownReason={setLockdownReason}
          onSetNotificationLevel={setNotificationLevel}
          onSetPushEnabled={setPushEnabled}
          onSetSlowModeSeconds={setSlowModeSeconds}
          onUnblockUser={unblockUser}
          onUnpinMessage={unpinMessage}
          onViewImage={(attachment, url) => setViewer({ attachment, url })}
        />
      ) : null}


      {profileUser ? (
        <ChatProfileModal
          activeChannel={activeChannel}
          channel={displayActiveChannel}
          dmIntro={profileDmIntro}
          isRequestingDm={isRequestingProfileDm}
          isSelf={profileIsSelf}
          profileAction={profileAction}
          user={profileUser}
          onBlock={blockProfileUser}
          onClose={() => setProfileUser(null)}
          onDmIntroChange={setProfileDmIntro}
          onReport={reportProfileUser}
          onRequestDm={requestProfileDm}
        />
      ) : null}


      {showSearch ? (
        <ChatSearchPanel
          channelTitle={channelTitle(displayActiveChannel)}
          dateFrom={searchDateFrom}
          dateTo={searchDateTo}
          error={searchError}
          isSearching={isSearching}
          linksOnly={searchLinks}
          mentions={searchMentions}
          pageInfo={searchPageInfo}
          pinnedOnly={searchPinned}
          query={searchQuery}
          results={searchResults}
          userDirectory={userDirectory}
          userId={searchUser}
          onClose={() => setShowSearch(false)}
          onDateFromChange={setSearchDateFrom}
          onDateToChange={setSearchDateTo}
          onJumpToMessage={jumpToMessage}
          onLinksOnlyChange={setSearchLinks}
          onMentionsChange={setSearchMentions}
          onPinnedOnlyChange={setSearchPinned}
          onQueryChange={setSearchQuery}
          onSearch={runSearch}
          onUserChange={setSearchUser}
        />
      ) : null}

      {notice ? (
        <div className="pointer-events-none fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[80] md:inset-x-auto md:right-6 md:top-20 md:bottom-auto md:w-[24rem]">
          <div aria-live={notice.tone === "danger" ? "assertive" : "polite"} className="pointer-events-auto motion-page-enter">
            <Toast description={notice.description} title={notice.title} tone={notice.tone}>
              <button
                aria-label="Dismiss message"
                className="rounded-sm px-2 py-1 text-xs font-black text-muted hover:bg-white/60 hover:text-ink"
                onClick={() => setNotice(null)}
                type="button"
              >
                Close
              </button>
            </Toast>
          </div>
        </div>
      ) : null}


      <ChatActionModals
        actionMessage={actionMessage}
        activeChannel={activeChannel}
        bookmarks={bookmarks}
        bookmarkingIds={bookmarkingIds}
        canDeleteMessage={canDeleteMessage}
        canEditMessage={canEditMessage}
        canManageAnyPin={canManageAnyPin}
        channelList={channelList}
        currentUserId={currentUserId}
        deleteTarget={deleteTarget}
        deletingIds={deletingIds}
        editBody={editBody}
        editTarget={editTarget}
        forwardChannelSlug={forwardChannelSlug}
        forwardTarget={forwardTarget}
        isCreatingPoll={isCreatingPoll}
        isEditing={isEditing}
        isForwarding={isForwarding}
        isLoadingBookmarks={isLoadingBookmarks}
        isLoadingReactions={isLoadingReactions}
        isLoadingSchedules={isLoadingSchedules}
        isPinning={isPinning}
        isScheduling={isScheduling}
        pinDurationHours={pinDurationHours}
        pinnedMessages={pinnedMessages}
        pinTarget={pinTarget}
        pollClosesAt={pollClosesAt}
        pollMultiple={pollMultiple}
        pollOptions={pollOptions}
        pollQuestion={pollQuestion}
        reactionMembers={reactionMembers}
        reactionOptions={reactionOptions}
        reactionTarget={reactionTarget}
        scheduledAnnouncements={scheduledAnnouncements}
        scheduledBody={scheduledBody}
        scheduledFor={scheduledFor}
        showBookmarks={showBookmarks}
        showPollCreator={showPollCreator}
        showSchedule={showSchedule}
        onBeginEdit={beginEdit}
        onCancelEdit={() => { setEditTarget(null); setEditBody(""); }}
        onCloseActionMessage={() => setActionMessage(null)}
        onCloseBookmarks={() => setShowBookmarks(false)}
        onClosePollCreator={() => setShowPollCreator(false)}
        onCloseReactionDetails={() => setReactionTarget(null)}
        onCloseSchedule={() => setShowSchedule(false)}
        onCopyMessageLink={(message) => copyToClipboard(messageLink(message), "Message link copied.")}
        onCopyText={(text) => copyToClipboard(text, "Message copied.")}
        onCreatePoll={createPoll}
        onDeleteMessage={deleteMessage}
        onEditBodyChange={setEditBody}
        onForwardChannelSlugChange={setForwardChannelSlug}
        onForwardMessage={forwardMessage}
        onJumpToBookmark={async (bookmark) => {
          const channel = channelList.find((item) => item.slug === bookmark.channel_slug);
          setShowBookmarks(false);
          if (channel && channel.slug !== activeChannel.slug) await openChannel(channel).then(() => jumpToMessage(bookmark.message_id));
          else await jumpToMessage(bookmark.message_id);
        }}
        onOpenReactions={openReactionDetails}
        onOpenThread={openThread}
        onPinMessage={pinMessage}
        onPollClosesAtChange={setPollClosesAt}
        onPollMultipleChange={setPollMultiple}
        onPollOptionsChange={setPollOptions}
        onPollQuestionChange={setPollQuestion}
        onReportMessage={reportMessage}
        onReply={(message) => { setReplyTo(message); setActionMessage(null); composerRef.current?.focus(); }}
        onSaveEdit={saveMessageEdit}
        onScheduleAnnouncement={scheduleAnnouncement}
        onScheduledBodyChange={setScheduledBody}
        onScheduledForChange={setScheduledFor}
        onSetDeleteTarget={setDeleteTarget}
        onSetForwardTarget={setForwardTarget}
        onSetPinDurationHours={setPinDurationHours}
        onSetPinTarget={setPinTarget}
        onToggleBookmark={toggleBookmark}
      />

      {threadTarget ? (
        <ChatThreadPanel
          body={threadBody}
          currentUserId={currentUserId}
          isLoading={isLoadingThread}
          isLoadingOlder={isLoadingOlderThread}
          isSending={isSendingThread}
          messages={threadMessages}
          pageInfo={threadPageInfo}
          target={threadTarget}
          onBodyChange={setThreadBody}
          onClose={() => setThreadTarget(null)}
          onLoadOlder={loadOlderThreadReplies}
          onSubmit={sendThreadReply}
        />
      ) : null}


      <div className={[
        "grid",
        fullLayout ? "h-full min-h-0 overflow-hidden bg-[#0f1b29] md:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(34rem,58rem)_20rem] 2xl:grid-cols-[20rem_minmax(38rem,64rem)_22rem] xl:justify-center" : "min-h-[34rem] lg:grid-cols-[20rem_minmax(0,1fr)]"
      ].join(" ")}>
        <ChannelListPanel
          activeChannel={activeChannel}
          communityChannels={communityChannels}
          dmChannels={dmChannels}
          dmIntro={dmIntro}
          dmUsername={dmUsername}
          fullLayout={fullLayout}
          pendingIncomingDmRequests={pendingIncomingDmRequests}
          onCreateDmRequest={createDmRequest}
          onDmIntroChange={setDmIntro}
          onDmUsernameChange={setDmUsername}
          onOpenChannel={(channel) => void openChannel(channel)}
          onRespondDmRequest={(requestId, responseValue) => void respondDmRequest(requestId, responseValue)}
        />

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
          <ChatVirtualThread
            activeChannelSlug={activeChannel.slug}
            canManageAnyPin={canManageAnyPin}
            currentUserId={currentUserId}
            fullLayout={fullLayout}
            hydratingMessageIds={hydratingMessageIds}
            isContextView={isContextView}
            isDirectMessage={isDirectMessage}
            isLoadingChannel={isLoadingChannel}
            isLoadingOlder={isLoadingOlder}
            isSending={isSending}
            jumpLatestToken={jumpLatestToken}
            messages={messages}
            pageInfoHasOlder={pageInfo.has_older}
            pendingJumpMessageId={pendingJumpMessageId}
            pinnedMessageIds={pinnedMessageIds}
            presence={presence}
            reactionOptions={reactionOptions}
            reportingIds={reportingIds}
            showJumpLatest={showJumpLatest}
            unreadMessageId={unreadMessageId}
            votingPollIds={votingPollIds}
            onBeginLongPress={handleBeginLongPress}
            onBlockUser={handleBlockUser}
            onClearLongPress={handleClearLongPress}
            onDismissFailedMessage={handleDismissFailedMessage}
            onHydrateMessage={handleHydrateMessageDetail}
            onJumpLatest={jumpToLatest}
            onJumpResolved={() => setPendingJumpMessageId(null)}
            onJumpToMessage={handleJumpToMessage}
            onLoadOlder={loadOlderMessages}
            onNearLatestChange={(nearLatest) => {
              shouldStickLatestRef.current = nearLatest;
              setShowJumpLatest(!nearLatest);
            }}
            onOpenImage={handleOpenImage}
            onOpenMessageActions={handleOpenMessageActions}
            onOpenMessageUserProfile={handleOpenMessageUserProfile}
            onOpenThread={handleOpenThread}
            onReactToMessage={handleReactToMessage}
            onReplyToMessage={handleReplyToMessage}
            onReportMessage={handleReportMessage}
            onReportUser={handleReportUser}
            onRetryMessage={handleRetryMessage}
            onStartPin={handleStartPin}
            onVotePoll={handleVotePoll}
          />

          <ChatComposer
            activeChannel={activeChannel}
            attachmentMenuRef={attachmentMenuRef}
            attachmentTriggerRef={attachmentTriggerRef}
            body={body}
            canModerateMessages={canModerateMessages}
            canSend={canSend}
            charactersLeft={charactersLeft}
            composerRef={composerRef}
            cooldownSeconds={cooldownSeconds}
            currentUserId={currentUserId}
            documentInputRef={documentInputRef}
            emojiGroup={emojiGroup}
            emojiPickerRef={emojiPickerRef}
            emojiTriggerRef={emojiTriggerRef}
            error={error}
            imageInputRef={imageInputRef}
            isChatAdmin={isChatAdmin}
            isDirectMessage={isDirectMessage}
            isSending={isSending}
            lockdownSeconds={lockdownSeconds}
            mentionSuggestions={mentionSuggestions}
            pendingAttachments={pendingAttachments}
            placeholder={composerPlaceholder}
            replyTo={replyTo}
            showAttachmentMenu={showAttachmentMenu}
            showEmojiPicker={showEmojiPicker}
            typingUsers={typingUsers}
            onBodyChange={setBody}
            onCreatePoll={() => setShowPollCreator(true)}
            onInsertMention={insertMention}
            onLoadBookmarks={loadBookmarks}
            onLoadScheduledAnnouncements={loadScheduledAnnouncements}
            onRemoveAttachment={removePendingAttachment}
            onRetryAttachment={(file, localId) => uploadAttachment(file, localId)}
            onSetEmojiGroup={setEmojiGroup}
            onSetReplyTo={setReplyTo}
            onShowAttachmentMenuChange={setShowAttachmentMenu}
            onShowEmojiPickerChange={setShowEmojiPicker}
            onSubmit={sendMessage}
            onUploadAttachment={uploadAttachment}
          />
        </div>
        {fullLayout ? <ChatSideRail users={userDirectory} onOpenUserProfile={openUserProfile} /> : null}
      </div>
      {viewer ? (
        <ChatImageViewer
          currentUserId={currentUserId}
          viewer={viewer}
          onClose={() => setViewer(null)}
          onReportAttachment={reportAttachment}
        />
      ) : null}
    </section>
  );
}

