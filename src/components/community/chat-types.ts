import type {
  ChatAttachment,
  ChatChannel,
  ChatDmRequest,
  ChatMessage,
  ChatMessagePageInfo,
  ChatPinnedMessage,
  ChatPresenceSummary
} from "@/lib/match-room-api";

export type GlobalLobbyClientProps = {
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

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string; details?: { retry_after_seconds?: number; next_allowed_at?: string } } };

export type RealtimeEvent = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
};

export type PendingAttachment = {
  localId: string;
  file: File;
  previewUrl?: string;
  attachment?: ChatAttachment;
  state: "uploading" | "ready" | "failed";
  progress: number;
  error?: string;
};

export type MediaPage = {
  attachments: ChatAttachment[];
  page_info: { has_more: boolean; next_before: string | null };
};

export type ChatProfileUser = {
  user_id: string;
  label: string;
  username?: string | null;
  is_online?: boolean;
};

export type ChatHydrationInclude = "attachments" | "poll" | "thread" | "all";
