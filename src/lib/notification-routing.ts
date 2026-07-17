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
  if (href.startsWith("/matches/") || href.startsWith("/rooms/") || notificationType.includes("match")) return "Open room";
  if (href.startsWith("/chat")) return "Open chat";
  if (href.startsWith("/wallet") || notificationType.includes("wallet") || notificationType.includes("payout")) return "Open wallet";
  if (href.startsWith("/tournaments/") || notificationType.includes("tournament")) return "Open tournament";
  if (href.startsWith("/community")) return "Open update";
  if (href.startsWith("/profile")) return "Open profile";
  return "Open";
}

function resultResponseHref(href: string) {
  if (!href.startsWith("/matches/")) return href;
  if (!href.includes("#result")) return href;
  return href.replace(/#result$/, "#result-response");
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

export function notificationAction(notification: UserNotification): NotificationAction {
  const announcementId = metadataString(notification, "announcement_id");
  if (notification.notification_type.includes("announcement") && announcementId) {
    return {
      href: `/community/announcements/${encodeURIComponent(announcementId)}`,
      label: "Open update"
    };
  }

  const actionUrl = internalHref(notification.action_url);
  if (actionUrl) {
    if (notification.notification_type.startsWith("match_result_response")) {
      const href = resultResponseHref(actionUrl);
      return { href, label: "Review result" };
    }
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
    return { href: actionUrl, label: labelForHref(actionUrl, notification.notification_type) };
  }

  const roomId = notification.match_room_id ?? metadataString(notification, "match_room_id");
  if (roomId) return { href: `/matches/${encodeURIComponent(roomId)}`, label: "Open room" };

  const channelSlug = metadataString(notification, "channel_slug");
  if (channelSlug) return { href: `/chat?channel=${encodeURIComponent(channelSlug)}`, label: "Open chat" };

  const tournamentId = metadataString(notification, "tournament_id");
  if (tournamentId) return { href: tournamentHref(notification, tournamentId), label: "Open tournament" };

  if (announcementId) {
    return { href: `/community/announcements/${encodeURIComponent(announcementId)}`, label: "Open update" };
  }

  if (notification.notification_type.includes("wallet") || notification.notification_type.includes("payout")) {
    return { href: "/wallet", label: "Open wallet" };
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
