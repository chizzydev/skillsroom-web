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
    return { href: actionUrl, label: labelForHref(actionUrl, notification.notification_type) };
  }

  const roomId = notification.match_room_id ?? metadataString(notification, "match_room_id");
  if (roomId) return { href: `/matches/${encodeURIComponent(roomId)}`, label: "Open room" };

  const channelSlug = metadataString(notification, "channel_slug");
  if (channelSlug) return { href: `/chat?channel=${encodeURIComponent(channelSlug)}`, label: "Open chat" };

  const tournamentId = metadataString(notification, "tournament_id");
  if (tournamentId) return { href: `/tournaments/${encodeURIComponent(tournamentId)}`, label: "Open tournament" };

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
