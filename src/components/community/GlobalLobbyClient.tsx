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

const emptyPresence: ChatPresenceSummary = { online_count: 0, active: [], typing: [] };
const reactionOptions = [
  { key: "like", label: "Like" },
  { key: "gg", label: "GG" },
  { key: "fire", label: "Fire" },
  { key: "clap", label: "Clap" },
  { key: "trophy", label: "Win" }
];

export function GlobalLobbyClient({ channels, currentUserId, currentUserRole, initialChannel, initialMessages, initialPinnedMessages, initialPresence, initialDmRequests }: GlobalLobbyClientProps) {
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set(initialMessages.map((message) => message.id)));
  const messagesByChannelRef = useRef(messagesByChannel);

  const messages = messagesByChannel[activeChannel.slug] ?? [];
  const pinnedMessages = pinnedByChannel[activeChannel.slug] ?? [];
  const presence = presenceByChannel[activeChannel.slug] ?? emptyPresence;
  const charactersLeft = 1000 - body.length;
  const canSend = body.trim().length > 0 && body.trim().length <= 1000 && !isSending && !isLoadingChannel;
  const canModerateChat = ["moderator", "admin", "owner"].includes(currentUserRole);

  const statusLabel = useMemo(() => {
    if (streamStatus === "live") return "Live";
    if (streamStatus === "reconnecting") return "Reconnecting";
    return "Connecting";
  }, [streamStatus]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [activeChannel.slug, messages.length]);

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

  async function pinMessage(message: ChatMessage) {
    const reason = window.prompt("Why are you pinning this message?");
    if (reason === null) return;
    setError(null);
    try {
      const response = await fetch(
        `/api/community/channels/${encodeURIComponent(activeChannel.slug)}/messages/${encodeURIComponent(message.id)}/pin`,
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ reason: reason.trim() || undefined })
        }
      );
      const payload = (await response.json()) as ApiEnvelope<{ pinned_messages: ChatPinnedMessage[] }>;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.ok === false ? payload.error?.message ?? "Message could not be pinned." : "Message could not be pinned.");
      }
      setPinnedByChannel((current) => ({ ...current, [activeChannel.slug]: payload.data.pinned_messages }));
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "Message could not be pinned.");
    }
  }

  async function unpinMessage(messageId: string) {
    setError(null);
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
    <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-white shadow-tight">
      <header className="flex min-w-0 flex-col gap-3 border-b border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Community Channels</p>
          <h2 className="mt-1 text-lg font-black leading-tight text-ink">{activeChannel.title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{activeChannel.description ?? "Signed-in Skillsroom players can talk here."}</p>
        </div>
        <div className="inline-flex min-h-9 w-fit items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-black text-muted">
          <span className={streamStatus === "live" ? "text-success" : "text-warning"}>{statusLabel}</span>
          <span>{presence.online_count} online</span>
        </div>
      </header>

      <div className="grid min-h-[34rem] lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="border-b border-line bg-white lg:border-b-0 lg:border-r">
          <div className="max-h-72 overflow-y-auto p-3 lg:max-h-[62vh]">
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

        <div className="grid min-h-[28rem] grid-rows-[1fr_auto]">
          <div className="max-h-[58vh] min-h-[22rem] overflow-y-auto bg-bg p-3 sm:p-4">
            <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-xs font-bold text-muted">
              <span>{presence.online_count} online</span>
              {presence.active.slice(0, 5).map((user) => (
                <span className="rounded-sm bg-surfaceHigh px-2 py-1" key={user.user_id}>{user.label}</span>
              ))}
            </div>
            {pinnedMessages.length ? (
              <div className="mb-3 grid gap-2 rounded-md border border-cyan/30 bg-cyanSoft p-3">
                <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Pinned</p>
                {pinnedMessages.map((pin) => (
                  <div className="grid gap-1 rounded-md bg-white p-2" key={pin.id}>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-black text-ink">{pin.sender_label}: {pin.body}</p>
                      {canModerateChat ? (
                        <button className="shrink-0 rounded-sm px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-muted hover:bg-surfaceHigh" onClick={() => unpinMessage(pin.message_id)} type="button">Unpin</button>
                      ) : null}
                    </div>
                    {pin.reason ? <p className="text-xs text-muted">{pin.reason}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {isLoadingChannel ? (
              <div className="grid h-full min-h-[18rem] place-items-center rounded-md border border-dashed border-line bg-white p-6 text-center">
                <p className="text-sm font-black text-muted">Loading channel...</p>
              </div>
            ) : messages.length ? (
              <div className="grid gap-3">
                {messages.map((message) => {
                  const mine = message.sender_user_id === currentUserId;
                  const system = message.message_kind === "system";
                  return (
                    <article
                      className={[
                        "max-w-[min(92%,42rem)] rounded-md border p-3 shadow-tight",
                        system ? "mx-auto border-action/30 bg-amber-50" : mine ? "ml-auto border-cyan/25 bg-cyanSoft" : "mr-auto border-line bg-white"
                      ].join(" ")}
                      key={message.id}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <strong className="break-words text-sm font-black text-ink [overflow-wrap:anywhere]">{system ? "Skillsroom" : mine ? "You" : message.sender_label}</strong>
                        <span className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted">{messageTime(message.created_at)}</span>
                        {message.pinned_at ? <span className="rounded-sm bg-action/20 px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-ink">Pinned</span> : null}
                        <button
                          className="rounded-sm px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-muted hover:bg-white hover:text-cyan"
                          onClick={() => setReplyTo(message)}
                          type="button"
                        >
                          Reply
                        </button>
                        {canModerateChat ? (
                          <button
                            className="rounded-sm px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-muted hover:bg-white hover:text-cyan"
                            onClick={() => pinMessage(message)}
                            type="button"
                          >
                            Pin
                          </button>
                        ) : null}
                        {!mine ? (
                          <>
                            <button
                              className="rounded-sm px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-muted hover:bg-white hover:text-danger"
                              disabled={reportingIds.has(message.id)}
                              onClick={() => reportMessage(message)}
                              type="button"
                            >
                              {reportingIds.has(message.id) ? "Reporting" : "Report"}
                            </button>
                            <button
                              className="rounded-sm px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-muted hover:bg-white hover:text-danger"
                              onClick={() => reportUser(message)}
                              type="button"
                            >
                              Report user
                            </button>
                            <button
                              className="rounded-sm px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-muted hover:bg-white hover:text-danger"
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
                          className="mt-2 grid w-full gap-1 rounded-md border-l-4 border-cyan bg-white/70 px-3 py-2 text-left"
                          onClick={() => {
                            const target = messages.find((item) => item.id === message.reply_to_message_id);
                            if (target) setReplyTo(target);
                          }}
                          type="button"
                        >
                          <span className="text-xs font-black text-cyan">{message.reply_to_sender_label ?? "Earlier message"}</span>
                          <span className="max-h-10 overflow-hidden text-xs text-muted">{message.reply_to_body ?? "Message unavailable"}</span>
                        </button>
                      ) : null}
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink [overflow-wrap:anywhere]">{renderMessageBody(message.body)}</p>
                      {message.link_preview?.url && message.link_preview.host ? (
                        <a className="mt-3 block rounded-md border border-line bg-white p-3 text-sm hover:bg-surfaceHigh" href={message.link_preview.url} rel="noreferrer" target="_blank">
                          <span className="block font-black text-ink">{message.link_preview.title ?? message.link_preview.host}</span>
                          <span className="mt-1 block break-all text-xs font-bold text-muted">{message.link_preview.host}</span>
                        </a>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {reactionOptions.map((reaction) => {
                          const summary = message.reactions?.find((item) => item.reaction === reaction.key);
                          return (
                            <button
                              className={[
                                "rounded-md border px-2 py-1 text-xs font-black",
                                summary?.reacted_by_me ? "border-cyan bg-cyanSoft text-ink" : "border-line bg-white text-muted hover:bg-surfaceHigh"
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

          <form className="border-t border-line bg-white p-3 sm:p-4" onSubmit={sendMessage}>
            {error ? <p className="mb-3 rounded-md border border-danger bg-red-50 p-3 text-sm font-bold text-danger">{error}</p> : null}
            {presence.typing.filter((user) => user.user_id !== currentUserId).length ? (
              <p className="mb-2 text-xs font-bold text-muted">
                {presence.typing.filter((user) => user.user_id !== currentUserId).map((user) => user.label).slice(0, 3).join(", ")} typing...
              </p>
            ) : null}
            {replyTo ? (
              <div className="mb-3 flex min-w-0 items-start justify-between gap-3 rounded-md border border-cyan/30 bg-cyanSoft p-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-cyan">Replying to {replyTo.sender_user_id === currentUserId ? "you" : replyTo.sender_label}</p>
                  <p className="mt-1 truncate text-sm text-ink">{replyTo.body}</p>
                </div>
                <button className="shrink-0 rounded-md border border-line bg-white px-2 py-1 text-xs font-black text-muted hover:bg-surfaceHigh" onClick={() => setReplyTo(null)} type="button">Cancel</button>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="grid gap-1">
                <span className="sr-only">Message</span>
                <textarea
                  className="min-h-24 resize-y rounded-md border border-line bg-white px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-action"
                  maxLength={1000}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={`Message #${activeChannel.title}`}
                  value={body}
                />
              </label>
              <button
                className="inline-flex min-h-control items-center justify-center rounded-md bg-action px-5 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-muted disabled:shadow-none"
                disabled={!canSend}
                type="submit"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-muted">
              <span>{channelTypeLabel(activeChannel)} - {activeChannel.visibility} - last read {activeChannel.membership_last_read_at ? new Date(activeChannel.membership_last_read_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }) : "now"}</span>
              <span className={charactersLeft < 80 ? "text-warning" : ""}>{charactersLeft} left</span>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
