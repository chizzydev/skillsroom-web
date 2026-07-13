import type { RealtimeEvent } from "./realtimeEventPresentation";

export type RealtimePatchTarget =
  | "room"
  | "room-funding"
  | "room-result"
  | "tournament"
  | "tournament-funding"
  | "tournament-result"
  | "notifications"
  | "wallet"
  | "admin-queue"
  | "chat"
  | "unknown";

export type RealtimePatchDetail = {
  event: RealtimeEvent;
  target: RealtimePatchTarget;
  handled: boolean;
};

export const realtimePatchEventName = "skillsroom:realtime-patch";

export function classifyRealtimePatch(event: RealtimeEvent): RealtimePatchTarget {
  const type = event.event_type;

  if (type.startsWith("notification.")) return "notifications";
  if (type.startsWith("wallet.") || type.includes(".payout.") || type.includes(".refund.")) return "wallet";
  if (type.startsWith("chat.")) return "chat";
  if (type.startsWith("admin.queue.")) return "admin-queue";

  if (type.startsWith("match.funding.")) return "room-funding";
  if (type.startsWith("match.result.") || type.startsWith("match.settlement.")) return "room-result";
  if (type.startsWith("match.") || type.startsWith("room.invite.")) return "room";

  if (type.startsWith("tournament.contribution.") || type.startsWith("tournament.settlement.") || type.startsWith("tournament.refunds.")) {
    return "tournament-funding";
  }
  if (type.startsWith("tournament.match.reviewed.") || type.startsWith("tournament.scores.")) return "tournament-result";
  if (type.startsWith("tournament.")) return "tournament";

  return "unknown";
}

export function dispatchRealtimePatch(event: RealtimeEvent): RealtimePatchDetail {
  const detail: RealtimePatchDetail = {
    event,
    target: classifyRealtimePatch(event),
    handled: false
  };

  window.dispatchEvent(new CustomEvent<RealtimePatchDetail>(realtimePatchEventName, { detail }));
  return detail;
}
