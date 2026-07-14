import { apiBaseUrl } from "./api";
import { getAccessToken } from "./auth-bridge";

export type MatchRoomStatus =
  | "draft"
  | "open"
  | "awaiting_funding"
  | "funding_review"
  | "funded"
  | "active"
  | "awaiting_results"
  | "under_review"
  | "disputed"
  | "settlement_pending"
  | "completed"
  | "cancelled"
  | "refunded"
  | "voided";

export type MatchRoom = {
  id: string;
  game_id?: string;
  ruleset_id?: string;
  room_code: string;
  status: MatchRoomStatus;
  currency: string;
  entry_amount_minor: number;
  commission_bps: number;
  max_participants: number;
  title: string | null;
  created_by_user_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  participant_count?: number;
};

export type MatchRoomListRow = Pick<
  MatchRoom,
  | "id"
  | "game_id"
  | "ruleset_id"
  | "room_code"
  | "status"
  | "currency"
  | "entry_amount_minor"
  | "commission_bps"
  | "max_participants"
  | "title"
  | "created_by_user_id"
  | "created_at"
  | "updated_at"
  | "expires_at"
> & {
  participant_count: number;
  game_slug: string | null;
  game_name: string | null;
  ruleset_slug: string | null;
  ruleset_title: string | null;
};

export type Game = {
  id: string;
  slug: string;
  name: string;
  platform: string;
  catalog_order: number;
  status: "active" | "paused" | "retired";
  created_at: string;
  updated_at: string;
};

