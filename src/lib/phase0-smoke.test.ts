import { apiBaseUrl } from "./api";
import { notificationAction, safeNotificationRedirect } from "./notification-routing";
import type { UserNotification } from "./match-room-api";

if (!apiBaseUrl().startsWith("http")) {
  throw new Error("API base URL must be absolute.");
}

function notification(overrides: Partial<UserNotification>): UserNotification {
  return {
    id: "notification-test",
    user_id: "user-test",
    actor_user_id: null,
    status: "unread",
    title: "Test notification",
    body: "Test body",
    action_url: null,
    notification_type: "test",
    match_room_id: null,
    metadata: {},
    created_at: new Date(0).toISOString(),
    ...overrides
  };
}

function expectHref(name: string, value: string | null, expected: string) {
  if (value !== expected) {
    throw new Error(`${name}: expected ${expected}, received ${value ?? "null"}.`);
  }
}

expectHref(
  "result response reminder routes to the response panel even with an old room-flow URL",
  notificationAction(
    notification({
      action_url: "/matches/room-1#room-flow",
      match_room_id: "room-1",
      notification_type: "match_result_response_reminder"
    })
  ).href,
  "/matches/room-1#result-response"
);

expectHref(
  "accepted result routes to the result panel",
  notificationAction(
    notification({
      action_url: "/matches/room-1#room-flow",
      match_room_id: "room-1",
      notification_type: "match_result_accepted"
    })
  ).href,
  "/matches/room-1#result"
);

expectHref(
  "match payout routes to settlement history instead of a generic profile page",
  notificationAction(
    notification({
      action_url: "/profile",
      notification_type: "match_payout_queued"
    })
  ).href,
  "/profile?sections=full#settlement-history"
);

expectHref(
  "DM request routes to the request panel",
  notificationAction(
    notification({
      action_url: "/notifications",
      notification_type: "chat_dm_request"
    })
  ).href,
  "/notifications#dm-requests"
);

expectHref(
  "room invite routes to pending invites",
  notificationAction(
    notification({
      action_url: "/notifications",
      notification_type: "room_invite"
    })
  ).href,
  "/notifications#invites"
);

expectHref(
  "platform announcement opens the exact announcement",
  notificationAction(
    notification({
      action_url: "/community/announcements/announcement-1",
      notification_type: "platform_announcement",
      metadata: { announcement_id: "announcement-1" }
    })
  ).href,
  "/community/announcements/announcement-1"
);

expectHref(
  "tournament announcement opens the exact announcement when available",
  notificationAction(
    notification({
      action_url: "/tournaments/tournament-1",
      notification_type: "tournament_announcement",
      metadata: { announcement_id: "announcement-2", tournament_id: "tournament-1" }
    })
  ).href,
  "/community/announcements/announcement-2"
);

expectHref(
  "tournament registration routes to registration",
  notificationAction(
    notification({
      action_url: "/tournaments/tournament-1",
      notification_type: "tournament_registration",
      metadata: { tournament_id: "tournament-1" }
    })
  ).href,
  "/tournaments/tournament-1#registration"
);

expectHref(
  "tournament host access routes to host tools",
  notificationAction(
    notification({
      action_url: "/tournaments/tournament-1",
      notification_type: "tournament_host_access_granted",
      metadata: { tournament_id: "tournament-1" }
    })
  ).href,
  "/tournaments/tournament-1#host-controls"
);

expectHref(
  "tournament match ready routes to the match room",
  notificationAction(
    notification({
      action_url: "/tournaments/tournament-1#competition",
      match_room_id: "room-2",
      notification_type: "tournament_match_ready",
      metadata: { tournament_id: "tournament-1" }
    })
  ).href,
  "/matches/room-2#overview"
);

expectHref(
  "tournament result with a match room routes to the match result panel",
  notificationAction(
    notification({
      action_url: "/tournaments/tournament-1#result-reviews",
      match_room_id: "room-2",
      notification_type: "tournament_result_approve_result",
      metadata: { tournament_id: "tournament-1" }
    })
  ).href,
  "/matches/room-2#result"
);

expectHref(
  "tournament payout routes to prizes",
  notificationAction(
    notification({
      action_url: "/tournaments/tournament-1",
      notification_type: "tournament_payout_queued",
      metadata: { tournament_id: "tournament-1" }
    })
  ).href,
  "/tournaments/tournament-1#prizes"
);

expectHref("external notification redirects stay inside the app", safeNotificationRedirect("https://example.com"), "/notifications");

console.log("Phase 0 web smoke test passed.");
