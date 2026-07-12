"use client";

import { useCallback, useMemo, useReducer } from "react";
import type { ChatChannel, ChatMessage, ChatPresenceSummary } from "@/lib/match-room-api";
import { mergeMessage, preserveLocalAttachmentPreviews } from "./chat-state";

type ChatStoreState = {
  channelSlugs: string[];
  channelsBySlug: Record<string, ChatChannel>;
  messageIdsByChannel: Record<string, string[]>;
  messagesById: Record<string, ChatMessage>;
  presenceByChannel: Record<string, ChatPresenceSummary>;
};

type ChatStoreAction =
  | { type: "patch_channel"; channel: ChatChannel }
  | { type: "patch_channel_by_slug"; slug: string; patch: Partial<ChatChannel> }
  | { type: "replace_channel_messages"; slug: string; messages: ChatMessage[] }
  | { type: "upsert_message"; slug: string; message: ChatMessage; limit?: number }
  | { type: "update_message"; slug: string; message: ChatMessage }
  | { type: "patch_message"; slug: string; messageId: string; patch: Partial<ChatMessage> }
  | { type: "filter_channel_messages"; slug: string; predicate: (message: ChatMessage) => boolean }
  | { type: "set_channel_presence"; slug: string; presence: ChatPresenceSummary }
  | { type: "patch_channel_presence"; slug: string; patch: Partial<ChatPresenceSummary> };

function normalizeChannels(channels: ChatChannel[]) {
  const channelSlugs: string[] = [];
  const channelsBySlug: Record<string, ChatChannel> = {};
  for (const channel of channels) {
    if (!channelsBySlug[channel.slug]) channelSlugs.push(channel.slug);
    channelsBySlug[channel.slug] = channel;
  }
  return { channelSlugs, channelsBySlug };
}

function normalizeMessages(messagesByChannel: Record<string, ChatMessage[]>) {
  const messageIdsByChannel: Record<string, string[]> = {};
  const messagesById: Record<string, ChatMessage> = {};
  for (const [slug, messages] of Object.entries(messagesByChannel)) {
    messageIdsByChannel[slug] = messages.map((message) => {
      messagesById[message.id] = message;
      return message.id;
    });
  }
  return { messageIdsByChannel, messagesById };
}

function messagesForChannel(state: ChatStoreState, slug: string) {
  return (state.messageIdsByChannel[slug] ?? [])
    .map((id) => state.messagesById[id])
    .filter((message): message is ChatMessage => Boolean(message));
}

function replaceChannelMessages(state: ChatStoreState, slug: string, messages: ChatMessage[]): ChatStoreState {
  const nextMessagesById = { ...state.messagesById };
  const nextIds = messages.map((message) => {
    nextMessagesById[message.id] = message;
    return message.id;
  });
  return {
    ...state,
    messagesById: nextMessagesById,
    messageIdsByChannel: { ...state.messageIdsByChannel, [slug]: nextIds }
  };
}

function reducer(state: ChatStoreState, action: ChatStoreAction): ChatStoreState {
  if (action.type === "patch_channel") {
    const exists = Boolean(state.channelsBySlug[action.channel.slug]);
    return {
      ...state,
      channelSlugs: exists ? state.channelSlugs : [action.channel.slug, ...state.channelSlugs],
      channelsBySlug: { ...state.channelsBySlug, [action.channel.slug]: action.channel }
    };
  }
  if (action.type === "patch_channel_by_slug") {
    const current = state.channelsBySlug[action.slug];
    if (!current) return state;
    return {
      ...state,
      channelsBySlug: { ...state.channelsBySlug, [action.slug]: { ...current, ...action.patch } }
    };
  }
  if (action.type === "replace_channel_messages") {
    return replaceChannelMessages(state, action.slug, action.messages);
  }
  if (action.type === "upsert_message") {
    const currentMessages = messagesForChannel(state, action.slug);
    const nextMessages = mergeMessage(currentMessages, action.message);
    const limitedMessages = typeof action.limit === "number" ? nextMessages.slice(-action.limit) : nextMessages;
    return replaceChannelMessages(state, action.slug, limitedMessages);
  }
  if (action.type === "update_message") {
    const previous = state.messagesById[action.message.id];
    const nextMessage = preserveLocalAttachmentPreviews(action.message, previous);
    if (previous === nextMessage) return state;
    return {
      ...state,
      messagesById: { ...state.messagesById, [nextMessage.id]: nextMessage }
    };
  }
  if (action.type === "patch_message") {
    const previous = state.messagesById[action.messageId];
    if (!previous) return state;
    return {
      ...state,
      messagesById: { ...state.messagesById, [action.messageId]: { ...previous, ...action.patch } }
    };
  }
  if (action.type === "filter_channel_messages") {
    const currentMessages = messagesForChannel(state, action.slug);
    return replaceChannelMessages(state, action.slug, currentMessages.filter(action.predicate));
  }
  if (action.type === "set_channel_presence") {
    return {
      ...state,
      presenceByChannel: { ...state.presenceByChannel, [action.slug]: action.presence }
    };
  }
  if (action.type === "patch_channel_presence") {
    return {
      ...state,
      presenceByChannel: {
        ...state.presenceByChannel,
        [action.slug]: { ...state.presenceByChannel[action.slug], ...action.patch } as ChatPresenceSummary
      }
    };
  }
  return state;
}