export type MatchRuleset = {
  id: string;
  game_id: string;
  slug: string;
  title: string;
  summary: string;
  rules: Record<string, unknown>;
  evidence_requirements: Record<string, unknown>;
  status: "active" | "paused" | "retired";
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MatchParticipant = {
  id: string;
  match_room_id: string;
  user_id: string;
  slot: "player_a" | "player_b";
  participant_status: "reserved" | "joined" | "left" | "removed";
  funding_status: "not_required" | "pending" | "submitted" | "approved" | "rejected" | "refunded";
  joined_at: string;
  metadata?: Record<string, unknown>;
};

export type ManualFundingSubmissionStatus = "submitted" | "approved" | "rejected" | "cancelled";

export type ManualFundingSubmission = {
  id: string;
  match_room_id: string;
  participant_id: string;
  user_id: string;
  currency: string;
  amount_minor: number;
  transfer_reference: string;
  sender_account_name: string | null;
  sender_bank_name: string | null;
  payout_recipient_name?: string | null;
  payout_bank_name?: string | null;
  payout_account_number?: string | null;
  payout_account_number_masked?: string | null;
  payout_bank_code?: string | null;
  payout_note?: string | null;
  proof_url: string | null;
  proof_note: string | null;
  status: ManualFundingSubmissionStatus;
  submitted_at: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

export type WalletTopupStatus = "submitted" | "approved" | "rejected" | "cancelled";
export type WalletPayoutRequestStatus = "requested" | "approved" | "paid" | "rejected" | "cancelled" | "failed";

export type StreamingProvider = "youtube" | "twitch";
export type StreamingAccountStatus = "connected" | "needs_reauth" | "revoked" | "manual";
export type StreamingLiveStatus = "unknown" | "live" | "offline" | "replay" | "unavailable";

export type StreamingConnectedAccount = {
  id: string;
  user_id: string;
  provider: StreamingProvider;
  provider_account_id: string;
  provider_login: string | null;
  display_name: string;
  channel_url: string;
  avatar_url: string | null;
  status: StreamingAccountStatus;
  scopes: string[];
  token_expires_at: string | null;
  live_status: StreamingLiveStatus;
  live_stream_url: string | null;
  live_embed_url: string | null;
  live_title: string | null;
  last_live_checked_at: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  has_token: boolean;
};

export type TournamentOfficialStreamer = {
  id: string;
  tournament_id: string;
  streaming_account_id: string;
  assigned_by_user_id: string;
  label: string;
  is_primary: boolean;
  status: "active" | "archived";
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WalletAccount = {
  id: string;
  user_id: string;
  currency: string;
  available_balance_minor: number;
  locked_balance_minor: number;
  winnings_balance_minor: number;
  status: "active" | "frozen" | "closed";
  version: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WalletLedgerEntry = {
  id: string;
  transaction_id: string;
  wallet_account_id: string;
  user_id: string;
  bucket: "available" | "locked" | "winnings";
  entry_type: string;
  direction: "credit" | "debit";
  currency: string;
  amount_minor: number;
  balance_after_available_minor: number;
  balance_after_locked_minor: number;
  balance_after_winnings_minor: number;
  source_type: string;
  source_id: string | null;
  idempotency_key: string;
  metadata?: Record<string, unknown>;
  created_by_user_id: string | null;
  created_at: string;
};

export type WalletHold = {
  id: string;
  wallet_account_id: string;
  user_id: string;
  currency: string;
  amount_minor: number;
  status: "active" | "released" | "captured" | "cancelled" | "expired";
  source_type: string;
  source_id: string;
  reason: string;
  created_ledger_transaction_id: string | null;
  release_ledger_transaction_id: string | null;
  capture_ledger_transaction_id: string | null;
  expires_at: string | null;
  released_at: string | null;
  captured_at: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SuspiciousWalletTopupGroup = {
  duplicate_type: "transfer_reference" | "proof_url";
  group_key: string;
  occurrence_count: number;
  user_count: number;
  amount_minor_total: number;
  first_seen_at: string;
  last_seen_at: string;
  sample_topup_ids: string[];
};

export type WalletFinancialTimelineItem = {
  id: string;
  event_type: string;
  source_table: string;
  user_id: string | null;
  currency: string | null;
  amount_minor: number;
  status: string | null;
  detail: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
};

export type WalletTopup = {
  id: string;
  wallet_account_id: string | null;
  user_id: string;
  currency: string;
  amount_minor: number;
  collection_bank_name: string;
  collection_account_number: string;
  collection_account_name: string;
  transfer_reference: string | null;
  sender_account_name: string | null;
  sender_bank_name: string | null;
  proof_url: string;
  proof_note: string | null;
  status: WalletTopupStatus;
  submitted_at: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  wallet_ledger_transaction_id: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WalletPayoutRequest = {
  id: string;
  wallet_account_id: string;
  user_id: string;
  currency: string;
  amount_minor: number;
  status: WalletPayoutRequestStatus;
  payout_recipient_name: string;
  payout_bank_name: string;
  payout_account_number?: string;
  payout_account_number_masked: string;
  payout_bank_code: string | null;
  payout_note: string | null;
  requested_ledger_transaction_id: string | null;
  paid_ledger_transaction_id: string | null;
  requested_at: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WalletOverview = {
  account: WalletAccount;
  ledger_entries?: WalletLedgerEntry[];
  topups?: WalletTopup[];
  payout_requests?: WalletPayoutRequest[];
  pending_topups?: {
    pending_count: number;
    pending_amount_minor: number;
  };
  pending_payouts?: {
    pending_count: number;
    pending_amount_minor: number;
  };
};

export type PlayerHomeRoomPreview = Pick<
  MatchRoom,
  | "id"
  | "game_id"
  | "ruleset_id"
  | "room_code"
  | "status"
  | "currency"
  | "entry_amount_minor"
  | "commission_bps"
  | "max_participants"
  | "title"
  | "created_by_user_id"
  | "created_at"
  | "updated_at"
  | "expires_at"
> & {
  participant_count: number;
  game_slug: string | null;
  game_name: string | null;
  ruleset_slug: string | null;
  ruleset_title: string | null;
};

export type PlayerHomeSummary = {
  room_status_counts: Partial<Record<MatchRoomStatus, number>>;
  active_room_previews: PlayerHomeRoomPreview[];
  unread_notification_count: number;
  wallet_mini_balance: {
    currency: string;
    available_balance_minor: number;
    locked_balance_minor: number;
    winnings_balance_minor: number;
    status: WalletAccount["status"] | null;
  };
  active_tournament_preview_count: number;
  community_highlights_preview: CommunityTournamentHighlightCard[];
};

export type AdminWalletDashboard = {
  pending_topups: WalletTopup[];
  suspicious_duplicates: SuspiciousWalletTopupGroup[];
  active_holds: WalletHold[];
  payout_requests: WalletPayoutRequest[];
  recent_ledger_entries: WalletLedgerEntry[];
  room_financial_timeline: WalletFinancialTimelineItem[];
  tournament_financial_timeline: WalletFinancialTimelineItem[];
  guardrails: string[];
};

export type LedgerEntry = {
  id: string;
  transaction_id: string;
  match_room_id: string | null;
  participant_id: string | null;
  user_id: string | null;
  entry_type: string;
  direction: "debit" | "credit";
  account_type: string;
  currency: string;
  amount_minor: number;
  source_type: string;
  source_id: string | null;
  created_at: string;
};

export type RoomFundingOverview = {
  room: MatchRoom;
  participants: MatchParticipant[];
  submissions: ManualFundingSubmission[];
  ledger_entries: LedgerEntry[];
};

export type EvidenceItemType = "screenshot" | "video" | "link" | "note";
export type ResultClaimStatus =
  | "submitted"
  | "opponent_agreed"
  | "opponent_disputed"
  | "admin_approved"
  | "admin_rejected"
  | "withdrawn";
export type ResultReviewDecision = "approve_claim" | "reject_claim" | "mark_disputed" | "void_match";
export type SettlementStatus = "reserved" | "payout_pending" | "completed" | "cancelled";
export type PayoutStatus = "queued" | "completed" | "failed" | "cancelled";
export type RefundStatus = "queued" | "completed" | "failed" | "cancelled";

export type MatchResultClaim = {
  id: string;
  match_room_id: string;
  claimant_participant_id: string;
  claimant_user_id: string;
  claimed_winner_participant_id: string;
  claimed_winner_user_id: string;
  status: ResultClaimStatus;
  score_summary: string | null;
  note: string | null;
  submitted_at: string;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
};

export type MatchEvidenceItem = {
  id: string;
  match_room_id: string;
  result_claim_id: string | null;
  submitted_by_user_id: string;
  participant_id: string | null;
  evidence_type: EvidenceItemType;
  uri: string | null;
  title: string;
  notes: string | null;
  created_at: string;
};

export type MatchResultResponse = {
  id: string;
  result_claim_id: string;
  responder_participant_id: string;
  responder_user_id: string;
  response: "agree" | "dispute";
  note: string | null;
  created_at: string;
};

export type MatchResultReview = {
  id: string;
  result_claim_id: string;
  decision: ResultReviewDecision;
  winner_participant_id: string | null;
  actor_user_id: string;
  note: string | null;
  created_at: string;
};

export type RoomResultOverview = {
  room: MatchRoom;
  participants: MatchParticipant[];
  claims: MatchResultClaim[];
  evidence_items: MatchEvidenceItem[];
  responses: MatchResultResponse[];
  reviews: MatchResultReview[];
};

export type MatchSettlement = {
  id: string;
  match_room_id: string;
  result_claim_id: string;
  winner_participant_id: string;
  winner_user_id: string;
  currency: string;
  gross_pool_minor: number;
  commission_bps: number;
  commission_minor: number;
  payout_minor: number;
  status: SettlementStatus;
  reserved_by_user_id: string;
  reserved_at: string;
  completed_by_user_id: string | null;
  completed_at: string | null;
  notes: string | null;
  room_code?: string | null;
  room_title?: string | null;
  winner_username?: string | null;
  winner_display_name?: string | null;
  winner_primary_game_handle?: string | null;
  winner_primary_game_external_uid?: string | null;
};

export type MatchPayout = {
  id: string;
  settlement_id: string;
  match_room_id: string;
  participant_id: string;
  user_id: string;
  currency: string;
  amount_minor: number;
  status: PayoutStatus;
  queued_by_user_id: string;
  completed_by_user_id: string | null;
  completed_at: string | null;
  payout_reference: string | null;
  completion_proof_url: string | null;
  failure_note?: string | null;
  recipient_name: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_number_masked: string | null;
  bank_code: string | null;
  payout_note: string | null;
  instruction_status: "ready" | "missing";
  created_at: string;
  updated_at: string;
  room_code?: string | null;
  room_title?: string | null;
  username?: string | null;
  display_name?: string | null;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
  settlement_status?: SettlementStatus | null;
};

export type MatchRefund = {
  id: string;
  match_room_id: string;
  participant_id: string;
  user_id: string;
  currency: string;
  amount_minor: number;
  status: RefundStatus;
  reason: string;
  queued_by_user_id: string;
  completed_by_user_id: string | null;
  completed_at: string | null;
  refund_reference: string | null;
  completion_proof_url: string | null;
  failure_note?: string | null;
  recipient_name: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_number_masked: string | null;
  bank_code: string | null;
  payout_note: string | null;
  instruction_status: "ready" | "missing";
  created_at: string;
  updated_at: string;
  room_code?: string | null;
  room_title?: string | null;
  username?: string | null;
  display_name?: string | null;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
};

export type UserRiskFlag = {
  id: string;
  user_id: string;
  flag_type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "reviewing" | "resolved" | "dismissed";
  summary: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PlayerProfile = {
  user_id: string;
  username: string;
  username_normalized: string;
  display_name: string | null;
  region: string;
  city: string | null;
  campus: string | null;
  timezone: string;
  bio: string | null;
  avatar_url: string | null;
  visibility: "private" | "room_participants" | "public";
  age_confirmed_at: string | null;
  profile_completed_at: string | null;
  reputation_score: number;
  completed_matches: number;
  wins: number;
  losses: number;
  disputes_opened: number;
  disputes_lost: number;
  no_shows: number;
  created_at: string;
  updated_at: string;
};

export type PlayerPayoutProfile = {
  user_id: string;
  recipient_name: string;
  bank_name: string;
  account_number: string;
  account_number_masked: string;
  bank_code: string | null;
  payout_note: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type UserGameAccount = {
  id: string;
  user_id: string;
  game_id: string;
  handle: string;
  handle_normalized: string;
  external_uid: string | null;
  platform: string;
  region: string;
  status: "pending" | "verified" | "rejected" | "disabled";
  is_primary: boolean;
  verification_notes: string | null;
  verified_by_user_id: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileMe = {
  user: {
    id: string;
    email?: string;
    role: "player" | "support" | "moderator" | "admin" | "owner";
    status: "active" | "locked" | "disabled";
  };
  profile: PlayerProfile | null;
  payout_profile: PlayerPayoutProfile | null;
  game_accounts: UserGameAccount[];
  risk_flags: UserRiskFlag[];
  payout_history: MatchPayout[];
  refund_history: MatchRefund[];
  completion: {
    complete: boolean;
    missing: string[];
  };
};

export type TeamRole = "player" | "support" | "moderator" | "admin" | "owner";

export type AdminTeamMember = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  profile_display_name: string | null;
  user_role: TeamRole;
  user_status: "active" | "locked" | "disabled";
  team_member_id: string | null;
  team_role: TeamRole | null;
  team_status: "invited" | "active" | "suspended" | "removed" | null;
  is_platform_owner: boolean;
  ownership_percentage: string | null;
  invited_by_user_id: string | null;
  activated_at: string | null;
  suspended_at: string | null;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
  team_updated_at: string | null;
};

export type PlayerTrustSummary = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  reputation_score: number;
  completed_matches: number;
  wins: number;
  losses: number;
  disputes_opened: number;
  disputes_lost: number;
  no_shows: number;
  profile_complete: boolean;
  primary_game_handle: string | null;
  primary_game_external_uid: string | null;
  primary_game_status: UserGameAccount["status"] | null;
  moderation_status: "clear" | "watchlisted" | "restricted" | "suspended" | "banned" | "under_review";
  open_risk_flags?: number;
  trust_level: "ready" | "review" | "blocked" | "incomplete";
};

export type AdminGameAccount = UserGameAccount & {
  username: string | null;
  display_name: string | null;
  user_email: string | null;
};

export type ModerationAction = {
  id: string;
  target_user_id: string | null;
  match_room_id: string | null;
  action_type: "note" | "warn" | "restrict" | "suspend" | "ban" | "release_hold" | "room_hold";
  status: "active" | "expired" | "reversed";
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  created_by_user_id: string;
  created_at: string;
};

export type RoomModerationHold = {
  id: string;
  match_room_id: string;
  status: "active" | "released" | "expired";
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
  created_by_user_id: string;
  created_at: string;
};

export type RiskDashboard = {
  risk_flags: Array<{ status: string; severity: string; count: string }>;
  room_holds: Array<{ status: string; count: string }>;
  moderation_actions: Array<{ action_type: string; count: string }>;
  users: Array<{ moderation_status: string; count: string }>;
};

export type ChatPerformanceMetricName =
  | "message_list_latency"
  | "send_latency"
  | "search_latency"
  | "thread_latency"
  | "media_latency"
  | "reaction_latency";

export type ChatPerformanceMetricSnapshot = {
  sample_count: number;
  failed_count: number;
  p50_ms: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
  max_ms: number | null;
};

export type ChatPerformanceMetrics = {
  latency: Partial<Record<ChatPerformanceMetricName, ChatPerformanceMetricSnapshot>>;
  http: {
    total_requests: number;
    failed_requests: number;
    failure_rate: number;
    status_counts: Record<string, number>;
    routes: Record<string, { total: number; failed: number }>;
    recent_failures: Array<{ method: string; route: string; status: number; duration_ms: number; at: string }>;
  };
  sse: {
    active_clients: number;
    opened_total: number;
    closed_total: number;
  };
  db_pool: {
    total_count: number;
    idle_count: number;
    waiting_count: number;
  };
  health: {
    status: "healthy" | "watch";
  };
  sampled_at: string;
};

export type UserNotification = {
  id: string;
  user_id: string;
  actor_user_id: string | null;
  status: "unread" | "read" | "archived";
  title: string;
  body: string;
  action_url: string | null;
  notification_type: string;
  match_room_id: string | null;
  created_at: string;
};

export type NotificationPreference = {
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  room_invites_enabled: boolean;
  match_updates_enabled: boolean;
  marketing_enabled: boolean;
};

export type RoomInvite = {
  id: string;
  match_room_id: string;
  inviter_user_id: string;
  invitee_user_id: string;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  message: string | null;
  expires_at: string;
  created_at: string;
  room_code?: string;
  room_title?: string | null;
  currency?: string;
  entry_amount_minor?: number;
  inviter_username?: string | null;
  inviter_display_name?: string | null;
};

export type ActivityFeedItem = {
  id: string;
  actor_user_id: string | null;
  subject_user_id: string | null;
  match_room_id: string | null;
  event_type: string;
  title: string;
  body: string;
  created_at: string;
};

export type ChatChannel = {
  id: string;
  slug: string;
  channel_type: "lobby" | "game" | "tournament" | "match_room" | "group" | "dm";
  visibility: "public" | "members" | "private";
  status: "active" | "archived" | "locked";
  title: string;
  description: string | null;
  game_id: string | null;
  tournament_id: string | null;
  match_room_id: string | null;
  created_by_user_id: string | null;
  last_message_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  membership_status?: "active" | "muted" | "left" | "removed" | "blocked" | null;
  membership_role?: "member" | "moderator" | "admin" | "owner" | null;
  membership_last_read_at?: string | null;
  membership_last_seen_at?: string | null;
  unread_count?: number;
  online_count?: number;
  last_message_body?: string | null;
  last_message_sender_label?: string | null;
  last_message_sender_user_id?: string | null;
  slow_mode_seconds?: number;
  lockdown_until?: string | null;
  lockdown_reason?: string | null;
  locked_by_user_id?: string | null;
  membership_notification_level?: ChatNotificationLevel | null;
  membership_dm_notification_level?: ChatNotificationLevel | null;
  membership_push_enabled?: boolean | null;
  dm_peer_user_id?: string | null;
  dm_peer_username?: string | null;
  dm_peer_display_name?: string | null;
  dm_peer_label?: string | null;
};

export type ChatNotificationLevel = "all" | "mentions" | "none";

export type ChatChannelControls = {
  notification_level: ChatNotificationLevel;
  dm_notification_level: ChatNotificationLevel;
  push_enabled: boolean;
  slow_mode_seconds: number;
  lockdown_until: string | null;
  lockdown_reason: string | null;
  can_manage_channel: boolean;
};

export type ChatAttachment = {
  id: string;
  channel_id: string;
  message_id: string | null;
  uploader_user_id: string;
  attachment_type: "image" | "document";
  status: "pending" | "ready" | "attached" | "hidden" | "deleted" | "failed";
  mime_type:
    | "image/jpeg"
    | "image/png"
    | "image/webp"
    | "application/pdf"
    | "application/msword"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    | "application/vnd.oasis.opendocument.text"
    | "text/plain";
  byte_size: number;
  width: number | null;
  height: number | null;
  thumbnail_url?: string | null;
  thumbnail_width?: number | null;
  thumbnail_height?: number | null;
  cdn_url?: string | null;
  media_object_path?: string | null;
  original_url_available?: boolean;
  original_name: string | null;
  alt_text: string | null;
  created_at: string;
  uploader_label: string;
  client_preview_url?: string;
};

export type ChatMessage = {
  id: string;
  channel_id: string;
  sender_user_id: string | null;
  message_kind: "user" | "system";
  status: "visible" | "hidden" | "deleted" | "flagged";
  body: string;
  client_message_id: string | null;
  reply_to_message_id: string | null;
  thread_root_message_id?: string | null;
  forwarded_from_message_id?: string | null;
  forwarded_from_channel_id?: string | null;
  reply_to_body?: string | null;
  reply_to_status?: "visible" | "hidden" | "deleted" | "flagged" | null;
  reply_to_sender_user_id?: string | null;
  reply_to_sender_label?: string | null;
  mentions?: Array<{ user_id: string; text: string; label?: string }>;
  link_preview?: { url?: string; host?: string; title?: string; safety?: string };
  reactions?: Array<{ reaction: string; count: number; reacted_by_me?: boolean }>;
  bookmarked_by_me?: boolean;
  thread_reply_count?: number;
  view?: "full" | "list" | string;
  attachment_count?: number;
  attachment_preview?: Partial<ChatAttachment> | null;
  has_attachments?: boolean;
  has_poll?: boolean;
  poll_summary?: Partial<ChatPoll> | null;
  poll?: ChatPoll | null;
  attachments?: ChatAttachment[];
  pinned_at?: string | null;
  pinned_by_user_id?: string | null;
  metadata?: Record<string, unknown>;
  hidden_by_user_id: string | null;
  hidden_at: string | null;
  deleted_by_user_id: string | null;
  deleted_at: string | null;
  edited_at: string | null;
  edit_count: number;
  editable_until: string | null;
  created_at: string;
  updated_at: string;
  sender_username?: string | null;
  sender_display_name?: string | null;
  sender_label: string;
  client_delivery_state?: "sending" | "failed";
  client_error?: string;
};

export type ChatPollOption = {
  id: string;
  poll_id: string;
  option_order: number;
  label: string;
  vote_count: number;
  voted_by_me: boolean;
};

export type ChatPoll = {
  id: string;
  channel_id: string;
  message_id: string;
  created_by_user_id: string | null;
  question: string;
  allow_multiple: boolean;
  status: "open" | "closed" | "cancelled";
  closes_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  options: ChatPollOption[];
  total_votes: number;
};

export type ChatBookmark = {
  message_id: string;
  channel_slug: string;
  channel_title: string;
  bookmarked_at: string;
  message: ChatMessage;
};

export type ChatReactionMember = {
  user_id: string;
  reaction: string;
  created_at: string;
  username: string | null;
  display_name: string | null;
  label: string;
};

export type ScheduledChatAnnouncement = {
  id: string;
  channel_id: string;
  created_by_user_id: string | null;
  body: string;
  scheduled_for: string;
  status: "scheduled" | "publishing" | "published" | "cancelled" | "failed";
  published_message_id: string | null;
  created_at: string;
};

export type ChatMessagePageInfo = {
  has_older: boolean;
  older_cursor: string | null;
};

export type ChatSearchPageInfo = {
  has_more: boolean;
  next_cursor: string | null;
};

export type ChatPinnedMessage = {
  id: string;
  channel_id: string;
  message_id: string;
  pinned_by_user_id: string | null;
  reason: string | null;
  pinned_at: string;
  expires_at: string | null;
  unpinned_at: string | null;
  unpinned_by_user_id: string | null;
  body?: string;
  sender_user_id?: string | null;
  sender_username?: string | null;
  sender_display_name?: string | null;
  sender_label: string;
};

export type ChatMessageEdit = {
  id: string;
  message_id: string;
  channel_id: string;
  editor_user_id: string | null;
  previous_body: string;
  metadata: Record<string, unknown>;
  edited_at: string;
  editor_username?: string | null;
  editor_display_name?: string | null;
};

export type ChatPresenceUser = {
  channel_id: string;
  user_id: string;
  last_seen_at: string;
  typing_until: string | null;
  updated_at: string;
  username?: string | null;
  display_name?: string | null;
  label: string;
  is_online: boolean;
  is_typing: boolean;
};

export type ChatPresenceSummary = {
  online_count: number;
  active: ChatPresenceUser[];
  typing: ChatPresenceUser[];
};

export type ChatModerationEvent = {
  id: string;
  channel_id: string;
  message_id: string | null;
  target_user_id: string | null;
  actor_user_id: string | null;
  event_type: "message_hidden" | "message_deleted" | "message_reported" | "member_muted" | "member_unmuted" | "channel_locked" | "channel_unlocked";
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  channel_slug?: string;
  channel_title?: string;
  message_body?: string | null;
  message_status?: ChatMessage["status"] | null;
  sender_username?: string | null;
  sender_display_name?: string | null;
  actor_username?: string | null;
  actor_display_name?: string | null;
};

export type ChatDmRequest = {
  id: string;
  requester_user_id: string;
  recipient_user_id: string;
  channel_id: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
  intro_message: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  requester_username?: string | null;
  requester_display_name?: string | null;
  recipient_username?: string | null;
  recipient_display_name?: string | null;
  channel_slug?: string | null;
  channel_title?: string | null;
  requester_label: string;
  recipient_label: string;
};

export type ChatUserBlock = {
  blocker_user_id: string;
  blocked_user_id: string;
  reason: string | null;
  created_at: string;
  blocker_username?: string | null;
  blocker_display_name?: string | null;
  blocked_username?: string | null;
  blocked_display_name?: string | null;
  blocker_label: string;
  blocked_label: string;
};

export type LeaderboardRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  region: string;
  city: string | null;
  campus: string | null;
  primary_game_slug: string | null;
  primary_game_name: string | null;
  primary_game_handle: string | null;
  reputation_score: number;
  leaderboard_score: number;
  rank: number;
  completed_matches: number;
  wins: number;
  losses: number;
  disputes_lost: number;
  no_shows: number;
  completed_tournaments: number;
  tournament_wins: number;
  podium_finishes: number;
};

export type CommunityLeaderboardFilters = {
  game_slug?: string;
  city?: string;
  campus?: string;
  region?: string;
  limit?: number;
};

export type CommunityLeaderboardSummary = {
  ranked_players: number;
  completed_matches: number;
  completed_tournaments: number;
  tournament_wins: number;
  podium_finishes: number;
  active_games: number;
  active_cities: number;
  active_campuses: number;
};

export type CommunityLeaderboardResponse = {
  filters: CommunityLeaderboardFilters;
  summary: CommunityLeaderboardSummary;
  leaderboard: LeaderboardRow[];
};

export type CommunityPlayerRankingResponse = {
  player: LeaderboardRow;
  nearby: LeaderboardRow[];
  summary: CommunityLeaderboardSummary;
};

export type CommunityPublicIdentity = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  city: string | null;
  campus: string | null;
  rank_path: string | null;
};

export type CommunityTournamentHighlightCard = {
  tournament_id: string;
  tournament_slug: string;
  title: string;
  status: string;
  format: string;
  entry_type: string;
  game_slug: string;
  game_name: string;
  currency: string;
  projected_prize_minor: number;
  registered_entry_count: number;
  completed_match_count: number;
  champion_entry_id: string | null;
  champion_entry_name: string | null;
  champion_user_id: string | null;
  champion_username: string | null;
  champion_display_name: string | null;
  runner_up_entry_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

export type CommunityHighlightsResponse = {
  tournament_highlights: CommunityTournamentHighlightCard[];
};

export type CommunityAnnouncementScope = "platform" | "tournament";
export type CommunityAnnouncementStatus = "draft" | "published" | "archived";
export type CommunityAnnouncementPriority = "low" | "normal" | "high" | "critical";
export type CommunityAnnouncementCategory =
  | "announcement"
  | "tournament_update"
  | "winner_post"
  | "maintenance"
  | "incident"
  | "sponsor_note";

export type CommunityAnnouncement = {
  id: string;
  scope: CommunityAnnouncementScope;
  category: CommunityAnnouncementCategory;
  status: CommunityAnnouncementStatus;
  priority: CommunityAnnouncementPriority;
  tournament_id: string | null;
  game_id: string | null;
  author_user_id: string;
  published_by_user_id: string | null;
  archived_by_user_id: string | null;
  title: string;
  summary: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  metadata: Record<string, unknown>;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  tournament_slug?: string | null;
  tournament_title?: string | null;
  game_slug?: string | null;
  game_name?: string | null;
  author_username?: string | null;
  author_display_name?: string | null;
};

export type CommunityAnnouncementFilters = {
  scope?: CommunityAnnouncementScope;
  tournament_id?: string;
  category?: CommunityAnnouncementCategory;
  priority?: CommunityAnnouncementPriority;
  status?: CommunityAnnouncementStatus;
  limit?: number;
};

export type CommunityAnnouncementListResponse = {
  announcements: CommunityAnnouncement[];
};

export type CommunityLivestreamTargetType = "tournament" | "match_room";
export type CommunityLivestreamProvider = "youtube" | "twitch" | "facebook" | "tiktok" | "kick" | "generic";
export type CommunityLivestreamStatus = "active" | "archived";
export type CommunityLivestreamVisibility = "public" | "participants";
export type CommunityLivestreamStreamRole = "official" | "player_a" | "player_b";
export type CommunityLivestreamPlaybackStatus = "live" | "offline" | "replay" | "unavailable";

export type CommunityLivestreamLink = {
  id: string;
  target_type: CommunityLivestreamTargetType;
  tournament_id: string | null;
  match_room_id: string | null;
  provider: CommunityLivestreamProvider;
  status: CommunityLivestreamStatus;
  visibility: CommunityLivestreamVisibility;
  title: string;
  stream_url: string;
  embed_url: string | null;
  display_order: number;
  is_featured: boolean;
  created_by_user_id: string;
  archived_by_user_id: string | null;
  metadata: Record<string, unknown>;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  tournament_title?: string | null;
  tournament_slug?: string | null;
  room_code?: string | null;
};

export type CommunityLivestreamListResponse = {
  livestreams: CommunityLivestreamLink[];
};

export type CommunitySocialProofMetrics = {
  as_of: string;
  rooms_created: number;
  matches_completed: number;
  tournaments_hosted: number;
  winners_crowned: number;
  disputes_resolved: number;
  players_registered: number;
  clans_created: number;
  entries_checked_in: number;
  prize_reservations_count: number;
  prize_reservations_minor: number;
  payout_queue_count: number;
  payout_queue_minor: number;
  refund_queue_count: number;
  refund_queue_minor: number;
  verified_payout_metrics_enabled: boolean;
  verified_payouts_completed_count: number | null;
  verified_payouts_completed_minor: number | null;
};

export type CommunityTournamentWinnerPage = {
  tournament: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    status: string;
    format: string;
    entry_type: string;
    scoring_mode: string;
    currency: string;
    projected_prize_minor: number;
    game_slug: string | null;
    game_name: string | null;
    starts_at: string | null;
    ends_at: string | null;
    registered_entry_count: number;
  };
  winner: {
    entry_id: string;
    entry_name: string;
    player: CommunityPublicIdentity | null;
    player_label: string;
    result_label: string;
    rank_path: string | null;
  };
  placements: Array<{
    rank: number | null;
    entry_id: string;
    entry_name: string;
    player: CommunityPublicIdentity | null;
    points: number;
    record: string;
  }>;
  notable_matches: Array<{
    match_id: string;
    round_id: string;
    round_name: string;
    result_summary: string | null;
    winner_entry_name: string;
    winner_match_path: string | null;
    sides: Array<{
      entry_name: string;
      result: string;
      score: number | null;
    }>;
  }>;
  host_labels: Array<{ role: string; label: string }>;
  standings_count: number;
  share_path: string;
};

export type CommunityMatchWinnerPage = {
  room: {
    id: string;
    room_code: string;
    title: string | null;
    status: string;
    currency: string;
    entry_amount_minor: number;
    game_slug: string | null;
    game_name: string | null;
    ruleset_slug: string | null;
    ruleset_title: string | null;
    created_at: string;
  };
  winner: {
    user_id: string;
    label: string;
    identity: CommunityPublicIdentity | null;
    rank_path: string | null;
  };
  opponent: {
    user_id: string;
    label: string;
    identity: CommunityPublicIdentity | null;
    rank_path: string | null;
  } | null;
  result: {
    score_summary: string | null;
    approved_at: string | null;
    status_label: string;
    settlement_status: string | null;
  };
  share_path: string;
};

export type CommunityClan = {
  id: string;
  slug: string;
  name: string;
  tag: string | null;
  description: string | null;
  region: string;
  city: string | null;
  campus: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  reputation_score: number;
  game_focus: string[];
  created_at: string;
  member_count: number;
  completed_tournaments: number;
  tournament_wins: number;
  podium_finishes: number;
  match_record: {
    wins: number;
    losses: number;
    draws: number;
  };
};

export type CommunityClanListItem = CommunityClan & {
  captain_username: string | null;
  captain_display_name: string | null;
};

export type CommunityClanMember = {
  user_id: string;
  role: "captain" | "member" | "substitute";
  joined_at: string | null;
  username: string | null;
  display_name: string | null;
  reputation_score: number | null;
  city: string | null;
  campus: string | null;
  rank_path: string | null;
};

export type CommunityClanTournamentHistoryItem = {
  tournament_id: string;
  tournament_slug: string;
  tournament_title: string;
  tournament_status: string;
  tournament_format: string;
  tournament_game_slug: string | null;
  tournament_game_name: string | null;
  entry_id: string;
  entry_name: string;
  rank: number | null;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type CommunityClanDetailResponse = {
  clan: CommunityClan;
  captain: (CommunityPublicIdentity & { label: string }) | null;
  members: CommunityClanMember[];
  tournament_history: CommunityClanTournamentHistoryItem[];
  share_path: string;
};

export type CommunityClanListResponse = {
  clans: CommunityClanListItem[];
};

export type MyCommunityClanResponse = {
  clan: {
    id: string;
    slug: string;
    name: string;
    tag: string | null;
    description: string | null;
    captain_user_id: string;
    region: string;
    city: string | null;
    campus: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    visibility: "public" | "invite_only" | "hidden";
    moderation_status: string;
    reputation_score: number;
    game_focus: string[];
    created_at: string;
    updated_at: string;
  } | null;
  members?: Array<{
    user_id: string;
    role: "captain" | "member" | "substitute";
    status: string;
    joined_at: string | null;
    username: string | null;
    display_name: string | null;
    reputation_score: number | null;
    campus: string | null;
    city: string | null;
  }>;
  tournament_history?: CommunityClanTournamentHistoryItem[];
};

export type CommunityReferralSummaryItem = {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referral_code_id: string;
  status: "pending_activation" | "reward_eligible" | "reward_issued" | "reward_held" | "rejected";
  issued_rewards: string[];
  eligibility_snapshot: {
    profile_ready?: boolean;
    has_primary_game_account?: boolean;
    has_meaningful_activity?: boolean;
    referred_moderation_status?: string | null;
    referrer_moderation_status?: string | null;
  };
  source_path: string | null;
  channel: string | null;
  created_at: string;
  referred_username: string | null;
  referred_display_name: string | null;
  code: string;
};

export type MyReferralProgramResponse = {
  referral_code: string;
  referral_path: string;
  referrals: CommunityReferralSummaryItem[];
  summary: {
    total: number;
    pending_activation: number;
    reward_issued: number;
    reward_held: number;
  };
};

export type TournamentFormat =
  | "single_elimination"
  | "double_elimination"
  | "round_robin"
  | "swiss"
  | "group_stage_playoffs"
  | "league"
  | "season"
  | "free_for_all"
  | "leaderboard"
  | "race"
  | "time_trial"
  | "grand_prix";
export type TournamentStatus =
  | "draft"
  | "published"
  | "registration_open"
  | "registration_locked"
  | "seeding"
  | "in_progress"
  | "awaiting_results"
  | "under_review"
  | "disputed"
  | "settlement_pending"
  | "completed"
  | "cancelled"
  | "refunded"
  | "voided";
export type TournamentEntryType = "solo" | "team";
export type TournamentFeeMode = "free" | "paid" | "sponsored" | "hybrid";
export type TournamentScoringMode = "match_win_loss" | "cumulative_score" | "points" | "placement";
export type TournamentPrizeDistributionMode =
  | "winner_take_all"
  | "top_2_split"
  | "top_3_split"
  | "custom_fixed"
  | "custom_percentage";

export type TournamentResultReviewDecision =
  | "confirm_score"
  | "mark_disputed"
  | "void_match"
  | "forfeit_entry"
  | "no_show_entry"
  | "disqualify_entry";

export type Tournament = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  game_id: string;
  ruleset_id: string | null;
  game_slug?: string;
  game_name?: string;
  ruleset_slug?: string | null;
  created_by_user_id: string;
  format: TournamentFormat;
  entry_type: TournamentEntryType;
  fee_mode: TournamentFeeMode;
  scoring_mode: TournamentScoringMode;
  prize_distribution_mode: TournamentPrizeDistributionMode;
  status: TournamentStatus;
  currency: string;
  entry_fee_amount_minor: number;
  sponsored_prize_pool_minor: number;
  guaranteed_prize_pool_minor: number;
  commission_bps: number;
  min_entries: number;
  max_entries: number;
  team_size_min: number;
  team_size_max: number;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  registered_entry_count?: number;
  checked_in_entry_count?: number;
  approved_prize_contribution_minor?: number;
  created_at: string;
  updated_at: string;
};

export type TournamentStateEvent = {
  id: string;
  tournament_id: string;
  from_status: TournamentStatus | null;
  to_status: TournamentStatus;
  actor_user_id: string | null;
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type TournamentEntry = {
  id: string;
  tournament_id: string;
  captain_user_id: string;
  display_name: string;
  team_name: string | null;
  status: string;
  funding_status: string;
  seed: number | null;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
  captain_username?: string | null;
  captain_display_name?: string | null;
};

export type TournamentEntryMember = {
  id: string;
  entry_id: string;
  tournament_id: string;
  user_id: string;
  game_account_id: string | null;
  member_role: string;
  status: string;
  joined_at: string;
  removed_at: string | null;
  username?: string | null;
  display_name?: string | null;
  game_handle?: string | null;
  game_account_status?: string | null;
};

export type TournamentStage = {
  id: string;
  tournament_id: string;
  stage_order: number;
  stage_type: string;
  status: string;
  name: string;
  starts_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type TournamentRound = {
  id: string;
  tournament_id: string;
  stage_id: string;
  round_number: number;
  status: string;
  name: string;
  bracket_side: string | null;
  group_key: string | null;
  starts_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type TournamentMatch = {
  id: string;
  tournament_id: string;
  stage_id: string;
  round_id: string;
  match_room_id: string | null;
  status: string;
  match_number: number;
  bracket_path: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  result_summary: string | null;
  created_at: string;
  updated_at?: string;
};

export type TournamentMatchSide = {
  id: string;
  tournament_match_id: string;
  tournament_id: string;
  entry_id: string | null;
  side_index: number;
  seed: number | null;
  score: number | null;
  result: string;
  is_winner: boolean;
  created_at: string;
};

export type TournamentMatchCheckIn = {
  id: string;
  tournament_id: string;
  tournament_match_id: string;
  match_room_id: string;
  participant_id: string;
  user_id: string;
  checked_in_at: string;
  metadata: Record<string, unknown>;
};

export type MatchStartConfirmation = {
  id: string;
  match_room_id: string;
  participant_id: string;
  user_id: string;
  confirmed_at: string;
  metadata: Record<string, unknown>;
};

export type TournamentMatchResultReview = {
  id: string;
  tournament_id: string;
  tournament_match_id: string;
  match_room_id: string | null;
  result_claim_id: string | null;
  decision: TournamentResultReviewDecision;
  winning_entry_id: string | null;
  penalized_entry_id: string | null;
  actor_user_id: string;
  score_summary: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type TournamentStageSummary = TournamentStage & {
  round_count: number;
  match_count: number;
  completed_match_count: number;
};

export type TournamentFundingSummary = {
  contribution_count: number;
  allocation_count: number;
  approved_contribution_minor: number;
  planned_allocation_minor: number;
  paid_allocation_minor: number;
};

export type TournamentSettlement = {
  id: string;
  tournament_id: string;
  currency: string;
  gross_pool_minor: number;
  commission_bps: number;
  commission_minor: number;
  payout_pool_minor: number;
  status: string;
  reserved_by_user_id: string;
  reserved_at: string;
  completed_by_user_id: string | null;
  completed_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TournamentPayout = {
  id: string;
  settlement_id: string;
  tournament_id: string;
  prize_allocation_id: string | null;
  entry_id: string | null;
  user_id: string;
  currency: string;
  amount_minor: number;
  status: string;
  queued_by_user_id: string;
  completed_by_user_id: string | null;
  completed_at: string | null;
  payout_reference: string | null;
  completion_proof_url: string | null;
  failure_note: string | null;
  recipient_name: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_number_masked: string | null;
  bank_code: string | null;
  payout_note: string | null;
  instruction_status: "ready" | "missing";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  tournament_title?: string | null;
  entry_display_name?: string | null;
  username?: string | null;
  display_name?: string | null;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
  settlement_status?: string | null;
};

export type TournamentRefund = {
  id: string;
  tournament_id: string;
  contribution_id: string | null;
  entry_id: string | null;
  user_id: string;
  currency: string;
  amount_minor: number;
  status: string;
  reason: string;
  queued_by_user_id: string;
  completed_by_user_id: string | null;
  completed_at: string | null;
  refund_reference: string | null;
  completion_proof_url: string | null;
  failure_note: string | null;
  recipient_name: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_number_masked: string | null;
  bank_code: string | null;
  payout_note: string | null;
  instruction_status: "ready" | "missing";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  tournament_title?: string | null;
  entry_display_name?: string | null;
  username?: string | null;
  display_name?: string | null;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
};

export type TournamentStanding = {
  id: string;
  tournament_id: string;
  stage_id: string | null;
  entry_id: string;
  rank: number | null;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  tiebreakers: Record<string, unknown>;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type TournamentPrizeAllocation = {
  id: string;
  tournament_id: string;
  entry_id: string | null;
  rank: number | null;
  currency: string;
  amount_minor: number;
  status: string;
  notes: string | null;
  created_at: string;
};

export type TournamentPrizeContribution = {
  id: string;
  tournament_id: string;
  source: string;
  status: string;
  contributor_user_id: string | null;
  tournament_entry_id: string | null;
  currency: string;
  amount_minor: number;
  external_reference: string | null;
  proof_url: string | null;
  payout_recipient_name: string | null;
  payout_bank_name: string | null;
  payout_account_number: string | null;
  payout_account_number_masked: string | null;
  payout_bank_code: string | null;
  payout_note: string | null;
  notes: string | null;
  created_at: string;
  tournament_title?: string;
  entry_display_name?: string | null;
};

export type TournamentHostRole = "creator" | "co_host" | "sponsor";
export type TournamentHostStatus = "active" | "suspended" | "removed";

export type TournamentHost = {
  id: string;
  tournament_id: string;
  user_id: string;
  role: TournamentHostRole;
  status: TournamentHostStatus;
  permissions: Record<string, unknown>;
  invited_by_user_id: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  username?: string | null;
  display_name?: string | null;
  email?: string | null;
};

export type SecurityEvent = {
  id: string;
  event: string;
  severity: "info" | "warning" | "critical";
  actor_user_id: string | null;
  actor_role: string | null;
  target_user_id: string | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_method: string | null;
  request_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type TournamentDetail = Tournament & {
  entries: TournamentEntry[];
  entry_members: TournamentEntryMember[];
  stages: TournamentStage[];
  rounds: TournamentRound[];
  matches: TournamentMatch[];
  match_sides: TournamentMatchSide[];
  match_check_ins: TournamentMatchCheckIn[];
  result_reviews: TournamentMatchResultReview[];
  standings: TournamentStanding[];
  prize_allocations: TournamentPrizeAllocation[];
  prize_contributions: TournamentPrizeContribution[];
  hosts: TournamentHost[];
};

export type TournamentBoardPage = {
  tournaments: Tournament[];
  next_cursor: string | null;
};

export type TournamentEntrantsPayload = {
  tournament_id: string;
  view?: "summary" | "full";
  entries: TournamentEntry[];
  entry_members: TournamentEntryMember[];
};

export type TournamentSummaryPayload = {
  tournament: Tournament;
  viewer_entries?: TournamentEntry[];
  viewer_entry_members?: TournamentEntryMember[];
};

export type TournamentBracketPayload = {
  tournament_id: string;
  view?: "summary" | "full";
  stages: Array<TournamentStage | TournamentStageSummary>;
  rounds: TournamentRound[];
  matches: TournamentMatch[];
  match_sides: TournamentMatchSide[];
  match_check_ins: TournamentMatchCheckIn[];
  standings: TournamentStanding[];
};

export type TournamentFundingPayload = {
  tournament_id: string;
  view?: "summary" | "full";
  summary: TournamentFundingSummary | null;
  prize_contributions: TournamentPrizeContribution[];
  prize_allocations: TournamentPrizeAllocation[];
};

export type TournamentResultReviewsPayload = {
  tournament_id: string;
  result_reviews: TournamentMatchResultReview[];
};

export type TournamentActivityPayload = {
  tournament_id: string;
  events: TournamentStateEvent[];
};

export type MatchStateEvent = {
  id: string;
  match_room_id: string;
  from_status: MatchRoomStatus | null;
  to_status: MatchRoomStatus;
  actor_user_id: string | null;
  reason: string;
  created_at: string;
};

export type MatchTimeline = {
  room: MatchRoom;
  participants: MatchParticipant[];
  events: MatchStateEvent[];
  tournament_match_check_ins?: TournamentMatchCheckIn[];
  start_confirmations?: MatchStartConfirmation[];
};

export type MatchRoomShell = {
  room: MatchRoom & {
    participant_count: number;
    game_slug: string | null;
    game_name: string | null;
    ruleset_slug: string | null;
    ruleset_title: string | null;
  };
  participants: MatchParticipant[];
  tournament_match_check_ins?: TournamentMatchCheckIn[];
  start_confirmations?: MatchStartConfirmation[];
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly requestId?: string
  ) {
    super(message);
  }
}

type ApiSuccess<T> = { ok: true; data: T };
type ApiFailure = { ok: false; error?: { code?: string; message?: string; requestId?: string } };
type ApiRequestInit = RequestInit & {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
  timeoutMs?: number;
};

function appOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
}

function requestSignal(init: ApiRequestInit) {
  return init.signal ?? AbortSignal.timeout(init.timeoutMs ?? 15_000);
}

function toFetchInit(init: ApiRequestInit): RequestInit {
  const fetchInit: ApiRequestInit = { ...init };
  delete fetchInit.timeoutMs;
  return fetchInit;
}

function requestError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || name === "TimeoutError") {
    return new ApiRequestError(
      "That took too long. Please check your connection and try again.",
      504,
      "API_TIMEOUT"
    );
  }

  return new ApiRequestError(
    "Skillsroom API is temporarily unavailable. Please try again.",
    503,
    "API_UNAVAILABLE"
  );
}

function traceApiRequest(input: {
  path: string;
  method: string;
  status: number | null;
  durationMs: number;
  ok: boolean;
  publicRequest: boolean;
}) {
  if (typeof process === "undefined" || process.env.PLAYER_WEB_LOAD_TRACE_API !== "1") return;
  console.log(`PLAYER_WEB_LOAD_API ${JSON.stringify({
    at: new Date().toISOString(),
    path: input.path,
    method: input.method,
    status: input.status,
    duration_ms: input.durationMs,
    ok: input.ok,
    public: input.publicRequest
  })}`);
}

async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiRequestError("Please sign in before using match rooms.", 401, "AUTH_REQUIRED");
  }

  const fetchInit = toFetchInit(init);
  let response: Response;
  const startedAt = performance.now();
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...fetchInit,
      signal: requestSignal(init),
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        origin: appOrigin(),
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers
      },
      cache: "no-store"
    });
  } catch (error) {
    traceApiRequest({
      path,
      method: init.method ?? "GET",
      status: null,
      durationMs: Math.round(performance.now() - startedAt),
      ok: false,
      publicRequest: false
    });
    throw requestError(error);
  }
  traceApiRequest({
    path,
    method: init.method ?? "GET",
    status: response.status,
    durationMs: Math.round(performance.now() - startedAt),
    ok: response.ok,
    publicRequest: false
  });

  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;
  if (!response.ok || !payload || payload.ok !== true) {
    const failure = payload && payload.ok === false ? payload : null;
    throw new ApiRequestError(
      failure?.error?.message ?? `API request failed with status ${response.status}.`,
      response.status,
      failure?.error?.code,
      failure?.error?.requestId
    );
  }

  return payload.data;
}

async function publicApiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const fetchInit = toFetchInit(init);
  const cacheMode = init.cache ?? "force-cache";
  const nextConfig = init.next ?? { revalidate: 60 };
  let response: Response;
  const startedAt = performance.now();
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...fetchInit,
      signal: requestSignal(init),
      headers: {
        accept: "application/json",
        origin: appOrigin(),
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers
      },
      cache: cacheMode,
      next: nextConfig
    });
  } catch (error) {
    traceApiRequest({
      path,
      method: init.method ?? "GET",
      status: null,
      durationMs: Math.round(performance.now() - startedAt),
      ok: false,
      publicRequest: true
    });
    throw requestError(error);
  }
  traceApiRequest({
    path,
    method: init.method ?? "GET",
    status: response.status,
    durationMs: Math.round(performance.now() - startedAt),
    ok: response.ok,
    publicRequest: true
  });

  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;
  if (!response.ok || !payload || payload.ok !== true) {
    const failure = payload && payload.ok === false ? payload : null;
    throw new ApiRequestError(
      failure?.error?.message ?? `API request failed with status ${response.status}.`,
      response.status,
      failure?.error?.code,
      failure?.error?.requestId
    );
  }

  return payload.data;
}

