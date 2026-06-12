export type RealtimeToastTone = "success" | "warning" | "danger" | "neutral";

export type RealtimeEvent = {
  id: string;
  actor_user_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  match_room_id: string | null;
  tournament_id: string | null;
  notification_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type RealtimeToastMessage = {
  title: string;
  description: string;
  tone: RealtimeToastTone;
};

function phrase(value: string) {
  return value
    .split(/[._]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function eventAmount(payload: Record<string, unknown>) {
  const amount = payload.amount_minor;
  if (typeof amount !== "number") return null;
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount / 100);
}

export function describeRealtimeEvent(event: RealtimeEvent): RealtimeToastMessage | null {
  const amount = eventAmount(event.payload);

  switch (event.event_type) {
    case "notification.read":
      return null;
    case "notification.created":
      return {
        title: "New notification",
        description: typeof event.payload.title === "string" ? event.payload.title : "Your inbox has a fresh update.",
        tone: "neutral"
      };
    case "chat.message.created":
      return {
        title: typeof event.payload.channel_slug === "string" && event.payload.channel_slug === "global_lobby" ? "Global Lobby message" : "New chat message",
        description: "A community channel has a fresh message.",
        tone: "neutral"
      };
    case "chat.system_message.created":
      return { title: "Channel update", description: "Skillsroom posted a system message.", tone: "success" };
    case "chat.message.mentioned":
      return { title: "You were mentioned", description: "A player mentioned you in chat.", tone: "neutral" };
    case "chat.message.reaction.changed":
      return null;
    case "chat.message.pinned":
      return { title: "Message pinned", description: "A channel message was pinned.", tone: "success" };
    case "chat.message.unpinned":
      return { title: "Message unpinned", description: "A channel pin was removed.", tone: "neutral" };
    case "chat.message.hidden":
      return { title: "Chat message hidden", description: "A moderator hid a community message.", tone: "warning" };
    case "chat.message.deleted":
      return { title: "Chat message deleted", description: "A moderator deleted a community message.", tone: "danger" };
    case "chat.member.muted":
      return { title: "Chat muted", description: "A channel mute was applied.", tone: "warning" };
    case "chat.presence.changed":
      return null;
    case "chat.typing.changed":
      return null;
    case "chat.channel.read":
      return null;
    case "chat.dm.request.created":
      return { title: "DM request", description: "A private message request needs a response.", tone: "neutral" };
    case "chat.dm.request.accepted":
      return { title: "DM accepted", description: "A private DM channel is now available.", tone: "success" };
    case "chat.dm.request.declined":
      return { title: "DM declined", description: "The private message request was declined.", tone: "warning" };
    case "chat.user.blocked":
      return { title: "User blocked", description: "That player can no longer DM you.", tone: "warning" };
    case "room.invite.created":
      return { title: "Room invite sent", description: "The invited player can now respond from their inbox.", tone: "neutral" };
    case "room.invite.accepted":
      return { title: "Invite accepted", description: "The invited player joined the room flow.", tone: "success" };
    case "room.invite.declined":
      return { title: "Invite declined", description: "The invited player turned down the room invite.", tone: "warning" };
    case "match.participant.joined":
      return { title: "Opponent joined", description: "The room is moving toward funding review.", tone: "success" };
    case "match.check_in.recorded":
      return { title: "Player checked in", description: "Tournament match presence was recorded live.", tone: "success" };
    case "match.funding.submitted":
      return { title: "Funding proof submitted", description: amount ? `${amount} entered review.` : "A payment proof entered review.", tone: "warning" };
    case "match.funding.approved":
      return { title: "Funding approved", description: "That player is now cleared on funding.", tone: "success" };
    case "match.funding.rejected":
      return { title: "Funding rejected", description: "The player needs to resubmit transfer proof.", tone: "danger" };
    case "match.result.submitted":
      return { title: "Result submitted", description: "Score evidence is now under review.", tone: "warning" };
    case "match.result.agree":
      return { title: "Result agreed", description: "The opponent accepted the submitted score.", tone: "success" };
    case "match.result.dispute":
      return { title: "Result disputed", description: "Operator review is now needed.", tone: "danger" };
    case "match.result.reviewed.approve_claim":
      return { title: "Result confirmed", description: "The room can move to settlement.", tone: "success" };
    case "match.result.reviewed.reject_claim":
      return { title: "Result rejected", description: "Evidence stays open for further review.", tone: "warning" };
    case "match.result.reviewed.mark_disputed":
      return { title: "Result marked disputed", description: "The room remains paused for operator handling.", tone: "danger" };
    case "match.result.reviewed.void_match":
      return { title: "Match voided", description: "This room result was invalidated by review.", tone: "danger" };
    case "match.settlement.reserved":
      return { title: "Settlement reserved", description: "Winner payout has entered the money workflow.", tone: "success" };
    case "match.payout.completed":
      return { title: "Payout completed", description: amount ? `${amount} was marked paid.` : "A queued payout was completed.", tone: "success" };
    case "match.refunds.reserved":
      return { title: "Refunds queued", description: "Approved funding is being returned to players.", tone: "warning" };
    case "match.refund.completed":
      return { title: "Refund completed", description: amount ? `${amount} was marked refunded.` : "A queued refund was completed.", tone: "success" };
    case "match.hold.created":
      return { title: "Room hold applied", description: "This room is paused for moderation review.", tone: "danger" };
    case "match.hold.released":
      return { title: "Room hold released", description: "This room can continue through the workflow again.", tone: "success" };
    case "tournament.entry.registered":
      return { title: "Tournament registration received", description: "The roster updated live.", tone: "success" };
    case "tournament.entry.checked_in":
      return { title: "Tournament check-in confirmed", description: "That entry is now ready for seeding or pairing.", tone: "success" };
    case "tournament.contribution.submitted":
      return { title: "Tournament contribution submitted", description: "Prize or entry funding entered operator review.", tone: "warning" };
    case "tournament.contribution.approved":
      return { title: "Tournament contribution approved", description: "That money now counts toward the event pool.", tone: "success" };
    case "tournament.contribution.rejected":
      return { title: "Tournament contribution rejected", description: "That contribution will need correction or resubmission.", tone: "danger" };
    case "tournament.seeded":
      return { title: "Tournament seeded", description: "Entries now have live competitive order.", tone: "success" };
    case "tournament.structure.generated":
      return { title: "Tournament structure ready", description: "Stages, rounds, and matches were generated.", tone: "success" };
    case "tournament.match_rooms.linked":
      return { title: "Match rooms linked", description: "Playable Skillsroom match workspaces are now attached.", tone: "success" };
    case "tournament.settlement.reserved":
      return { title: "Tournament payout queue reserved", description: "Prize allocations are moving into settlement.", tone: "success" };
    case "tournament.refunds.reserved":
      return { title: "Tournament refunds queued", description: "Participant entry refunds were reserved.", tone: "warning" };
    case "tournament.transitioned":
      return { title: "Tournament state changed", description: "The event lifecycle moved forward.", tone: "neutral" };
    case "tournament.scores.applied":
      return { title: "Cumulative scores applied", description: "Standings were updated from the latest scoring batch.", tone: "success" };
  }

  if (event.event_type.startsWith("tournament.match.reviewed.")) {
    return { title: "Tournament result reviewed", description: phrase(event.event_type.replace("tournament.match.reviewed.", "")), tone: "neutral" };
  }

  if (event.event_type.startsWith("admin.queue.")) {
    return {
      title: "Operator queue changed",
      description: `${phrase(event.event_type.replace("admin.queue.", "").replace(".changed", ""))} updated live.`,
      tone: "neutral"
    };
  }

  if (event.event_type.startsWith("match.room.")) {
    return { title: "Room updated", description: phrase(event.event_type.replace("match.", "")), tone: "neutral" };
  }

  return null;
}