export function useChatStore({
  channels,
  initialChannelSlug,
  initialMessages,
  initialPresence
}: {
  channels: ChatChannel[];
  initialChannelSlug: string;
  initialMessages: ChatMessage[];
  initialPresence: ChatPresenceSummary;
}) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const normalizedChannels = normalizeChannels(channels);
    const normalizedMessages = normalizeMessages({ [initialChannelSlug]: initialMessages });
    return {
      ...normalizedChannels,
      ...normalizedMessages,
      presenceByChannel: { [initialChannelSlug]: initialPresence }
    };
  });

  const channelList = useMemo(
    () => state.channelSlugs.map((slug) => state.channelsBySlug[slug]).filter((channel): channel is ChatChannel => Boolean(channel)),
    [state.channelSlugs, state.channelsBySlug]
  );

  const messagesByChannel = useMemo(() => {
    const snapshot: Record<string, ChatMessage[]> = {};
    for (const slug of Object.keys(state.messageIdsByChannel)) {
      snapshot[slug] = messagesForChannel(state, slug);
    }
    return snapshot;
  }, [state]);

  const patchChannel = useCallback((channel: ChatChannel) => dispatch({ type: "patch_channel", channel }), []);
  const patchChannelBySlug = useCallback((slug: string, patch: Partial<ChatChannel>) => dispatch({ type: "patch_channel_by_slug", slug, patch }), []);
  const replaceChannelMessages = useCallback((slug: string, messages: ChatMessage[]) => dispatch({ type: "replace_channel_messages", slug, messages }), []);
  const upsertMessage = useCallback((slug: string, message: ChatMessage, limit?: number) => dispatch({ type: "upsert_message", slug, message, limit }), []);
  const updateMessage = useCallback((slug: string, message: ChatMessage) => dispatch({ type: "update_message", slug, message }), []);
  const patchMessage = useCallback((slug: string, messageId: string, patch: Partial<ChatMessage>) => dispatch({ type: "patch_message", slug, messageId, patch }), []);
  const filterChannelMessages = useCallback((slug: string, predicate: (message: ChatMessage) => boolean) => dispatch({ type: "filter_channel_messages", slug, predicate }), []);
  const setChannelPresence = useCallback((slug: string, presence: ChatPresenceSummary) => dispatch({ type: "set_channel_presence", slug, presence }), []);
  const patchChannelPresence = useCallback((slug: string, patch: Partial<ChatPresenceSummary>) => dispatch({ type: "patch_channel_presence", slug, patch }), []);

  return {
    channelList,
    channelsBySlug: state.channelsBySlug,
    messagesByChannel,
    messagesById: state.messagesById,
    messageIdsByChannel: state.messageIdsByChannel,
    presenceByChannel: state.presenceByChannel,
    patchChannel,
    patchChannelBySlug,
    replaceChannelMessages,
    upsertMessage,
    updateMessage,
    patchMessage,
    filterChannelMessages,
    setChannelPresence,
    patchChannelPresence
  };
}
