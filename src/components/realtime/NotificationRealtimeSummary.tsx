"use client";

import { useEffect, useState } from "react";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { realtimePatchEventName, type RealtimePatchDetail } from "./realtimePatches";

type NotificationRealtimeSummaryProps = {
  externalEnabled: boolean;
  inAppEnabled: boolean;
  initialDmRequests: number;
  initialInvites: number;
  initialUnread: number;
};

export function NotificationRealtimeSummary({
  externalEnabled,
  inAppEnabled,
  initialDmRequests,
  initialInvites,
  initialUnread
}: NotificationRealtimeSummaryProps) {
  const [unread, setUnread] = useState(initialUnread);
  const [dmRequests, setDmRequests] = useState(initialDmRequests);
  const [invites, setInvites] = useState(initialInvites);

  useEffect(() => {
    const onPatch = (event: Event) => {
      const customEvent = event as CustomEvent<RealtimePatchDetail>;
      const realtimeEvent = customEvent.detail.event;
      if (!["notifications", "room", "chat"].includes(customEvent.detail.target)) return;

      customEvent.detail.handled = true;
      if (realtimeEvent.event_type === "notification.created") setUnread((current) => current + 1);
      if (realtimeEvent.event_type === "notification.read") setUnread((current) => Math.max(0, current - 1));
      if (realtimeEvent.event_type === "room.invite.created") setInvites((current) => current + 1);
      if (realtimeEvent.event_type === "room.invite.accepted" || realtimeEvent.event_type === "room.invite.declined") {
        setInvites((current) => Math.max(0, current - 1));
      }
      if (realtimeEvent.event_type === "chat.dm.request.created") setDmRequests((current) => current + 1);
      if (realtimeEvent.event_type === "chat.dm.request.accepted" || realtimeEvent.event_type === "chat.dm.request.declined") {
        setDmRequests((current) => Math.max(0, current - 1));
      }
    };

    window.addEventListener(realtimePatchEventName, onPatch);
    return () => window.removeEventListener(realtimePatchEventName, onPatch);
  }, []);

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <StatusPanel detail="Unread" label="Notifications" tone="warning" value={unread.toString()} />
      <StatusPanel detail="Awaiting you" label="DM Requests" tone="cyan" value={dmRequests.toString()} />
      <StatusPanel detail="Pending" label="Invites" tone="cyan" value={invites.toString()} />
      <StatusPanel detail="Current channel" label="In-app" tone={inAppEnabled ? "success" : "danger"} value={inAppEnabled ? "On" : "Off"} />
      <StatusPanel
        detail="Email or SMS"
        label="External"
        tone={externalEnabled ? "success" : "neutral"}
        value={externalEnabled ? "On" : "Off"}
      />
    </div>
  );
}
