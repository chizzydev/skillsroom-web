import type { MatchRoomStatus } from "@/lib/match-room-api";

export type RoomActivityStatus = Extract<
  MatchRoomStatus,
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
  | "voided"
>;

export type RoomActivityQueue =
  | "open"
  | "funding"
  | "ready"
  | "live"
  | "result"
  | "review"
  | "disputed"
  | "payout"
  | "done"
  | "expired";

export const roomActivityStatuses: RoomActivityStatus[] = [
  "open",
  "awaiting_funding",
  "funding_review",
  "funded",
  "active",
  "awaiting_results",
  "under_review",
  "disputed",
  "settlement_pending",
  "completed",
  "cancelled",
  "refunded",
  "voided"
];

export const roomActivityQueueStatuses: Record<RoomActivityQueue, RoomActivityStatus[]> = {
  open: ["open"],
  funding: ["awaiting_funding", "funding_review"],
  ready: ["funded"],
  live: ["active"],
  result: ["awaiting_results"],
  review: ["under_review"],
  disputed: ["disputed"],
  payout: ["settlement_pending"],
  done: ["completed", "refunded", "voided", "cancelled"],
  expired: []
};

export const roomActivityQueues: RoomActivityQueue[] = ["open", "funding", "ready", "live", "result", "review", "disputed", "payout", "done", "expired"];

export function queueForRoomStatus(status: RoomActivityStatus): RoomActivityQueue {
  const match = roomActivityQueues.find((queue) => roomActivityQueueStatuses[queue].includes(status));
  return match ?? "open";
}

export function queueLabel(queue: RoomActivityQueue) {
  if (queue === "open") return "Open";
  if (queue === "funding") return "Funding";
  if (queue === "ready") return "Ready";
  if (queue === "live") return "Live";
  if (queue === "result") return "Result";
  if (queue === "review") return "Review";
  if (queue === "disputed") return "Disputed";
  if (queue === "payout") return "Payout";
  if (queue === "expired") return "Expired";
  return "Done";
}

export function queueDescription(queue: RoomActivityQueue) {
  if (queue === "funding") return "Rooms waiting for entry payment or funding approval.";
  if (queue === "ready") return "Rooms funded by both players and waiting for match start.";
  if (queue === "live") return "Rooms currently in play.";
  if (queue === "result") return "Rooms waiting for a player to submit the match result.";
  if (queue === "review") return "Rooms with result evidence waiting for review.";
  if (queue === "disputed") return "Rooms where players disagree and Skillsroom must review.";
  if (queue === "payout") return "Rooms approved and waiting for payout or refund completion.";
  if (queue === "done") return "Completed, refunded, voided, or cancelled rooms.";
  if (queue === "expired") return "H2H challenge rooms whose join window ended before another player accepted.";
  return "Open rooms that can still be joined.";
}

export function queuePanelTone(queue: RoomActivityQueue): "neutral" | "cyan" | "warning" | "danger" {
  if (["done", "expired"].includes(queue)) return "neutral";
  if (["funding", "ready", "payout"].includes(queue)) return "warning";
  if (["review", "disputed"].includes(queue)) return "danger";
  return "cyan";
}
