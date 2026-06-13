"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ChatChannel, ChatDmRequest, ChatMessage, ChatPinnedMessage, ChatPresenceSummary } from "@/lib/match-room-api";

type GlobalLobbyClientProps = {
  channels: ChatChannel[];
  currentUserId: string;
  currentUserRole: string;
  initialChannel: ChatChannel;
  initialMessages: ChatMessage[];
  initialPinnedMessages: ChatPinnedMessage[];
  initialPresence: ChatPresenceSummary;
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
  if (channel.slug === "global_lobby") return "GL";
  const words = channel.title
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !["of", "the", "and"].includes(word.toLowerCase()));
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 4).map((word) => word.charAt(0)).join("").toUpperCase() || "CH";
}

function channelTypeLabel(channel: ChatChannel) {
  if (channel.slug === "global_lobby") return "Lobby";
  if (channel.channel_type === "match_room") return "Room";
  if (channel.channel_type === "tournament") return "Tournament";
  if (channel.channel_type === "game") return "Game";
  if (channel.channel_type === "group") return "Community";
  return "Channel";
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
    created_at: now,
    updated_at: now,
    sender_label: "You"
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

export function GlobalLobbyClient({ channels, currentUserId, currentUserRole, initialChannel, initialMessages, initialPinnedMessages, initialPresence, initialDmRequests, layout = "embedded" }: GlobalLobbyClientProps) {
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
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingChannel, setIsLoadingChannel] = useState(false);
  const [reportingIds, setReportingIds] = useState<Set<string>>(new Set());
  const [streamStatus, setStreamStatus] = useState<"starting" | "live" | "reconnecting">("starting");
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [infoTab, setInfoTab] = useState<"members" | "channels" | "pins">("members");
  const [pinTarget, setPinTarget] = useState<ChatMessage | null>(null);
  const [pinDurationHours, setPinDurationHours] = useState<24 | 168 | 720>(168);
  const [pinClock, setPinClock] = useState(() => Date.now());
  const [isPinning, setIsPinning] = useState(false);
  const [unpinningIds, setUnpinningIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set(initialMessages.map((message) => message.id)));
  const messagesByChannelRef = useRef(messagesByChannel);

  const messages = messagesByChannel[activeChannel.slug] ?? emptyMessages;
  const pinnedMessages = (pinnedByChannel[activeChannel.slug] ?? emptyPinnedMessages)
    .filter((pin) => !pin.expires_at || Date.parse(pin.expires_at) > pinClock);
  const presence = presenceByChannel[activeChannel.slug] ?? emptyPresence;
  const charactersLeft = 1000 - body.length;
  const canSend = body.trim().length > 0 && body.trim().length <= 1000 && !isSending && !isLoadingChannel;
  const canManageAnyPin = ["support", "moderator", "admin", "owner"].includes(currentUserRole);
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

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [activeChannel.slug, messages.length]);

  useEffect(() => {
    if (!pinnedMessages.length) return;
    const timer = window.setInterval(() => setPinClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [pinnedMessages.length]);

  useEffect(() => {
    messagesByChannelRef.current = messagesByChannel;
  }, [messagesByChannel]);

  async function markRead(channel: ChatChannel, nextMessages: ChatMessage[]) {
    const lastMessage = nextMessages.at(-1);
    await fetch(`/api/community/channels/${encodeURIComponent(channel.slug)}/read`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ message_id: lastMessage?.id })
    }).catch(() => undefined);
  }

  async function openChannel(channel: ChatChannel) {
    setActiveChannel(channel);
    setBody("");
    setReplyTo(null);
    setError(null);
    setChannelList((current) => current.map((item) => item.id === channel.id ? { ...item, unread_count: 0 } : item));
    if (messagesByChannel[channel.slug]) return;

    setIsLoadingChannel(true);
    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(channel.slug)}/messages?limit=60`, {
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      const payload = (await response.json()) as ApiEnvelope<{ channel: ChatChannel; messages: ChatMessage[]; pinned_messages: ChatPinnedMessage[]; presence: ChatPresenceSummary }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Channel could not load." : "Channel could not load.");
      }
      payload.data.messages.forEach((message) => seenIdsRef.current.add(message.id));
      setActiveChannel(payload.data.channel);
      setMessagesByChannel((current) => ({ ...current, [payload.data.channel.slug]: payload.data.messages }));
      setPinnedByChannel((current) => ({ ...current, [payload.data.channel.slug]: payload.data.pinned_messages }));
      setPresenceByChannel((current) => ({ ...current, [payload.data.channel.slug]: payload.data.presence }));
      setChannelList((current) => current.map((item) => item.id === payload.data.channel.id ? { ...payload.data.channel, unread_count: 0 } : item));
      await markRead(payload.data.channel, payload.data.messages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Channel could not load.");
    } finally {
      setIsLoadingChannel(false);
    }
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

        if (realtimeEvent.event_type === "chat.message.reaction.changed") {
          const channelSlug = realtimeEvent.payload.channel_slug;
          const message = realtimeEvent.payload.message;
          if (typeof channelSlug !== "string" || !isChatMessage(message)) return;
          setMessagesByChannel((current) => ({
            ...current,
            [channelSlug]: (current[channelSlug] ?? []).map((item) => item.id === message.id ? message : item)
          }));
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

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.replace(/\s+/g, " ").trim();
    if (!trimmed || trimmed.length > 1000) return;

    const clientMessageId = `web:${crypto.randomUUID()}`;
    const replyTarget = replyTo;
    setError(null);
    setIsSending(true);
    setBody("");
    setReplyTo(null);
    setMessagesByChannel((current) => ({
      ...current,
      [activeChannel.slug]: mergeMessage(current[activeChannel.slug] ?? [], pendingMessage(activeChannel.id, currentUserId, trimmed, clientMessageId, replyTarget))
    }));

    try {
      const response = await fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ body: trimmed, client_message_id: clientMessageId, reply_to_message_id: replyTarget?.id })
      });
      const payload = (await response.json()) as ApiEnvelope<{ message: ChatMessage }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Message could not be sent." : "Message could not be sent.");
      }
      seenIdsRef.current.add(payload.data.message.id);
      setMessagesByChannel((current) => ({
        ...current,
        [activeChannel.slug]: mergeMessage(current[activeChannel.slug] ?? [], payload.data.message)
      }));
      setChannelList((current) => current.map((item) => item.id === activeChannel.id ? {
        ...item,
        last_message_body: payload.data.message.body,
        last_message_sender_label: "You",
        last_message_sender_user_id: currentUserId,
        last_message_at: payload.data.message.created_at
      } : item));
      void markRead(activeChannel, [...(messagesByChannelRef.current[activeChannel.slug] ?? []), payload.data.message]);
      void fetch(`/api/community/channels/${encodeURIComponent(activeChannel.slug)}/typing`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ is_typing: false })
      }).catch(() => undefined);
    } catch (sendError) {
      setMessagesByChannel((current) => ({
        ...current,
        [activeChannel.slug]: (current[activeChannel.slug] ?? []).filter((message) => message.client_message_id !== clientMessageId)
      }));
      setBody(trimmed);
      setReplyTo(replyTarget);
      setError(sendError instanceof Error ? sendError.message : "Message could not be sent.");
    } finally {
      setIsSending(false);
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
      fullLayout ? "h-screen border-0" : "rounded-lg border border-line"
    ].join(" ")}>
      <header className={[
        "flex min-w-0 items-center gap-3 border-b p-3 sm:p-4",
        fullLayout ? "border-white/10 bg-[#172331] text-white" : "border-line bg-white"
      ].join(" ")}>
        <button className={fullLayout ? "grid h-10 w-10 shrink-0 place-items-center rounded-full text-2xl text-white md:hidden" : "hidden"} onClick={() => history.back()} type="button">‹</button>
        <button aria-label="Open channel details" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-black text-action shadow-tight" onClick={() => setShowChannelInfo(true)} type="button">
          {channelInitials(activeChannel)}
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={() => setShowChannelInfo(true)} type="button">
          <h2 className={["truncate text-lg font-black leading-tight", fullLayout ? "text-white" : "text-ink"].join(" ")}>{activeChannel.title}</h2>
          <p className={["mt-0.5 truncate text-sm leading-5", fullLayout ? "text-slate-300" : "text-muted"].join(" ")}>
            {presence.online_count} online{channelList.length ? ` · ${channelList.length} channels` : ""}
          </p>
        </button>
        <div className={["hidden min-h-9 w-fit items-center gap-2 rounded-full border px-3 text-xs font-black sm:inline-flex", fullLayout ? "border-white/10 bg-white/5 text-slate-300" : "border-line bg-white text-muted"].join(" ")}>
          <span className={streamStatus === "live" ? "text-success" : "text-warning"}>{statusLabel}</span>
        </div>
        <button aria-label="Open channel details" className={["grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-black", fullLayout ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-surfaceHigh"].join(" ")} onClick={() => setShowChannelInfo(true)} title="Channel details" type="button">i</button>
      </header>

      {showChannelInfo ? (
        <div aria-label={`${activeChannel.title} details`} aria-modal="true" className="fixed inset-0 z-50 grid max-w-[100vw] overflow-x-hidden bg-black/60 sm:place-items-center sm:p-4" role="dialog">
          <section className="grid h-full min-h-0 w-full min-w-0 max-w-full grid-rows-[auto_auto_1fr] overflow-hidden bg-[#172331] text-white shadow-panel sm:h-[min(48rem,92vh)] sm:max-w-2xl sm:rounded-lg sm:border sm:border-white/10">
            <header className="flex min-w-0 items-center gap-2 border-b border-white/10 p-3 sm:gap-3 sm:p-4">
              <button aria-label="Close channel details" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black text-white hover:bg-white/10" onClick={() => setShowChannelInfo(false)} type="button">X</button>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-black text-action shadow-tight sm:h-14 sm:w-14 sm:text-base">{channelInitials(activeChannel)}</span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-black text-white sm:text-xl">{activeChannel.title}</h2>
                <p className="mt-1 truncate text-xs font-bold text-slate-300 sm:text-sm">{presence.online_count} online / {userDirectory.length} active or recent</p>
              </div>
            </header>

            <div className="grid grid-cols-3 border-b border-white/10 px-3">
              {(["members", "channels", "pins"] as const).map((tab) => (
                <button className={["min-h-12 min-w-0 truncate border-b-2 px-1 text-xs font-black capitalize sm:px-2 sm:text-sm", infoTab === tab ? "border-sky-400 text-sky-300" : "border-transparent text-slate-400 hover:text-white"].join(" ")} key={tab} onClick={() => setInfoTab(tab)} type="button">
                  {tab}{tab === "channels" ? ` ${channelList.length}` : tab === "pins" && pinnedMessages.length ? ` ${pinnedMessages.length}` : ""}
                </button>
              ))}
            </div>

            <div className="min-h-0 overflow-y-auto p-4">
              {infoTab === "members" ? (
                <div className="grid gap-2">
                  <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Active and recent members</p>
                  {userDirectory.length ? userDirectory.map((user) => (
                    <div className="flex min-w-0 items-center gap-3 rounded-md bg-white/5 p-3" key={user.user_id}>
                      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-black text-white">
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
                        <span className="block truncate text-sm font-black text-white">{item.title}</span>
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
                      <p className="text-sm font-black text-sky-300">{pin.sender_label}</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white">{pin.body}</p>
                      {pin.reason ? <p className="mt-2 text-xs font-bold text-slate-400">{pin.reason}</p> : null}
                    </article>
                  )) : <p className="rounded-md border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-400">No messages are pinned in this channel yet.</p>}
                </div>
              ) : null}
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

      <div className={[
        "grid min-h-[34rem]",
        fullLayout ? "h-[calc(100%-4.75rem)] md:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_16rem]" : "lg:grid-cols-[20rem_minmax(0,1fr)]"
      ].join(" ")}>
        <aside className={[
          "border-line bg-white",
          fullLayout ? "hidden border-r md:block" : "border-b lg:border-b-0 lg:border-r"
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
                      <strong className="truncate text-sm font-black text-ink"># {item.title}</strong>
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

        <div className="grid min-h-[28rem] grid-rows-[1fr_auto] bg-[#132333] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06)_0,rgba(255,255,255,0)_22rem)]">
          <div className={[
            "min-h-[22rem] overflow-y-auto p-3 sm:p-4",
            fullLayout ? "max-h-none" : "max-h-[58vh]"
          ].join(" ")}>
            <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-white/10 bg-[#203244]/90 px-3 py-2 text-xs font-bold text-slate-300">
              <span>{presence.online_count} online</span>
              {presence.active.slice(0, 5).map((user) => (
                <span className="rounded-sm bg-surfaceHigh px-2 py-1" key={user.user_id}>{user.label}</span>
              ))}
            </div>
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
                    <article
                      className={[
                        "group grid max-w-[min(92%,38rem)] gap-1.5 rounded-2xl border px-3 py-2 shadow-tight",
                        system ? "mx-auto border-action/30 bg-amber-50" : mine ? "ml-auto rounded-br-md border-emerald-300/20 bg-[#d7f9df]" : "mr-auto rounded-bl-md border-white/10 bg-[#26394b] text-white"
                      ].join(" ")}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        {!mine && !system ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-black text-white">{initials(message.sender_label)}</span> : null}
                        <strong className={["break-words text-sm font-black [overflow-wrap:anywhere]", mine || system ? "text-ink" : "text-sky-300"].join(" ")}>{system ? "Skillsroom" : mine ? "You" : message.sender_label}</strong>
                        {!mine && !system ? <span className="text-xs font-bold text-slate-300">{displayHandle(message)}</span> : null}
                        <span className={["font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em]", mine || system ? "text-muted" : "text-slate-400"].join(" ")}>{messageTime(message.created_at)}</span>
                        {isPinned ? <span className="rounded-sm bg-action/20 px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-ink">Pinned</span> : null}
                        <span className="flex flex-wrap gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
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
                        </span>
                        {!mine ? (
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
                          onClick={() => {
                            const target = messages.find((item) => item.id === message.reply_to_message_id);
                            if (target) setReplyTo(target);
                          }}
                          type="button"
                        >
                          <span className={["text-xs font-black", mine ? "text-cyan" : "text-sky-300"].join(" ")}>{message.reply_to_sender_label ?? "Earlier message"}</span>
                          <span className={["max-h-10 overflow-hidden text-xs", mine ? "text-muted" : "text-slate-300"].join(" ")}>{message.reply_to_body ?? "Message unavailable"}</span>
                        </button>
                      ) : null}
                      <p className={["mt-1 whitespace-pre-wrap break-words text-[0.98rem] leading-6 [overflow-wrap:anywhere]", mine || system ? "text-ink" : "text-white"].join(" ")}>{renderMessageBody(message.body)}</p>
                      {message.link_preview?.url && message.link_preview.host ? (
                        <a className={["mt-2 block rounded-md border p-3 text-sm", mine ? "border-line bg-white hover:bg-surfaceHigh" : "border-white/10 bg-white/10 hover:bg-white/15"].join(" ")} href={message.link_preview.url} rel="noreferrer" target="_blank">
                          <span className={["block font-black", mine ? "text-ink" : "text-white"].join(" ")}>{message.link_preview.title ?? message.link_preview.host}</span>
                          <span className={["mt-1 block break-all text-xs font-bold", mine ? "text-muted" : "text-slate-300"].join(" ")}>{message.link_preview.host}</span>
                        </a>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                      </div>
                    </article>
                    </div>
                  );
                })}
                <div ref={scrollRef} />
              </div>
            ) : (
              <div className="grid h-full min-h-[18rem] place-items-center rounded-md border border-dashed border-line bg-white p-6 text-center">
                <div>
                  <h3 className="text-lg font-black text-ink">No messages yet</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted">Start this channel with a clean, public-safe message.</p>
                </div>
              </div>
            )}
          </div>

          <form className="border-t border-white/10 bg-[#172331] p-2 sm:p-3" onSubmit={sendMessage}>
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
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
              <label className="grid gap-1">
                <span className="sr-only">Message</span>
                <textarea
                  className="max-h-32 min-h-12 resize-none rounded-2xl border border-white/10 bg-[#223447] px-4 py-3 text-base leading-6 text-white outline-none placeholder:text-slate-400 focus:border-sky-400"
                  maxLength={1000}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={`Message ${activeChannel.title}`}
                  value={body}
                />
              </label>
              <button
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-500 text-xl font-black text-white shadow-action hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400 disabled:shadow-none"
                disabled={!canSend}
                type="submit"
              >
                {isSending ? "…" : "➤"}
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 px-2 text-xs font-bold text-slate-400">
              <span>{channelTypeLabel(activeChannel)} · {activeChannel.visibility}</span>
              <span className={charactersLeft < 80 ? "text-warning" : ""}>{charactersLeft}</span>
            </div>
          </form>
        </div>
        {fullLayout ? (
          <aside className="hidden border-l border-line bg-white lg:block">
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
