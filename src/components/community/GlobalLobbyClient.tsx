"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ChatChannel, ChatDmRequest, ChatMessage, ChatMessagePageInfo, ChatPinnedMessage, ChatPresenceSummary, ChatSearchPageInfo } from "@/lib/match-room-api";

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
  | { ok: false; error?: { code?: string; message?: string } };

type RealtimeEvent = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
};

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

function channelInitials(channel: Pick<ChatChannel, "slug" | "title">) {
  if (channel.slug === "global_lobby") return "GC";
  const words = channel.title
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
  return "Channel";
}

function channelTitle(channel: Pick<ChatChannel, "slug" | "title">) {
  return channel.slug === "global_lobby" ? "Global Chat" : channel.title;
}

function channelPreview(channel: ChatChannel) {
  if (channel.last_message_body) {
    return `${channel.last_message_sender_label ?? "Player"}: ${channel.last_message_body}`;
  }
  return channel.description ?? `${channelTypeLabel(channel)} channel`;
}

function pendingMessage(channelId: string, userId: string, body: string, clientMessageId: string, replyTo: ChatMessage | null): ChatMessage {
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

function mergeMessage(current: ChatMessage[], next: ChatMessage) {
  const withoutDuplicate = current.filter((item) => (
    item.id !== next.id &&
    (!next.client_message_id || item.client_message_id !== next.client_message_id)
  ));
  return [...withoutDuplicate, next]
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

const emptyMessages: ChatMessage[] = [];
const emptyPinnedMessages: ChatPinnedMessage[] = [];
const emptyPresence: ChatPresenceSummary = { online_count: 0, active: [], typing: [] };
const reactionOptions = [
  { key: "like", label: "👍" },
  { key: "gg", label: "GG" },
  { key: "fire", label: "🔥" },
  { key: "clap", label: "👏" },
  { key: "trophy", label: "🏆" }
];

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
  const [infoTab, setInfoTab] = useState<"members" | "channels" | "pins">("members");
  const [pinTarget, setPinTarget] = useState<ChatMessage | null>(null);
  const [pinDurationHours, setPinDurationHours] = useState<24 | 168 | 720>(168);
  const [pinClock, setPinClock] = useState(() => Date.now());
  const [isPinning, setIsPinning] = useState(false);
  const [unpinningIds, setUnpinningIds] = useState<Set<string>>(new Set());
  const [chatViewport, setChatViewport] = useState<{ height: number; top: number } | null>(null);
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
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set(initialMessages.map((message) => message.id)));
  const messagesByChannelRef = useRef(messagesByChannel);
  const shouldStickLatestRef = useRef(true);
  const initialLinkHandledRef = useRef(false);

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
  const presence = presenceByChannel[activeChannel.slug] ?? emptyPresence;
  const charactersLeft = 1000 - body.length;
  const canSend = body.trim().length > 0 && body.trim().length <= 1000 && !isSending && !isLoadingChannel;
  const canManageAnyPin = ["support", "moderator", "admin", "owner"].includes(currentUserRole);
  const canModerateMessages = ["moderator", "admin", "owner"].includes(currentUserRole);
  const fullLayout = layout === "full";
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
  const mentionFragment = body.match(/(?:^|\s)@([A-Za-z0-9_]{0,24})$/)?.[1]?.toLowerCase() ?? null;
  const mentionSuggestions = mentionFragment === null ? [] : userDirectory
    .filter((user) => user.username && user.user_id !== currentUserId && user.username.toLowerCase().startsWith(mentionFragment))
    .slice(0, 5);

  const statusLabel = useMemo(() => {
    if (streamStatus === "live") return "Live";
    if (streamStatus === "reconnecting") return "Reconnecting";
    return "Connecting";
  }, [streamStatus]);

  function insertMention(username: string) {
    setBody((current) => current.replace(/(^|\s)@([A-Za-z0-9_]{0,24})$/, `$1@${username} `));
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

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    const frame = window.requestAnimationFrame(() => {
      const linkedMessageId = pendingJumpMessageId;
      const linkedMessage = linkedMessageId ? document.getElementById(`chat-message-${linkedMessageId}`) : null;
      if (linkedMessage) {
        linkedMessage.scrollIntoView({ block: "center", behavior: "smooth" });
        linkedMessage.animate(
          [{ outlineColor: "rgba(56, 189, 248, 0.9)" }, { outlineColor: "rgba(56, 189, 248, 0)" }],
          { duration: 1800, easing: "ease-out" }
        );
        if (pendingJumpMessageId) setPendingJumpMessageId(null);
      } else if (shouldStickLatestRef.current) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
    return () => window.cancelAnimationFrame(frame);
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
      const next = {
        height: Math.round(visualViewport?.height ?? window.innerHeight),
        top: Math.round(visualViewport?.offsetTop ?? 0)
      };
      setChatViewport((current) => current?.height === next.height && current.top === next.top ? current : next);
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
    composer.style.height = "0px";
    composer.style.height = `${Math.min(composer.scrollHeight, 112)}px`;
    composer.style.overflowY = composer.scrollHeight > 112 ? "auto" : "hidden";
  }, [body]);

  useEffect(() => {
    if (!pinnedMessages.length) return;
    const timer = window.setInterval(() => setPinClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [pinnedMessages.length]);

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
  }, [activeChannel.slug]);

  async function markRead(channel: ChatChannel, nextMessages: ChatMessage[]) {
    const lastMessage = nextMessages.at(-1);
    await fetch(`/api/community/channels/${encodeURIComponent(channel.slug)}/read`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ message_id: lastMessage?.id })
    }).catch(() => undefined);
  }

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

  function handleBack() {
    if (activeChannel.slug !== "global_lobby") {
      setInfoTab("channels");
      setShowChannelInfo(true);
      return;
    }
    window.location.assign("/");
  }

  function exitChat() {
    window.location.assign("/");
  }

  useEffect(() => {
    let closed = false;

    async function beat() {
      try {
        const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/heartbeat`, {
          method: "POST",
          headers: { accept: "application/json" }
        });
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
  }, [activeChannel.slug]);

  useEffect(() => {
    if (!body.trim()) {
      void fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/typing`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ is_typing: false })
      }).catch(() => undefined);
      return;
    }

    const timer = window.setTimeout(() => {
      void fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/typing`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ is_typing: true })
      }).catch(() => undefined);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [activeChannel.slug, body]);

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
          return;
        }

        if (realtimeEvent.event_type === "chat.message.reaction.changed" || realtimeEvent.event_type === "chat.message.updated") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          const message = realtimeEvent.payload.message;
          if (typeof channelSlug !== "string" || !isChatMessage(message)) return;
          setMessagesByChannel((current) => ({
            ...current,
            [channelSlug]: (current[channelSlug] ?? []).map((item) => item.id === message.id ? message : item)
          }));
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
  }, [activeChannel]);

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
          reply_to_message_id: message.reply_to_message_id ?? undefined
        })
      });
      const payload = (await response.json()) as ApiEnvelope<{ message: ChatMessage }>;
      if (!response.ok || payload.ok !== true) {
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
      void fetch(`/api/community/channels/${encodeURIComponent(channel.slug)}/typing`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ is_typing: false })
      }).catch(() => undefined);
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
    if (!trimmed || trimmed.length > 1000) return;
    const clientMessageId = `web:${crypto.randomUUID()}`;
    const nextMessage = pendingMessage(activeChannel.id, currentUserId, trimmed, clientMessageId, replyTo);
    shouldStickLatestRef.current = true;
    setError(null);
    setBody("");
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
    if (!trimmed || trimmed === editTarget.body || trimmed.length > 1000) return;

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
      setError(dmError instanceof Error ? dmError.message : "DM request could not be sent.");
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

  return (
    <section className={[
      "min-w-0 overflow-hidden bg-white shadow-tight",
      fullLayout ? "fixed inset-x-0 top-0 grid h-[100dvh] grid-rows-[auto_minmax(0,1fr)] border-0" : "rounded-lg border border-line"
    ].join(" ")} style={fullLayout && chatViewport ? { height: `${chatViewport.height}px`, top: `${chatViewport.top}px` } : undefined}>
      <header className={[
        "flex min-w-0 items-center gap-3 border-b p-3 sm:p-4",
        fullLayout ? "border-white/10 bg-[#172331] text-white" : "border-line bg-white"
      ].join(" ")}>
        <button aria-label="Go back" className={fullLayout ? "grid h-10 w-10 shrink-0 place-items-center rounded-full text-2xl text-white md:hidden" : "hidden"} onClick={handleBack} type="button">‹</button>
        <button aria-label="Open channel details" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-black text-action shadow-tight" onClick={() => setShowChannelInfo(true)} type="button">
          {channelInitials(activeChannel)}
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={() => setShowChannelInfo(true)} type="button">
          <h2 className={["truncate text-lg font-black leading-tight", fullLayout ? "text-white" : "text-ink"].join(" ")}>{channelTitle(activeChannel)}</h2>
          <p className={["mt-0.5 truncate text-sm leading-5", fullLayout ? "text-slate-300" : "text-muted"].join(" ")}>
            {presence.online_count} online{channelList.length ? ` · ${channelList.length} channels` : ""}
          </p>
        </button>
        <div className={["hidden min-h-9 w-fit items-center gap-2 rounded-full border px-3 text-xs font-black sm:inline-flex", fullLayout ? "border-white/10 bg-white/5 text-slate-300" : "border-line bg-white text-muted"].join(" ")}>
          <span className={streamStatus === "live" ? "text-success" : "text-warning"}>{statusLabel}</span>
        </div>
        <button aria-label="Search channel messages" className={["grid h-9 min-w-9 shrink-0 place-items-center rounded-full border px-2 text-xs font-black", fullLayout ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-surfaceHigh"].join(" ")} onClick={() => setShowSearch(true)} title="Search messages" type="button">Search</button>
        <button aria-label="Open channel details" className={["grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-black", fullLayout ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-surfaceHigh"].join(" ")} onClick={() => setShowChannelInfo(true)} title="Channel details" type="button">i</button>
      </header>

      {showChannelInfo ? (
        <div aria-label={`${channelTitle(activeChannel)} details`} aria-modal="true" className="fixed inset-0 z-50 grid max-w-[100vw] overflow-x-hidden bg-black/60 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:place-items-center sm:p-4" role="dialog">
          <section className="grid h-full min-h-0 w-full min-w-0 max-w-full grid-rows-[auto_auto_1fr] overflow-hidden bg-[#172331] text-white shadow-panel sm:h-[min(48rem,92vh)] sm:max-w-2xl sm:rounded-lg sm:border sm:border-white/10">
            <header className="flex min-w-0 items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:gap-3 sm:p-4">
              <button aria-label="Exit chat" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black text-white hover:bg-white/10" onClick={exitChat} title="Back to home" type="button">X</button>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-black text-action shadow-tight sm:h-14 sm:w-14 sm:text-base">{channelInitials(activeChannel)}</span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-black text-white sm:text-xl">{channelTitle(activeChannel)}</h2>
                <p className="mt-0.5 truncate text-xs font-bold text-slate-300 sm:mt-1 sm:text-sm">{presence.online_count} online / {userDirectory.length} active or recent</p>
              </div>
            </header>

            <div className="grid grid-cols-3 border-b border-white/10 px-3">
              {(["members", "channels", "pins"] as const).map((tab) => (
                <button className={["min-h-11 min-w-0 truncate border-b-2 px-1 text-xs font-black capitalize sm:min-h-12 sm:px-2 sm:text-sm", infoTab === tab ? "border-sky-400 text-sky-300" : "border-transparent text-slate-400 hover:text-white"].join(" ")} key={tab} onClick={() => setInfoTab(tab)} type="button">
                  {tab}{tab === "channels" ? ` ${channelList.length}` : tab === "pins" && pinnedMessages.length ? ` ${pinnedMessages.length}` : ""}
                </button>
              ))}
            </div>

            <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
              {infoTab === "members" ? (
                <div className="grid gap-2">
                  <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Active and recent members</p>
                  {userDirectory.length ? userDirectory.map((user) => (
                    <div className="flex min-w-0 items-center gap-3 rounded-md bg-white/5 p-2.5 sm:p-3" key={user.user_id}>
                      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-black text-white sm:h-11 sm:w-11">
                        {initials(user.label)}
                        {user.is_online ? <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#172331] bg-success" /> : null}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">{user.label}</p>
                        <p className="truncate text-xs font-bold text-slate-400">{user.username ? `@${user.username} / ` : ""}{user.is_online ? "online" : "recent"}</p>
                      </div>
                    </div>
                  )) : <p className="rounded-md border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-400">Members appear here as they become active in this channel.</p>}
                </div>
              ) : null}

              {infoTab === "channels" ? (
                <div className="grid gap-2">
                  <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Your accessible channels</p>
                  {channelList.map((item) => (
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

              {infoTab === "pins" ? (
                <div className="grid gap-2">
                  <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Pinned messages</p>
                  {pinnedMessages.length ? pinnedMessages.map((pin) => (
                    <article className="rounded-md border border-white/10 bg-white/5 p-3" key={pin.id}>
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-black text-sky-300">{pin.sender_label}</p>
                        {canManageAnyPin || pin.pinned_by_user_id === currentUserId || pin.sender_user_id === currentUserId ? (
                          <button className="shrink-0 rounded-sm px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60" disabled={unpinningIds.has(pin.message_id)} onClick={() => void unpinMessage(pin.message_id)} type="button">{unpinningIds.has(pin.message_id) ? "Unpinning..." : "Unpin"}</button>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white">{pin.body}</p>
                      <p className="mt-2 text-xs font-bold text-slate-400">{pinExpiryLabel(pin.expires_at)}</p>
                    </article>
                  )) : <p className="rounded-md border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-400">No messages are pinned in this channel yet.</p>}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {showSearch ? (
        <div aria-label={`Search ${channelTitle(activeChannel)}`} aria-modal="true" className="fixed inset-0 z-[60] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
          <section className="grid max-h-[92svh] w-full max-w-2xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/10 bg-[#172331] text-white shadow-panel">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black">Search {channelTitle(activeChannel)}</h2>
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
            <textarea autoFocus className="mt-4 min-h-28 w-full resize-y rounded-md border border-white/10 bg-[#223447] p-3 text-base leading-6 text-white outline-none focus:border-sky-400" disabled={isEditing} maxLength={1000} onChange={(event) => setEditBody(event.target.value)} value={editBody} />
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

      <div className={[
        "grid",
        fullLayout ? "min-h-0 overflow-hidden md:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_16rem]" : "min-h-[34rem] lg:grid-cols-[20rem_minmax(0,1fr)]"
      ].join(" ")}>
        <aside className={[
          "border-line bg-white",
          fullLayout ? "hidden min-h-0 overflow-hidden border-r md:block" : "border-b lg:border-b-0 lg:border-r"
        ].join(" ")}>
          <div className={[
            "overflow-y-auto p-3",
            fullLayout ? "max-h-64 lg:h-full lg:max-h-none" : "max-h-72 lg:max-h-[62vh]"
          ].join(" ")}>
            <form className="mb-3 grid gap-2 rounded-md border border-line bg-surface p-3" onSubmit={createDmRequest}>
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">DM Request</p>
              <input
                className="min-h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                onChange={(event) => setDmUsername(event.target.value)}
                placeholder="username"
                value={dmUsername}
              />
              <input
                className="min-h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                maxLength={500}
                onChange={(event) => setDmIntro(event.target.value)}
                placeholder="intro message"
                value={dmIntro}
              />
              <button className="min-h-10 rounded-md bg-action px-3 text-sm font-black text-navy-950 shadow-action" type="submit">Request DM</button>
            </form>
            {dmRequests.filter((request) => request.status === "pending" && request.recipient_user_id === currentUserId).length ? (
              <div className="mb-3 grid gap-2 rounded-md border border-line bg-white p-3">
                <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-muted">Pending DMs</p>
                {dmRequests.filter((request) => request.status === "pending" && request.recipient_user_id === currentUserId).slice(0, 3).map((request) => (
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
            <div className="grid gap-2">
              {channelList.map((item) => {
                const active = item.id === activeChannel.id;
                return (
                  <button
                    className={[
                      "grid min-h-16 min-w-0 gap-1 rounded-md border px-3 py-2 text-left transition",
                      active ? "border-cyan bg-cyanSoft" : "border-line bg-white hover:bg-surfaceHigh"
                    ].join(" ")}
                    key={item.id}
                    onClick={() => openChannel(item)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <strong className="flex min-w-0 items-center gap-2 truncate text-sm font-black text-ink"><span className="grid h-7 min-w-9 shrink-0 place-items-center rounded-sm bg-navy-900 px-1 text-[0.62rem] text-action">{channelInitials(item)}</span><span className="truncate">{channelTitle(item)}</span></strong>
                      {(item.unread_count ?? 0) > 0 ? (
                        <span className="rounded-md bg-danger px-2 py-0.5 text-[0.65rem] font-black text-white">{item.unread_count}</span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs font-bold text-muted">{channelTypeLabel(item)} - {item.online_count ?? 0} online - {channelPreview(item)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-[#132333] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06)_0,rgba(255,255,255,0)_22rem)]">
          <div className={[
            "min-h-0 overflow-y-auto p-3 sm:p-4",
            fullLayout ? "max-h-none" : "max-h-[58vh]"
          ].join(" ")} onScroll={(event) => {
            const viewport = event.currentTarget;
            const nearLatest = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 120;
            shouldStickLatestRef.current = nearLatest;
            setShowJumpLatest(!nearLatest);
          }} ref={messageViewportRef}>
            <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-white/10 bg-[#203244]/90 px-3 py-2 text-xs font-bold text-slate-300">
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
            {pinnedMessages.length ? (
              <div className="sticky top-0 z-10 mb-3 grid gap-1 rounded-xl border border-white/10 bg-[#223447]/95 p-3 shadow-tight">
                <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-sky-300">Pinned Message</p>
                {pinnedMessages.map((pin) => (
                  <div className="grid gap-1 rounded-md bg-white/5 p-2" key={pin.id}>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-black text-white">{pin.sender_label}: {pin.body}</p>
                      {canManageAnyPin || pin.pinned_by_user_id === currentUserId || pin.sender_user_id === currentUserId ? (
                        <button className="min-w-20 shrink-0 rounded-sm px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60" disabled={unpinningIds.has(pin.message_id)} onClick={() => void unpinMessage(pin.message_id)} type="button">{unpinningIds.has(pin.message_id) ? "Unpinning..." : "Unpin"}</button>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-400">{pinExpiryLabel(pin.expires_at)}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {isLoadingChannel ? (
              <div className="grid h-full min-h-[18rem] place-items-center rounded-md border border-dashed border-line bg-white p-6 text-center">
                <p className="text-sm font-black text-muted">Loading channel...</p>
              </div>
            ) : messages.length ? (
              <div className="grid gap-2">
                {messages.map((message, index) => {
                  const mine = message.sender_user_id === currentUserId;
                  const system = message.message_kind === "system";
                  const deleted = message.status === "deleted";
                  const isPinned = pinnedMessages.some((pin) => pin.message_id === message.id);
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
                        "group grid max-w-[min(92%,38rem)] gap-1.5 rounded-2xl border px-3 py-2 shadow-tight",
                        deleted ? (mine ? "ml-auto border-dashed border-white/15 bg-[#1d2b38] text-slate-400" : "mr-auto border-dashed border-white/15 bg-[#1d2b38] text-slate-400") : system ? "mx-auto border-action/30 bg-amber-50" : mine ? "ml-auto rounded-br-md border-emerald-300/20 bg-[#d7f9df]" : "mr-auto rounded-bl-md border-white/10 bg-[#26394b] text-white"
                      ].join(" ")}
                      onContextMenu={(event) => { event.preventDefault(); if (!message.client_delivery_state) setActionMessage(message); }}
                      onPointerCancel={clearLongPress}
                      onPointerDown={(event) => { if (!message.client_delivery_state) beginLongPress(message, event.target); }}
                      onPointerLeave={clearLongPress}
                      onPointerUp={clearLongPress}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        {!mine && !system ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-black text-white">{initials(message.sender_label)}</span> : null}
                        <strong className={["break-words text-sm font-black [overflow-wrap:anywhere]", mine || system ? "text-ink" : "text-sky-300"].join(" ")}>{system ? "Skillsroom" : mine ? "You" : message.sender_label}</strong>
                        {!mine && !system ? <span className="text-xs font-bold text-slate-300">{displayHandle(message)}</span> : null}
                        <span className={["font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em]", mine || system ? "text-muted" : "text-slate-400"].join(" ")}>{messageTime(message.created_at)}</span>
                        {message.edited_at && !deleted ? <span className={["text-[0.68rem] font-bold", mine || system ? "text-muted" : "text-slate-400"].join(" ")}>edited</span> : null}
                        {isPinned ? <span className="rounded-sm bg-action/20 px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-ink">Pinned</span> : null}
                        {!message.client_delivery_state ? <button aria-label="Open message actions" className={["grid h-7 w-7 place-items-center rounded-full text-base font-black", mine && !deleted ? "text-muted hover:bg-white" : "text-slate-300 hover:bg-white/10"].join(" ")} onClick={() => setActionMessage(message)} title="Message actions" type="button">...</button> : null}
                        {!deleted && !message.client_delivery_state ? <span className="flex flex-wrap gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                          <button
                            className={["rounded-full px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em]", mine ? "text-muted hover:bg-white" : "text-slate-300 hover:bg-white/10"].join(" ")}
                            onClick={() => setReplyTo(message)}
                            type="button"
                          >
                            ↩
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
                      <p className={["mt-1 whitespace-pre-wrap break-words text-[0.98rem] leading-6 [overflow-wrap:anywhere]", deleted ? "italic text-slate-400" : mine || system ? "text-ink" : "text-white"].join(" ")}>{deleted ? "This message was deleted." : renderMessageBody(message.body)}</p>
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
              <div className="grid h-full min-h-[18rem] place-items-center rounded-md border border-dashed border-line bg-white p-6 text-center">
                <div>
                  <h3 className="text-lg font-black text-ink">No messages yet</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted">Start this channel with a clean, public-safe message.</p>
                </div>
              </div>
            )}
            {showJumpLatest || isContextView ? <button className="sticky bottom-2 ml-auto mt-3 block min-h-10 rounded-full bg-sky-500 px-4 text-xs font-black text-white shadow-panel hover:bg-sky-400" onClick={() => void jumpToLatest()} type="button">Jump to latest</button> : null}
          </div>

          <form className="min-w-0 border-t border-white/10 bg-[#172331] px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:p-3" onSubmit={sendMessage}>
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
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <label className="grid min-w-0 gap-1">
                <span className="sr-only">Message</span>
                <textarea
                  className="min-h-10 w-full min-w-0 max-h-28 resize-none overflow-y-hidden rounded-2xl border border-white/10 bg-[#223447] px-3 py-2 text-base leading-6 text-white outline-none placeholder:text-slate-400 focus:border-sky-400"
                  maxLength={1000}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={`Message ${channelTitle(activeChannel)}`}
                  ref={composerRef}
                  rows={1}
                  value={body}
                />
              </label>
              <button
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-lg font-black text-white shadow-action hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400 disabled:shadow-none sm:h-12 sm:w-12 sm:text-xl"
                disabled={!canSend}
                type="submit"
              >
                {isSending ? "…" : "➤"}
              </button>
            </div>
            <div className="mt-1 hidden flex-wrap items-center justify-between gap-2 px-2 text-xs font-bold text-slate-400 sm:flex">
              <span>{channelTypeLabel(activeChannel)} · {activeChannel.visibility}</span>
              <span className={charactersLeft < 80 ? "text-warning" : ""}>{charactersLeft}</span>
            </div>
          </form>
        </div>
        {fullLayout ? (
          <aside className="hidden min-h-0 overflow-y-auto border-l border-line bg-white lg:block">
            <div className="grid gap-4 p-4">
              <section>
                <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Active now</p>
                <div className="mt-3 grid gap-2">
                  {userDirectory.length ? userDirectory.slice(0, 18).map((user) => (
                    <div className="flex min-w-0 items-center gap-2 rounded-md bg-surfaceHigh px-2 py-2" key={user.user_id}>
                      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-black text-white">
                        {initials(user.label)}
                        {user.is_online ? <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-success" /> : null}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-ink">{user.label}</p>
                        <p className="truncate text-xs font-bold text-muted">{user.username ? `@${user.username}` : user.is_online ? "online" : "recent"}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="rounded-md border border-dashed border-line p-3 text-sm font-bold text-muted">Active players will appear here.</p>
                  )}
                </div>
              </section>
              <section className="rounded-md border border-line bg-surface p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Mentions</p>
                <p className="mt-2 text-sm leading-6 text-muted">Type @ and choose an active username when available.</p>
              </section>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
