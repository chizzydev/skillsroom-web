import type { UserNotification } from "@/lib/match-room-api";

type NotificationAction = {
  href: string | null;
  label: string;
};

function metadataString(notification: UserNotification, key: string) {
  const value = notification.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function internalHref(value: string | null | undefined) {
  if (!value?.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

function labelForHref(href: string | null, notificationType: string) {
  if (!href) return "Open";
  if (notificationType === "platform_announcement" || notificationType === "tournament_announcement") return "Open update";
  if (notificationType === "tournament_match_ready") return "Open match room";
  if (notificationType.startsWith("tournament_result_")) return href.startsWith("/matches/") ? "Open match result" : "Open result reviews";
  if (notificationType === "tournament_registration" || notificationType === "tournament_check_in") return "Open registration";
  if (notificationType === "tournament_host_access_granted") return "Open host tools";
  if (notificationType === "tournament_payout_queued" || notificationType === "tournament_refund_queued" || notificationType === "tournament_wallet_refund") return "Open prizes";
  if (notificationType === "match_result_response_required" || notificationType === "match_result_response_reminder") return "Respond to result";
  if (notificationType === "match_result_response_overdue") return "Review result";
  if (notificationType.startsWith("match_result_")) return "Open result";
  if (notificationType === "room_invite") return "Open invite";
  if (notificationType.startsWith("room_invite_")) return "Open room";
  if (notificationType === "chat_dm_request") return "Open DM request";
  if (notificationType.startsWith("chat_dm_request_")) return href.startsWith("/chat") ? "Open DM" : "Open request";
  if (notificationType === "match_payout_queued" || notificationType === "match_refund_queued") return "Open settlement";
  if (href.startsWith("/matches/") || href.startsWith("/rooms/") || notificationType.includes("match")) return "Open room";
  if (href.startsWith("/chat")) return "Open chat";
  if (href.startsWith("/wallet") || notificationType.includes("wallet") || notificationType.includes("payout")) return "Open wallet";
  if (href.startsWith("/tournaments/") || notificationType.includes("tournament")) return "Open tournament";
  if (href.startsWith("/community")) return "Open update";
  if (href.startsWith("/profile")) return "Open profile";
  return "Open";
}

function roomHref(notification: UserNotification, fallbackActionUrl?: string | null, hash = "overview") {
  const roomId = notification.match_room_id ?? metadataString(notification, "match_room_id");
  if (roomId) return `/matches/${encodeURIComponent(roomId)}#${hash}`;

  const actionUrl = internalHref(fallbackActionUrl);
  const actionRoom = actionUrl?.match(/^\/(?:matches|rooms)\/([^/?#]+)/);
  if (actionRoom?.[1]) return `/matches/${encodeURIComponent(decodeURIComponent(actionRoom[1]))}#${hash}`;

  return actionUrl ?? null;
}

function tournamentHref(notification: UserNotification, tournamentId: string) {
  const href = `/tournaments/${encodeURIComponent(tournamentId)}`;
  const type = notification.notification_type;

  if (type === "tournament_registration" || type === "tournament_check_in") return `${href}#registration`;
  if (type === "tournament_host_access_granted") return `${href}#host-controls`;
  if (type.includes("result")) return `${href}#result-reviews`;
  if (type.includes("payout") || type.includes("refund") || type.includes("wallet")) return `${href}#prizes`;
  if (type.includes("announcement")) return `${href}#announcements`;
  return href;
}

function profileHref(notification: UserNotification) {
  const type = notification.notification_type;
  if (type === "match_payout_queued" || type === "match_refund_queued") {
    return "/profile?sections=full#settlement-history";
  }
  if (type.includes("payout")) return "/profile?sections=full#payout-profile";
  if (type.includes("stream")) return "/profile?sections=full#streaming-accounts";
  if (type.includes("game_account") || type.includes("player_setup") || type.includes("profile")) return "/profile?sections=full#game-accounts";
  return "/profile?sections=full";
}

function explicitTypedAction(notification: UserNotification): NotificationAction | null {
  const type = notification.notification_type;

  if (type === "platform_announcement") {
    const announcementId = metadataString(notification, "announcement_id");
    return {
      href: announcementId ? `/community/announcements/${encodeURIComponent(announcementId)}` : internalHref(notification.action_url),
      label: "Open update"
    };
  }

  if (type === "tournament_announcement") {
    const announcementId = metadataString(notification, "announcement_id");
    const tournamentId = metadataString(notification, "tournament_id");
    return {
      href: announcementId
        ? `/community/announcements/${encodeURIComponent(announcementId)}`
        : tournamentId
          ? tournamentHref(notification, tournamentId)
          : internalHref(notification.action_url),
      label: "Open update"
    };
  }

  if (type === "tournament_match_ready") {
    return { href: roomHref(notification, notification.action_url, "overview"), label: "Open match room" };
  }

  if (type.startsWith("tournament_result_")) {
    const roomTarget = roomHref(notification, notification.action_url, "result");
    const matchResultTarget = roomTarget?.startsWith("/matches/") ? roomTarget : null;
    const tournamentId = metadataString(notification, "tournament_id");
    return {
      href: matchResultTarget ?? (tournamentId ? tournamentHref(notification, tournamentId) : internalHref(notification.action_url)),
      label: matchResultTarget ? "Open match result" : "Open result reviews"
    };
  }

  if (type === "tournament_registration" || type === "tournament_check_in" || type === "tournament_host_access_granted" || type === "tournament_payout_queued" || type === "tournament_refund_queued" || type === "tournament_wallet_refund") {
    const tournamentId = metadataString(notification, "tournament_id");
    return {
      href: tournamentId ? tournamentHref(notification, tournamentId) : internalHref(notification.action_url),
      label: labelForHref(internalHref(notification.action_url), type)
    };
  }

  if (type === "match_result_response_required" || type === "match_result_response_reminder") {
    return { href: roomHref(notification, notification.action_url, "result-response"), label: "Respond to result" };
  }

  if (type === "match_result_response_overdue") {
    return { href: roomHref(notification, notification.action_url, "result-response"), label: "Review result" };
  }

  if (type === "match_result_accepted" || type === "match_result_disputed" || type.startsWith("match_result_review_")) {
    return { href: roomHref(notification, notification.action_url, "result"), label: "Open result" };
  }

  if (type === "room_invite") {
    return { href: "/notifications#invites", label: "Open invite" };
  }

  if (type.startsWith("room_invite_")) {
    return { href: roomHref(notification, notification.action_url, "players"), label: "Open room" };
  }

  if (type === "match_payout_queued" || type === "match_refund_queued") {
    return { href: profileHref(notification), label: "Open settlement" };
  }

  if (type === "chat_dm_request") {
    return { href: "/notifications#dm-requests", label: "Open DM request" };
  }

  if (type === "chat_dm_request_accepted") {
    const channelSlug = metadataString(notification, "channel_slug");
    return { href: channelSlug ? `/chat?channel=${encodeURIComponent(channelSlug)}` : "/chat", label: "Open DM" };
  }

  if (type === "chat_dm_request_declined") {
    return { href: "/notifications#dm-requests", label: "Open request" };
  }

  return null;
}

export function notificationAction(notification: UserNotification): NotificationAction {
  const typedAction = explicitTypedAction(notification);
  if (typedAction) return typedAction;

  const announcementId = metadataString(notification, "announcement_id");
  if (notification.notification_type.includes("announcement") && announcementId) {
    return {
      href: `/community/announcements/${encodeURIComponent(announcementId)}`,
      label: "Open update"
    };
  }

  const actionUrl = internalHref(notification.action_url);
  if (actionUrl) {
    if (notification.notification_type === "tournament_match_ready" && notification.match_room_id) {
      return { href: `/matches/${encodeURIComponent(notification.match_room_id)}#overview`, label: "Open match room" };
    }
    const tournamentId = metadataString(notification, "tournament_id");
    if (notification.notification_type.startsWith("tournament_") && tournamentId && actionUrl.startsWith("/tournaments/")) {
      return { href: tournamentHref(notification, tournamentId), label: labelForHref(actionUrl, notification.notification_type) };
    }
    if (actionUrl.startsWith("/profile#settlement-history")) {
      return { href: "/profile?sections=full#settlement-history", label: labelForHref(actionUrl, notification.notification_type) };
    }
    if (actionUrl.startsWith("/profile")) {
      return { href: profileHref(notification), label: labelForHref(actionUrl, notification.notification_type) };
    }
    return { href: actionUrl, label: labelForHref(actionUrl, notification.notification_type) };
  }

  const roomId = notification.match_room_id ?? metadataString(notification, "match_room_id");
  if (roomId) return { href: `/matches/${encodeURIComponent(roomId)}#overview`, label: "Open room" };

  const channelSlug = metadataString(notification, "channel_slug");
  if (channelSlug) return { href: `/chat?channel=${encodeURIComponent(channelSlug)}`, label: "Open chat" };

  const tournamentId = metadataString(notification, "tournament_id");
  if (tournamentId) return { href: tournamentHref(notification, tournamentId), label: "Open tournament" };

  if (announcementId) {
    return { href: `/community/announcements/${encodeURIComponent(announcementId)}`, label: "Open update" };
  }

  if (notification.notification_type.includes("wallet") || notification.notification_type.includes("payout")) {
    return { href: profileHref(notification), label: labelForHref(profileHref(notification), notification.notification_type) };
  }
  if (notification.notification_type.includes("tournament")) {
    return { href: "/tournaments", label: "Open tournaments" };
  }
  if (notification.notification_type.includes("chat")) {
    return { href: "/chat", label: "Open chat" };
  }

  return { href: null, label: "Open" };
}

export function safeNotificationRedirect(href: string | null | undefined) {
  return internalHref(href) ?? "/notifications";
}