function queryString(filters: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) params.set(key, String(value).trim());
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function formatEntryAmount(room: Pick<MatchRoom, "currency" | "entry_amount_minor">) {
  const amount = room.entry_amount_minor / 100;
  return `${room.currency} ${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(amount)}`;
}

export function matchStatusLabel(status: MatchRoomStatus) {
  return status
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function displayEnumLabel(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatMinorMoney(currency: string, amountMinor: number) {
  const amount = amountMinor / 100;
  return `${currency} ${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(amount)}`;
}

export function confirmAdminStepUp(input: { password: string }) {
  return apiRequest<{ step_up_token: string; expires_at: string }>("/auth/step-up", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function listMatchRooms(input: { status?: MatchRoomStatus; cursor?: string; limit?: number; view?: "list" | "full" } = {}) {
  return apiRequest<{ rooms: MatchRoomListRow[]; next_cursor: string | null }>(
    `/match-rooms${queryString({ status: input.status, cursor: input.cursor, limit: input.limit, view: input.view ?? "list" })}`,
    { timeoutMs: 8_000 }
  );
}

export function getMatchRoomStatusCounts() {
  return apiRequest<{ counts: Partial<Record<MatchRoomStatus, number>> }>("/match-rooms/status-counts", { timeoutMs: 8_000 });
}

export function getMatchRoomShell(matchRoomId: string) {
  return apiRequest<MatchRoomShell>(`/match-rooms/${encodeURIComponent(matchRoomId)}?view=shell`, { timeoutMs: 12_000 });
}

export function getPlayerHomeSummary() {
  return apiRequest<PlayerHomeSummary>("/player/home-summary", { timeoutMs: 8_000 });
}

export function listGameCatalog() {
  return apiRequest<{ games: Game[]; rulesets: MatchRuleset[] }>("/games", { timeoutMs: 8_000 });
}

export function listTournaments(input: { status?: TournamentStatus; format?: TournamentFormat; limit?: number; cursor?: string; view?: "list" | "full" } = {}) {
  const params = new URLSearchParams();
  params.set("view", input.view ?? "list");
  if (input.status) params.set("status", input.status);
  if (input.format) params.set("format", input.format);
  if (input.limit) params.set("limit", input.limit.toString());
  if (input.cursor) params.set("cursor", input.cursor);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<TournamentBoardPage>(`/tournaments${query}`);
}

export function createTournament(input: {
  title: string;
  description?: string;
  game_slug: string;
  ruleset_slug?: string;
  format: TournamentFormat;
  entry_type: TournamentEntryType;
  fee_mode: TournamentFeeMode;
  scoring_mode: TournamentScoringMode;
  prize_distribution_mode: TournamentPrizeDistributionMode;
  currency: string;
  entry_fee_amount_minor: number;
  sponsored_prize_pool_minor: number;
  guaranteed_prize_pool_minor: number;
  commission_bps: number;
  min_entries: number;
  max_entries: number;
  team_size_min: number;
  team_size_max: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  starts_at?: string;
  ends_at?: string;
  settings?: Record<string, unknown>;
}) {
  return apiRequest<{ tournament: Tournament }>("/tournaments", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getTournamentDetail(tournamentId: string, view: "summary" | "full" = "full") {
  return apiRequest<{ tournament: TournamentDetail; events: TournamentStateEvent[] }>(
    `/tournaments/${encodeURIComponent(tournamentId)}${queryString({ view })}`
  );
}

export function getTournamentSummary(tournamentId: string) {
  return apiRequest<TournamentSummaryPayload>(`/tournaments/${encodeURIComponent(tournamentId)}?view=summary`, { timeoutMs: 8_000 });
}

export function getTournamentEntrants(tournamentId: string, view: "summary" | "full" = "summary") {
  return apiRequest<TournamentEntrantsPayload>(`/tournaments/${encodeURIComponent(tournamentId)}/entrants${queryString({ view })}`);
}

export function getTournamentBracket(tournamentId: string, view: "summary" | "full" = "summary") {
  return apiRequest<TournamentBracketPayload>(`/tournaments/${encodeURIComponent(tournamentId)}/bracket${queryString({ view })}`);
}

export function getTournamentFunding(tournamentId: string, view: "summary" | "full" = "summary") {
  return apiRequest<TournamentFundingPayload>(`/tournaments/${encodeURIComponent(tournamentId)}/funding${queryString({ view })}`);
}

export function getTournamentResultReviews(tournamentId: string) {
  return apiRequest<TournamentResultReviewsPayload>(`/tournaments/${encodeURIComponent(tournamentId)}/result-reviews`);
}

export function getTournamentActivity(tournamentId: string) {
  return apiRequest<TournamentActivityPayload>(`/tournaments/${encodeURIComponent(tournamentId)}/activity`);
}

export function listTournamentHosts(tournamentId: string) {
  return apiRequest<{ hosts: TournamentHost[] }>(`/tournaments/${encodeURIComponent(tournamentId)}/hosts`);
}

export function grantTournamentHost(
  tournamentId: string,
  input: {
    user_id?: string;
    username?: string;
    role: TournamentHostRole;
    permissions?: Record<string, boolean>;
    notes?: string;
    stepUpToken: string;
  }
) {
  return apiRequest<{ host: TournamentHost }>(`/tournaments/${encodeURIComponent(tournamentId)}/hosts`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({
      user_id: input.user_id,
      username: input.username,
      role: input.role,
      permissions: input.permissions,
      notes: input.notes
    })
  });
}

export function updateTournamentHostEvent(
  tournamentId: string,
  input: {
    title?: string;
    description?: string;
    registration_opens_at?: string;
    registration_closes_at?: string;
    starts_at?: string;
    ends_at?: string;
    settings?: Record<string, unknown>;
    stepUpToken: string;
  }
) {
  return apiRequest<{ tournament: Tournament }>(`/tournaments/${encodeURIComponent(tournamentId)}/host-event`, {
    method: "PATCH",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      registration_opens_at: input.registration_opens_at,
      registration_closes_at: input.registration_closes_at,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      settings: input.settings
    })
  });
}

export function registerForTournament(
  tournamentId: string,
  input: {
    display_name?: string;
    team_name?: string;
  }
) {
  return apiRequest<{ entry: TournamentEntry }>(`/tournaments/${encodeURIComponent(tournamentId)}/register`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function checkInForTournament(tournamentId: string) {
  return apiRequest<{ entry: TournamentEntry }>(`/tournaments/${encodeURIComponent(tournamentId)}/check-in`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function payTournamentEntryWithBalance(tournamentId: string) {
  return apiRequest<{ entry: TournamentEntry }>(`/tournaments/${encodeURIComponent(tournamentId)}/balance-entry`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function submitTournamentContribution(
  tournamentId: string,
  input: {
    source: TournamentPrizeContribution["source"];
    amount_minor: number;
    collection_bank_name?: string;
    collection_account_number?: string;
    collection_account_name?: string;
    external_reference?: string;
    proof_url?: string;
    payout_recipient_name?: string;
    payout_bank_name?: string;
    payout_account_number?: string;
    payout_bank_code?: string;
    payout_note?: string;
    notes?: string;
  }
) {
  return apiRequest<{ contribution: TournamentPrizeContribution }>(
    `/tournaments/${encodeURIComponent(tournamentId)}/contributions`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export function listTournamentContributions(status = "submitted") {
  return apiRequest<{ contributions: TournamentPrizeContribution[] }>(
    `/tournaments/admin/contributions?status=${encodeURIComponent(status)}`
  );
}

export function reviewTournamentContribution(
  contributionId: string,
  input: { decision: "approve" | "reject"; note?: string; stepUpToken: string }
) {
  return apiRequest<{ contribution: TournamentPrizeContribution }>(
    `/tournaments/admin/contributions/${encodeURIComponent(contributionId)}/review`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: JSON.stringify({ decision: input.decision, note: input.note })
    }
  );
}

export function seedTournament(
  tournamentId: string,
  input: {
    mode: "registration_order" | "random" | "reputation" | "manual";
    entry_ids?: string[];
    reason?: string;
  }
) {
  return apiRequest<{ entries: TournamentEntry[] }>(`/tournaments/${encodeURIComponent(tournamentId)}/seeding`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function generateTournamentStructure(
  tournamentId: string,
  input: {
    force?: boolean;
    reason?: string;
  }
) {
  return apiRequest<{ stages: number; rounds: number; matches: number; entries: number }>(
    `/tournaments/${encodeURIComponent(tournamentId)}/structure`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export function linkTournamentMatchRooms(
  tournamentId: string,
  input: {
    round_id?: string;
    match_id?: string;
    reason?: string;
    stepUpToken: string;
  }
) {
  return apiRequest<{
    linked: number;
    skipped: number;
    rooms: Array<{ tournament_match_id: string; match_room_id: string; room_code: string; already_linked?: boolean }>;
    skipped_matches: Array<{ tournament_match_id: string; reason: string; side_count: number; resolved_side_count: number }>;
  }>(`/tournaments/${encodeURIComponent(tournamentId)}/match-rooms`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify(input)
  });
}

export type TournamentCumulativeScoreResultInput = {
  entry_id: string;
  placement?: number;
  score?: number;
  kills?: number;
  time_ms?: number;
  bonus_points?: number;
  penalty_points?: number;
  metadata?: Record<string, unknown>;
};

export function applyTournamentCumulativeScores(
  tournamentId: string,
  input: {
    match_id: string;
    results: TournamentCumulativeScoreResultInput[];
    reason?: string;
    metadata?: Record<string, unknown>;
    stepUpToken: string;
  }
) {
  return apiRequest<{
    match_id: string;
    results: Array<{ entry_id: string; placement: number; total_points: number }>;
    completed: boolean;
  }>(`/tournaments/${encodeURIComponent(tournamentId)}/cumulative-scores`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({
      match_id: input.match_id,
      results: input.results,
      reason: input.reason,
      metadata: input.metadata
    })
  });
}

export function reviewTournamentMatchResult(
  tournamentId: string,
  matchId: string,
  input: {
    decision: TournamentResultReviewDecision;
    winning_entry_id?: string;
    penalized_entry_id?: string;
    result_claim_id?: string;
    score_summary?: string;
    note?: string;
    metadata?: Record<string, unknown>;
    stepUpToken: string;
  }
) {
  return apiRequest<{ review: TournamentMatchResultReview }>(
    `/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}/result-review`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: JSON.stringify({
        decision: input.decision,
        winning_entry_id: input.winning_entry_id,
        penalized_entry_id: input.penalized_entry_id,
        result_claim_id: input.result_claim_id,
        score_summary: input.score_summary,
        note: input.note,
        metadata: input.metadata
      })
    }
  );
}

export function reserveTournamentSettlement(
  tournamentId: string,
  input: { notes?: string; stepUpToken: string }
) {
  return apiRequest<{ settlement: TournamentSettlement; payouts: TournamentPayout[] }>(
    `/tournaments/${encodeURIComponent(tournamentId)}/settlement`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: JSON.stringify({ notes: input.notes })
    }
  );
}

export function reserveTournamentRefunds(
  tournamentId: string,
  input: { reason: string; stepUpToken: string }
) {
  return apiRequest<{ refunds: TournamentRefund[] }>(
    `/tournaments/${encodeURIComponent(tournamentId)}/refunds`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: JSON.stringify({ reason: input.reason })
    }
  );
}

export function listTournamentSettlements(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<{ settlements: TournamentSettlement[] }>(`/admin/settlements/tournament-settlements${query}`);
}

export function listTournamentPayouts(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<{ payouts: TournamentPayout[] }>(`/admin/settlements/tournament-payouts${query}`);
}

export function completeTournamentPayout(
  payoutId: string,
  input: { payout_reference?: string; completion_proof_url: string; stepUpToken: string }
) {
  return apiRequest<{ settlement: TournamentSettlement; payout: TournamentPayout }>(
    `/admin/settlements/tournament-payouts/${encodeURIComponent(payoutId)}/complete`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: JSON.stringify({
        payout_reference: input.payout_reference,
        completion_proof_url: input.completion_proof_url
      })
    }
  );
}

export function updateTournamentPayoutInstructions(
  payoutId: string,
  input: {
    recipient_name?: string;
    bank_name?: string;
    account_number?: string;
    bank_code?: string;
    payout_note?: string;
    use_fallback?: boolean;
    stepUpToken: string;
  }
) {
  return apiRequest<{ payout: TournamentPayout }>(
    `/admin/settlements/tournament-payouts/${encodeURIComponent(payoutId)}/instructions`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: JSON.stringify({
        recipient_name: input.recipient_name,
        bank_name: input.bank_name,
        account_number: input.account_number,
        bank_code: input.bank_code,
        payout_note: input.payout_note,
        use_fallback: input.use_fallback
      })
    }
  );
}

export function listTournamentRefunds(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<{ refunds: TournamentRefund[] }>(`/admin/settlements/tournament-refunds${query}`);
}

export function completeTournamentRefund(
  refundId: string,
  input: { refund_reference?: string; completion_proof_url: string; stepUpToken: string }
) {
  return apiRequest<{ refund: TournamentRefund }>(
    `/admin/settlements/tournament-refunds/${encodeURIComponent(refundId)}/complete`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: JSON.stringify({
        refund_reference: input.refund_reference,
        completion_proof_url: input.completion_proof_url
      })
    }
  );
}

export function updateTournamentRefundInstructions(
  refundId: string,
  input: {
    recipient_name?: string;
    bank_name?: string;
    account_number?: string;
    bank_code?: string;
    payout_note?: string;
    use_fallback?: boolean;
    stepUpToken: string;
  }
) {
  return apiRequest<{ refund: TournamentRefund }>(
    `/admin/settlements/tournament-refunds/${encodeURIComponent(refundId)}/instructions`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: JSON.stringify({
        recipient_name: input.recipient_name,
        bank_name: input.bank_name,
        account_number: input.account_number,
        bank_code: input.bank_code,
        payout_note: input.payout_note,
        use_fallback: input.use_fallback
      })
    }
  );
}

export function getProfileMe(view: "summary" | "full" = "full") {
  return apiRequest<ProfileMe>(`/profiles/me${queryString({ view })}`);
}

export function getProfileGameAccounts() {
  return apiRequest<{ game_accounts: UserGameAccount[] }>("/profiles/me/game-accounts");
}

export function getProfilePayoutProfile() {
  return apiRequest<{ payout_profile: PlayerPayoutProfile | null }>("/profiles/me/payout-profile");
}

export function getProfileSettlementHistory(limit = 10) {
  return apiRequest<{ payout_history: MatchPayout[]; refund_history: MatchRefund[] }>(
    `/profiles/me/settlements${queryString({ limit })}`
  );
}

export function upsertPlayerPayoutProfile(input: {
  recipient_name: string;
  bank_name: string;
  account_number: string;
  bank_code?: string;
  payout_note?: string;
  currency?: string;
}) {
  return apiRequest<{ payout_profile: PlayerPayoutProfile }>("/profiles/me/payout-profile", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export function updatePlayerProfile(input: {
  username: string;
  display_name?: string;
  region: string;
  city?: string;
  campus?: string;
  timezone: string;
  bio?: string;
  visibility: PlayerProfile["visibility"];
  age_confirmed: boolean;
}) {
  return apiRequest<{ profile: PlayerProfile }>("/profiles/me", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export function upsertGameAccount(input: {
  game_slug?: string;
  handle: string;
  external_uid?: string;
  platform?: string;
  region?: string;
  is_primary?: boolean;
}) {
  return apiRequest<{ game_account: UserGameAccount }>("/profiles/me/game-accounts", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getPlayerTrustSummary(userId: string) {
  return apiRequest<{ trust: PlayerTrustSummary }>(`/profiles/trust/${encodeURIComponent(userId)}`);
}

export function getAdminProfile(userId: string) {
  return apiRequest<{
    user: ProfileMe["user"];
    profile: PlayerProfile | null;
    game_accounts: UserGameAccount[];
    risk_flags: UserRiskFlag[];
  }>(`/profiles/admin/${encodeURIComponent(userId)}`);
}

export function listAdminGameAccounts(status?: UserGameAccount["status"]) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<{ game_accounts: AdminGameAccount[] }>(`/profiles/admin/game-accounts${query}`);
}

export function reviewGameAccount(
  accountId: string,
  input: {
    status: UserGameAccount["status"];
    verification_notes?: string;
  }
) {
  return apiRequest<{ game_account: UserGameAccount }>(`/profiles/admin/game-accounts/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function createMatchRoom(input: {
  game_slug: string;
  ruleset_slug: string;
  entry_amount_minor: number;
  commission_bps: number;
  title?: string;
  open_on_create?: boolean;
}) {
  return apiRequest<{ room: MatchRoom }>("/match-rooms", {
    method: "POST",
    body: JSON.stringify(input),
    timeoutMs: 15_000
  });
}

export function openMatchRoom(matchRoomId: string) {
  return apiRequest<{ room: MatchRoom }>(`/match-rooms/${matchRoomId}/open`, {
    method: "POST",
    body: JSON.stringify({}),
    timeoutMs: 8_000
  });
}

export function joinMatchRoom(roomCode: string) {
  return apiRequest<{ room: MatchRoom; participant: MatchParticipant }>("/match-rooms/join", {
    method: "POST",
    body: JSON.stringify({ room_code: roomCode })
  });
}

export function getMatchRoomTimeline(matchRoomId: string) {
  return apiRequest<MatchTimeline>(`/match-rooms/${matchRoomId}/timeline`);
}

export function checkInTournamentMatchRoom(matchRoomId: string) {
  return apiRequest<{ check_in: TournamentMatchCheckIn }>(
    `/match-rooms/${encodeURIComponent(matchRoomId)}/tournament-check-in`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export function startMatchPlay(matchRoomId: string) {
  return apiRequest<{ room: MatchRoom }>(`/match-rooms/${encodeURIComponent(matchRoomId)}/start-play`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function getRoomFunding(matchRoomId: string) {
  return apiRequest<RoomFundingOverview>(`/match-rooms/${matchRoomId}/funding`);
}

export function submitManualFunding(
  matchRoomId: string,
  input: {
    amount_minor: number;
    collection_bank_name: string;
    collection_account_number: string;
    collection_account_name: string;
    transfer_reference?: string;
    sender_account_name: string;
    sender_bank_name: string;
    payout_recipient_name?: string;
    payout_bank_name?: string;
    payout_account_number?: string;
    payout_bank_code?: string;
    payout_note?: string;
    proof_url: string;
    proof_note?: string;
  }
) {
  return apiRequest<{ submission: ManualFundingSubmission }>(`/match-rooms/${matchRoomId}/funding-submissions`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function payRoomWithBalance(matchRoomId: string) {
  return apiRequest<{ room: MatchRoom; participant: MatchParticipant; hold: unknown }>(
    `/match-rooms/${encodeURIComponent(matchRoomId)}/balance-funding`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export function listFundingSubmissions(status: ManualFundingSubmissionStatus = "submitted") {
  return apiRequest<{ submissions: ManualFundingSubmission[] }>(
    `/admin/funding/submissions?status=${encodeURIComponent(status)}`
  );
}

export function reviewFundingSubmission(
  submissionId: string,
  input: { decision: "approve" | "reject"; note?: string; stepUpToken: string }
) {
  return apiRequest<{ submission: ManualFundingSubmission }>(`/admin/funding/submissions/${submissionId}/review`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({ decision: input.decision, note: input.note })
  });
}

export function getWalletOverview(view: "summary" | "full" = "full") {
  return apiRequest<WalletOverview>(`/wallet${queryString({ view })}`);
}

export function listWalletLedger(input: { limit?: number; cursor?: string } = {}) {
  return apiRequest<{ ledger_entries: WalletLedgerEntry[]; next_cursor: string | null }>(
    `/wallet/ledger${queryString(input)}`
  );
}

export function listMyWalletTopups(input: { status?: WalletTopupStatus; limit?: number; cursor?: string } = {}) {
  return apiRequest<{ topups: WalletTopup[]; next_cursor: string | null }>(
    `/wallet/topups${queryString(input)}`
  );
}

export function listMyWalletPayoutRequests(input: { status?: WalletPayoutRequestStatus; limit?: number; cursor?: string } = {}) {
  return apiRequest<{ payout_requests: WalletPayoutRequest[]; next_cursor: string | null }>(
    `/wallet/payout-requests${queryString(input)}`
  );
}

export function submitWalletTopup(input: {
  amount_minor: number;
  collection_bank_name: string;
  collection_account_number: string;
  collection_account_name: string;
  transfer_reference?: string;
  sender_account_name?: string;
  sender_bank_name?: string;
  proof_url: string;
  proof_note?: string;
}) {
  return apiRequest<{ topup: WalletTopup }>("/wallet/topups", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function requestWalletPayout(input: {
  amount_minor: number;
  payout_recipient_name: string;
  payout_bank_name: string;
  payout_account_number: string;
  payout_bank_code?: string;
  payout_note?: string;
}) {
  return apiRequest<{ payout_request: WalletPayoutRequest; ledger_entries: WalletLedgerEntry[] }>("/wallet/payout-requests", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function listWalletTopups(status: WalletTopupStatus = "submitted") {
  return apiRequest<{ topups: WalletTopup[] }>(`/admin/wallet/topups?status=${encodeURIComponent(status)}`);
}

export function listWalletPayoutRequests(status: WalletPayoutRequestStatus = "requested") {
  return apiRequest<{ payout_requests: WalletPayoutRequest[] }>(
    `/admin/wallet/payout-requests?status=${encodeURIComponent(status)}`
  );
}

export function getAdminWalletDashboard(input: {
  userId?: string;
  matchRoomId?: string;
  tournamentId?: string;
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (input.userId) params.set("user_id", input.userId);
  if (input.matchRoomId) params.set("match_room_id", input.matchRoomId);
  if (input.tournamentId) params.set("tournament_id", input.tournamentId);
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  return apiRequest<AdminWalletDashboard>(`/admin/wallet/dashboard${query ? `?${query}` : ""}`);
}

export function reviewWalletTopup(
  topupId: string,
  input: { decision: "approve" | "reject"; note?: string; stepUpToken: string }
) {
  return apiRequest<{ topup: WalletTopup; ledger_entries: WalletLedgerEntry[] }>(`/admin/wallet/topups/${topupId}/review`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({ decision: input.decision, note: input.note })
  });
}

export function reviewWalletPayoutRequest(
  payoutRequestId: string,
  input: { decision: "mark_paid" | "reject"; payment_reference?: string; note?: string; stepUpToken: string }
) {
  return apiRequest<{ payout_request: WalletPayoutRequest; ledger_entries: WalletLedgerEntry[] }>(
    `/admin/wallet/payout-requests/${payoutRequestId}/review`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: JSON.stringify({
        decision: input.decision,
        payment_reference: input.payment_reference,
        note: input.note
      })
    }
  );
}

export function getRoomResults(matchRoomId: string) {
  return apiRequest<RoomResultOverview>(`/match-rooms/${matchRoomId}/results`);
}

export function submitResultClaim(
  matchRoomId: string,
  input: {
    claimed_winner_participant_id: string;
    score_summary?: string;
    note?: string;
    evidence: Array<{
      evidence_type: EvidenceItemType;
      uri?: string;
      title: string;
      notes?: string;
    }>;
  }
) {
  return apiRequest<{ claim: MatchResultClaim }>(`/match-rooms/${matchRoomId}/result-claims`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function respondToResultClaim(
  claimId: string,
  input: {
    response: "agree" | "dispute";
    note?: string;
    evidence?: Array<{
      evidence_type: EvidenceItemType;
      uri?: string;
      title: string;
      notes?: string;
    }>;
  }
) {
  return apiRequest<{ response: MatchResultResponse }>(`/match-rooms/result-claims/${claimId}/responses`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function listResultClaims(status: ResultClaimStatus = "submitted") {
  return apiRequest<{ claims: MatchResultClaim[] }>(
    `/admin/results/claims?status=${encodeURIComponent(status)}`
  );
}

export function reviewResultClaim(
  claimId: string,
  input: { decision: ResultReviewDecision; note?: string; stepUpToken: string }
) {
  return apiRequest<{ claim: MatchResultClaim }>(`/admin/results/claims/${claimId}/review`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({ decision: input.decision, note: input.note })
  });
}

export function listSettlements(status?: SettlementStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<{ settlements: MatchSettlement[] }>(`/admin/settlements/settlements${query}`);
}

export function reserveSettlement(input: { match_room_id: string; notes?: string; stepUpToken: string }) {
  return apiRequest<{ settlement: MatchSettlement; payout: MatchPayout }>("/admin/settlements/settlements", {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({ match_room_id: input.match_room_id, notes: input.notes })
  });
}

export function listPayouts(status?: PayoutStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<{ payouts: MatchPayout[] }>(`/admin/settlements/payouts${query}`);
}

export function completePayout(
  payoutId: string,
  input: { payout_reference?: string; completion_proof_url: string; stepUpToken: string }
) {
  return apiRequest<{ settlement: MatchSettlement; payout: MatchPayout }>(
    `/admin/settlements/payouts/${payoutId}/complete`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: JSON.stringify({
        payout_reference: input.payout_reference,
        completion_proof_url: input.completion_proof_url
      })
    }
  );
}

export function updatePayoutInstructions(
  payoutId: string,
  input: {
    recipient_name?: string;
    bank_name?: string;
    account_number?: string;
    bank_code?: string;
    payout_note?: string;
    use_fallback?: boolean;
    stepUpToken: string;
  }
) {
  return apiRequest<{ payout: MatchPayout }>(`/admin/settlements/payouts/${payoutId}/instructions`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({
      recipient_name: input.recipient_name,
      bank_name: input.bank_name,
      account_number: input.account_number,
      bank_code: input.bank_code,
      payout_note: input.payout_note,
      use_fallback: input.use_fallback
    })
  });
}

export function listRefunds(status?: RefundStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<{ refunds: MatchRefund[] }>(`/admin/settlements/refunds${query}`);
}

export function reserveRefunds(input: { match_room_id: string; reason: string; stepUpToken: string }) {
  return apiRequest<{ refunds: MatchRefund[] }>("/admin/settlements/refunds", {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({ match_room_id: input.match_room_id, reason: input.reason })
  });
}

export function completeRefund(
  refundId: string,
  input: { refund_reference?: string; completion_proof_url: string; stepUpToken: string }
) {
  return apiRequest<{ refund: MatchRefund }>(`/admin/settlements/refunds/${refundId}/complete`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({
      refund_reference: input.refund_reference,
      completion_proof_url: input.completion_proof_url
    })
  });
}

export function updateRefundInstructions(
  refundId: string,
  input: {
    recipient_name?: string;
    bank_name?: string;
    account_number?: string;
    bank_code?: string;
    payout_note?: string;
    use_fallback?: boolean;
    stepUpToken: string;
  }
) {
  return apiRequest<{ refund: MatchRefund }>(`/admin/settlements/refunds/${refundId}/instructions`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({
      recipient_name: input.recipient_name,
      bank_name: input.bank_name,
      account_number: input.account_number,
      bank_code: input.bank_code,
      payout_note: input.payout_note,
      use_fallback: input.use_fallback
    })
  });
}

export function getRiskDashboard() {
  return apiRequest<RiskDashboard>("/admin/risk/dashboard");
}

export function getChatPerformanceMetrics() {
  return apiRequest<ChatPerformanceMetrics>("/community/chat/performance-metrics", { timeoutMs: 8_000 });
}

export function listAdminTeamMembers() {
  return apiRequest<{ members: AdminTeamMember[] }>("/admin/team/members");
}

export function updateAdminTeamMemberRole(input: {
  userId: string;
  role: Exclude<TeamRole, "owner">;
  note?: string;
  stepUpToken: string;
}) {
  return apiRequest<{ members: AdminTeamMember[] }>(`/admin/team/members/${encodeURIComponent(input.userId)}/role`, {
    method: "PATCH",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({
      role: input.role,
      note: input.note
    })
  });
}

export function listEvidenceAccessEvents(limit = 50) {
  return apiRequest<{ events: SecurityEvent[] }>(`/evidence/access-events?limit=${encodeURIComponent(limit.toString())}`);
}

export function listRiskFlags(status: UserRiskFlag["status"] = "open") {
  return apiRequest<{ flags: UserRiskFlag[] }>(`/admin/risk/flags?status=${encodeURIComponent(status)}`);
}

export function createRiskFlag(input: {
  user_id: string;
  flag_type: string;
  severity: UserRiskFlag["severity"];
  summary: string;
}) {
  return apiRequest<{ flag: UserRiskFlag }>("/admin/risk/flags", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateRiskFlagStatus(flagId: string, status: UserRiskFlag["status"]) {
  return apiRequest<{ flag: UserRiskFlag }>(`/admin/risk/flags/${flagId}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function listModerationActions() {
  return apiRequest<{ actions: ModerationAction[] }>("/admin/risk/actions");
}

export function createModerationAction(input: {
  target_user_id?: string;
  match_room_id?: string;
  action_type: ModerationAction["action_type"];
  severity: ModerationAction["severity"];
  summary: string;
  stepUpToken: string;
}) {
  return apiRequest<{ action: ModerationAction }>("/admin/risk/actions", {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: JSON.stringify({
      target_user_id: input.target_user_id,
      match_room_id: input.match_room_id,
      action_type: input.action_type,
      severity: input.severity,
      summary: input.summary
    })
  });
}

export function listRoomHolds(status: RoomModerationHold["status"] = "active") {
  return apiRequest<{ holds: RoomModerationHold[] }>(`/admin/risk/room-holds?status=${encodeURIComponent(status)}`);
}

export function createRoomHold(input: {
  match_room_id: string;
  reason: string;
  severity: RoomModerationHold["severity"];
}) {
  return apiRequest<{ hold: RoomModerationHold }>("/admin/risk/room-holds", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function releaseRoomHold(holdId: string, releaseNote?: string) {
  return apiRequest<{ hold: RoomModerationHold }>(`/admin/risk/room-holds/${holdId}/release`, {
    method: "POST",
    body: JSON.stringify({ release_note: releaseNote })
  });
}

export function listNotifications(status: UserNotification["status"] = "unread") {
  return apiRequest<{ notifications: UserNotification[] }>(
    `/community/notifications?status=${encodeURIComponent(status)}`
  );
}

export function getNotificationBootstrap() {
  return apiRequest<{
    notifications: UserNotification[];
    invites: RoomInvite[];
    requests: ChatDmRequest[];
    preferences: NotificationPreference;
  }>("/community/notifications/bootstrap");
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<{ notification: UserNotification }>(`/community/notifications/${notificationId}/read`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function markAllNotificationsRead() {
  return apiRequest<{ updated_count: number }>("/community/notifications/read-all", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function getNotificationPreferences() {
  return apiRequest<{ preferences: NotificationPreference }>("/community/notification-preferences");
}

export function updateNotificationPreferences(input: Omit<NotificationPreference, "user_id">) {
  return apiRequest<{ preferences: NotificationPreference }>("/community/notification-preferences", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export function listRoomInvites(status: RoomInvite["status"] = "pending") {
  return apiRequest<{ invites: RoomInvite[] }>(`/community/invites?status=${encodeURIComponent(status)}`);
}

export function createRoomInvite(input: { match_room_id?: string; match_room_code?: string; invitee_user_id?: string; invitee_username?: string; message?: string }) {
  return apiRequest<{ invite: RoomInvite }>("/community/invites", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function respondToRoomInvite(inviteId: string, response: "accepted" | "declined") {
  return apiRequest<{ invite: RoomInvite }>(`/community/invites/${inviteId}/respond`, {
    method: "POST",
    body: JSON.stringify({ response })
  });
}

export function listActivityFeed() {
  return apiRequest<{ feed: ActivityFeedItem[] }>("/community/feed");
}

export function listChatChannels() {
  return apiRequest<{ channels: ChatChannel[] }>("/community/channels");
}

export function listChatBootstrap(filters: { channel?: string; limit?: number; view?: "list" | "full" } = {}) {
  return apiRequest<{
    current_user: {
      id: string;
      email?: string;
      role: "player" | "support" | "moderator" | "admin" | "owner";
      status: "active" | "locked" | "disabled";
    };
    channels: ChatChannel[];
    active_channel: ChatChannel | null;
    messages: ChatMessage[];
    pinned_messages: ChatPinnedMessage[];
    presence: ChatPresenceSummary;
    page_info: ChatMessagePageInfo;
    read_boundary: string | null;
    dm_requests: ChatDmRequest[];
  }>(`/community/chat/bootstrap${queryString(filters)}`);
}

export function createChatChannel(input: {
  channel_type: "game" | "tournament" | "match_room" | "group";
  title?: string;
  slug?: string;
  description?: string;
  visibility?: "public" | "members" | "private";
  game_id?: string;
  game_slug?: string;
  tournament_id?: string;
  match_room_id?: string;
}) {
  return apiRequest<{ channel: ChatChannel }>("/community/channels", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function listChatMessages(channelIdOrSlug: string, filters: { before?: string; after?: string; cursor?: string; limit?: number; view?: "list" | "full" } = {}) {
  return apiRequest<{ channel: ChatChannel; messages: ChatMessage[]; pinned_messages: ChatPinnedMessage[]; presence: ChatPresenceSummary; page_info: ChatMessagePageInfo; read_boundary: string | null }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages${queryString(filters)}`
  );
}

export function searchChatMessages(channelIdOrSlug: string, filters: {
  q?: string;
  user?: string;
  date_from?: string;
  date_to?: string;
  mentions?: "any" | "me";
  links?: boolean;
  pinned?: boolean;
  cursor?: string;
  limit?: number;
}) {
  const query = {
    ...filters,
    links: filters.links === undefined ? undefined : String(filters.links),
    pinned: filters.pinned === undefined ? undefined : String(filters.pinned)
  };
  return apiRequest<{ channel: ChatChannel; messages: ChatMessage[]; page_info: ChatSearchPageInfo }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/search${queryString(query)}`
  );
}

export function getChatMessageContext(channelIdOrSlug: string, messageId: string) {
  return apiRequest<{ channel: ChatChannel; target_message_id: string; messages: ChatMessage[] }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/context`
  );
}

export function getChatPresence(channelIdOrSlug: string) {
  return apiRequest<{ channel: ChatChannel; presence: ChatPresenceSummary }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/presence`
  );
}

export function sendChatHeartbeat(channelIdOrSlug: string) {
  return apiRequest<{ channel: ChatChannel; presence: ChatPresenceSummary }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/heartbeat`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export function setChatTyping(channelIdOrSlug: string, input: { is_typing: boolean }) {
  return apiRequest<{ channel: ChatChannel; presence: ChatPresenceSummary }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/typing`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function markChatRead(channelIdOrSlug: string, input: { message_id?: string } = {}) {
  return apiRequest<{ channel: ChatChannel }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/read`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function listDmRequests() {
  return apiRequest<{ requests: ChatDmRequest[] }>("/community/dm-requests");
}

export function createDmRequest(input: { recipient_user_id?: string; recipient_username?: string; intro_message?: string }) {
  return apiRequest<{ request: ChatDmRequest }>("/community/dm-requests", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function respondDmRequest(requestId: string, response: "accepted" | "declined") {
  return apiRequest<{ request: ChatDmRequest; channel: ChatChannel | null }>(
    `/community/dm-requests/${encodeURIComponent(requestId)}/respond`,
    {
      method: "POST",
      body: JSON.stringify({ response })
    }
  );
}

export function blockChatUser(input: { user_id?: string; username?: string; reason?: string }) {
  return apiRequest<{ block: ChatUserBlock }>("/community/users/block", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function reportChatUser(input: { user_id?: string; username?: string; reason: string }) {
  return apiRequest<{ flag: UserRiskFlag }>("/community/users/report", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getDmAbuseQueue() {
  return apiRequest<{
    requests: ChatDmRequest[];
    blocks: ChatUserBlock[];
    retention_policy: Record<string, string>;
  }>("/community/dm-abuse");
}

export function sendChatMessage(channelIdOrSlug: string, input: { body: string; client_message_id?: string; reply_to_message_id?: string; attachment_ids?: string[] }) {
  return apiRequest<{ channel: ChatChannel; message: ChatMessage }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export function reactChatMessage(channelIdOrSlug: string, messageId: string, input: { reaction: string }) {
  return apiRequest<{ message: ChatMessage; action: "added" | "removed" }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/reactions`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export function editChatMessage(channelIdOrSlug: string, messageId: string, input: { body: string }) {
  return apiRequest<{ channel: ChatChannel; message: ChatMessage }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input)
    }
  );
}

export function pinChatMessage(channelIdOrSlug: string, messageId: string, input: { reason?: string }) {
  return apiRequest<{ pin: ChatPinnedMessage; pinned_messages: ChatPinnedMessage[] }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/pin`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export function unpinChatMessage(channelIdOrSlug: string, messageId: string) {
  return apiRequest<{ pin: ChatPinnedMessage | null; pinned_messages: ChatPinnedMessage[] }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/unpin`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export function reportChatMessage(channelIdOrSlug: string, messageId: string, input: { reason: string }) {
  return apiRequest<{ event: ChatModerationEvent }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/report`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export function listChatModerationQueue() {
  return apiRequest<{ events: ChatModerationEvent[] }>("/community/chat-moderation");
}

export function getChatMessageEditHistory(channelIdOrSlug: string, messageId: string) {
  return apiRequest<{ message: ChatMessage; edits: ChatMessageEdit[] }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/edits`
  );
}

export function hideChatMessage(channelIdOrSlug: string, messageId: string, input: { reason: string }) {
  return apiRequest<{ message: ChatMessage; event: ChatModerationEvent }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/hide`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export function deleteChatMessage(channelIdOrSlug: string, messageId: string, input: { reason?: string } = {}) {
  return apiRequest<{ message: ChatMessage; event: ChatModerationEvent }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/delete`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export function muteChatMember(channelIdOrSlug: string, input: { user_id: string; duration_minutes: number; reason: string }) {
  return apiRequest<{ event: ChatModerationEvent }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/members/mute`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export function getCommunitySocialProof() {
  return publicApiRequest<{ metrics: CommunitySocialProofMetrics }>("/community/social-proof", { next: { revalidate: 60 } });
}

export function listCommunityAnnouncements(filters: Omit<CommunityAnnouncementFilters, "status"> = {}) {
  return publicApiRequest<CommunityAnnouncementListResponse>(`/community/announcements${queryString(filters)}`, { next: { revalidate: 60 } });
}

export function listCommunityLivestreams(input: {
  target_type: CommunityLivestreamTargetType;
  tournament_id?: string;
  match_room_id?: string;
}) {
  return publicApiRequest<CommunityLivestreamListResponse>(`/community/livestreams${queryString(input)}`, { next: { revalidate: 30 } });
}

export function listAccessibleLivestreams(input: {
  target_type: CommunityLivestreamTargetType;
  tournament_id?: string;
  match_room_id?: string;
}) {
  return apiRequest<CommunityLivestreamListResponse>(`/community/livestreams/view${queryString(input)}`);
}

export function listManageableLivestreams(input: {
  target_type: CommunityLivestreamTargetType;
  tournament_id?: string;
  match_room_id?: string;
}) {
  return apiRequest<CommunityLivestreamListResponse>(`/community/livestreams/manage${queryString(input)}`);
}

export function createCommunityLivestream(input: {
  target_type: CommunityLivestreamTargetType;
  tournament_id?: string;
  match_room_id?: string;
  provider?: CommunityLivestreamProvider;
  visibility: CommunityLivestreamVisibility;
  stream_role?: CommunityLivestreamStreamRole;
  playback_status?: CommunityLivestreamPlaybackStatus;
  title: string;
  stream_url: string;
  display_order?: number;
  is_featured?: boolean;
}) {
  return apiRequest<{ livestream: CommunityLivestreamLink }>("/community/livestreams", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function archiveCommunityLivestream(livestreamId: string) {
  return apiRequest<{ livestream: CommunityLivestreamLink }>(
    `/community/livestreams/${encodeURIComponent(livestreamId)}/archive`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export function listManageableAnnouncements(filters: CommunityAnnouncementFilters = {}) {
  return apiRequest<CommunityAnnouncementListResponse>(`/community/announcements/manage${queryString(filters)}`);
}

export function getCommunityAnnouncement(announcementId: string) {
  return publicApiRequest<{ announcement: CommunityAnnouncement }>(
    `/community/announcements/${encodeURIComponent(announcementId)}`,
    { next: { revalidate: 300 } }
  );
}

export function createCommunityAnnouncement(input: {
  scope: CommunityAnnouncementScope;
  tournament_id?: string;
  game_id?: string;
  category: CommunityAnnouncementCategory;
  priority: CommunityAnnouncementPriority;
  title: string;
  summary?: string;
  body: string;
  cta_label?: string;
  cta_url?: string;
  publish_now?: boolean;
}) {
  return apiRequest<{ announcement: CommunityAnnouncement }>("/community/announcements", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateCommunityAnnouncement(
  announcementId: string,
  input: {
    game_id?: string;
    category: CommunityAnnouncementCategory;
    priority: CommunityAnnouncementPriority;
    title: string;
    summary?: string;
    body: string;
    cta_label?: string;
    cta_url?: string;
  }
) {
  return apiRequest<{ announcement: CommunityAnnouncement }>(`/community/announcements/${encodeURIComponent(announcementId)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function publishCommunityAnnouncement(announcementId: string) {
  return apiRequest<{ announcement: CommunityAnnouncement }>(
    `/community/announcements/${encodeURIComponent(announcementId)}/publish`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export function archiveCommunityAnnouncement(announcementId: string) {
  return apiRequest<{ announcement: CommunityAnnouncement }>(
    `/community/announcements/${encodeURIComponent(announcementId)}/archive`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export function listLeaderboard(filters: CommunityLeaderboardFilters = {}) {
  return publicApiRequest<CommunityLeaderboardResponse>(`/community/leaderboard${queryString(filters)}`, { next: { revalidate: 120 } });
}

export function getCommunityPlayerRanking(userId: string, filters: Omit<CommunityLeaderboardFilters, "limit"> = {}) {
  return publicApiRequest<CommunityPlayerRankingResponse>(
    `/community/leaderboard/players/${encodeURIComponent(userId)}${queryString(filters)}`,
    { next: { revalidate: 120 } }
  );
}

export function listCommunityHighlights(limit = 8) {
  return publicApiRequest<CommunityHighlightsResponse>(`/community/highlights${queryString({ limit })}`, { next: { revalidate: 60 } });
}

export function getTournamentWinnerPage(tournamentId: string) {
  return publicApiRequest<CommunityTournamentWinnerPage>(
    `/community/winners/tournaments/${encodeURIComponent(tournamentId)}`,
    { next: { revalidate: 300 } }
  );
}

export function getMatchWinnerPage(matchRoomId: string) {
  return publicApiRequest<CommunityMatchWinnerPage>(
    `/community/winners/matches/${encodeURIComponent(matchRoomId)}`,
    { next: { revalidate: 300 } }
  );
}

export function listCommunityClans(filters: CommunityLeaderboardFilters = {}) {
  return publicApiRequest<CommunityClanListResponse>(`/community/clans${queryString(filters)}`, { next: { revalidate: 300 } });
}

export function getCommunityClan(clanIdOrSlug: string) {
  return publicApiRequest<CommunityClanDetailResponse>(
    `/community/clans/${encodeURIComponent(clanIdOrSlug)}`,
    { next: { revalidate: 300 } }
  );
}

export function getMyCommunityClan() {
  return apiRequest<MyCommunityClanResponse>("/community/clans/mine");
}

export function upsertCommunityClan(input: {
  name: string;
  tag?: string;
  description?: string;
  region: string;
  city?: string;
  campus?: string;
  avatar_url?: string;
  banner_url?: string;
  visibility: "public" | "invite_only" | "hidden";
  game_focus: string[];
}) {
  return apiRequest<{ clan: MyCommunityClanResponse["clan"] }>("/community/clans/mine", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export function getMyReferralProgram() {
  return apiRequest<MyReferralProgramResponse>("/community/referrals/me");
}

export function listStreamingAccounts() {
  return apiRequest<{ accounts: StreamingConnectedAccount[] }>("/streaming/accounts");
}

export function startStreamingOauth(input: { provider: StreamingProvider; redirect_path?: string }) {
  return apiRequest<{ authorization_url: string }>("/streaming/oauth/start", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function completeStreamingOauth(input: { state: string; code: string }) {
  return publicApiRequest<{ account: StreamingConnectedAccount; redirect_path: string }>("/streaming/oauth/complete", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function connectManualStreamingAccount(input: {
  provider: StreamingProvider;
  channel_url: string;
  display_name: string;
  provider_account_id?: string;
  provider_login?: string;
}) {
  return apiRequest<{ account: StreamingConnectedAccount }>("/streaming/accounts/manual", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function syncStreamingAccount(accountId: string) {
  return apiRequest<{ account: StreamingConnectedAccount }>(`/streaming/accounts/${encodeURIComponent(accountId)}/sync`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function disconnectStreamingAccount(accountId: string) {
  return apiRequest<{ account: StreamingConnectedAccount }>(`/streaming/accounts/${encodeURIComponent(accountId)}`, {
    method: "DELETE"
  });
}

export function listTournamentOfficialStreamers(tournamentId: string) {
  return publicApiRequest<{ streamers: StreamingConnectedAccount[] }>(
    `/streaming/tournaments/${encodeURIComponent(tournamentId)}/streamers`
  );
}

export function assignTournamentOfficialStreamer(tournamentId: string, input: {
  streaming_account_id: string;
  label?: string;
  is_primary?: boolean;
}) {
  return apiRequest<{ assignment: TournamentOfficialStreamer; account: StreamingConnectedAccount }>(
    `/streaming/tournaments/${encodeURIComponent(tournamentId)}/streamers`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}
