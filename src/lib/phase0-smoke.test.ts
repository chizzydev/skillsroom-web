import { apiBaseUrl } from "./api";
import { queryKeysForRealtimeEvent, webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { notificationAction, safeNotificationRedirect } from "./notification-routing";
import type { RealtimeEvent } from "@/components/realtime/realtimeEventPresentation";
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

function realtimeEvent(overrides: Partial<RealtimeEvent>): RealtimeEvent {
  return {
    id: "event-test",
    actor_user_id: null,
    event_type: "notification.created",
    entity_type: null,
    entity_id: null,
    match_room_id: null,
    tournament_id: null,
    notification_id: null,
    payload: {},
    created_at: new Date(0).toISOString(),
    ...overrides
  };
}

function expectQueryKeys(name: string, event: RealtimeEvent, expectedKeys: ReadonlyArray<readonly unknown[]>) {
  const actual = queryKeysForRealtimeEvent(event).map((key) => JSON.stringify(key));
  const expected = expectedKeys.map((key) => JSON.stringify(key));
  for (const key of expected) {
    if (!actual.includes(key)) {
      throw new Error(`${name}: missing query key ${key}. Received ${actual.join(", ")}.`);
    }
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

expectQueryKeys(
  "match funding approval invalidates room, funding, wallet, and home caches",
  realtimeEvent({
    id: "event-room-funding",
    event_type: "match.funding.approved",
    match_room_id: "room-1",
    payload: { amount_minor: 10000 }
  }),
  [webQueryKeys.rooms, webQueryKeys.home, webQueryKeys.room("room-1"), webQueryKeys.roomFunding("room-1"), webQueryKeys.wallet]
);

expectQueryKeys(
  "notification event invalidates notification count",
  realtimeEvent({
    id: "event-notification",
    event_type: "room.invite.created",
    match_room_id: "room-2"
  }),
  [webQueryKeys.notifications, webQueryKeys.notificationCount, webQueryKeys.home, webQueryKeys.room("room-2")]
);

expectQueryKeys(
  "room activity event invalidates rooms and home lobby",
  realtimeEvent({
    id: "event-room-activity",
    event_type: "match.participant.joined",
    match_room_id: "room-3"
  }),
  [webQueryKeys.rooms, webQueryKeys.home, webQueryKeys.room("room-3")]
);

expectQueryKeys(
  "money review event invalidates admin queues",
  realtimeEvent({
    id: "event-admin-money",
    event_type: "wallet.topup.approved",
    payload: { user_id: "user-1" }
  }),
  [webQueryKeys.wallet, webQueryKeys.admin]
);

expectQueryKeys(
  "result review event invalidates admin queues",
  realtimeEvent({
    id: "event-admin-result",
    event_type: "match.result.reviewed.approve_claim",
    match_room_id: "room-4"
  }),
  [webQueryKeys.rooms, webQueryKeys.room("room-4"), webQueryKeys.roomResults("room-4"), webQueryKeys.admin]
);

expectQueryKeys(
  "tournament result review invalidates tournament result caches",
  realtimeEvent({
    id: "event-tournament-result",
    event_type: "tournament.match.reviewed.approve_claim",
    tournament_id: "tournament-1"
  }),
  [webQueryKeys.tournaments, webQueryKeys.home, webQueryKeys.tournament("tournament-1"), webQueryKeys.tournamentResults("tournament-1")]
);

expectQueryKeys(
  "tournament contribution event invalidates funding and admin tournament queues",
  realtimeEvent({
    id: "event-tournament-funding",
    event_type: "tournament.contribution.approved",
    tournament_id: "tournament-2",
    payload: { amount_minor: 50000 }
  }),
  [
    webQueryKeys.tournaments,
    webQueryKeys.home,
    webQueryKeys.tournament("tournament-2"),
    webQueryKeys.tournamentFunding("tournament-2"),
    webQueryKeys.admin
  ]
);

expectQueryKeys(
  "tournament bracket event invalidates tournament detail and lobby surfaces",
  realtimeEvent({
    id: "event-tournament-bracket",
    event_type: "tournament.match_rooms.linked",
    tournament_id: "tournament-3"
  }),
  [webQueryKeys.tournaments, webQueryKeys.home, webQueryKeys.tournament("tournament-3")]
);

expectQueryKeys(
  "tournament announcement invalidates organizer-facing tournament surfaces",
  realtimeEvent({
    id: "event-tournament-announcement",
    event_type: "community.announcement.published",
    tournament_id: "tournament-4",
    payload: { announcement_id: "announcement-4" }
  }),
  [
    webQueryKeys.home,
    webQueryKeys.tournaments,
    webQueryKeys.notifications,
    webQueryKeys.notificationCount,
    webQueryKeys.tournament("tournament-4")
  ]
);

console.log("Phase 0 web smoke test passed.");
