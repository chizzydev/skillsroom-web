"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Toast } from "@/components/ui/Toast";

type FeedbackTone = "success" | "danger" | "warning" | "neutral";

type FeedbackMessage = {
  key: string;
  title: string;
  description?: string;
  tone: FeedbackTone;
};

const flagMessages: Record<string, Omit<FeedbackMessage, "key">> = {
  invite_sent: {
    title: "Invite sent",
    description: "The player will see it in their notifications.",
    tone: "success"
  },
  checked_in: {
    title: "Check-in saved",
    description: "You are marked present for this match.",
    tone: "success"
  },
  livestream_saved: {
    title: "Livestream saved",
    description: "The stream link is now attached to this page.",
    tone: "success"
  },
  livestream_archived: {
    title: "Livestream removed",
    description: "That stream link is no longer shown here.",
    tone: "success"
  },
  play_started: {
    title: "Match started",
    description: "Submit result evidence after the game is complete.",
    tone: "success"
  },
  balance_funded: {
    title: "Entry paid from balance",
    description: "Your funds are locked safely for this room.",
    tone: "success"
  },
  role_updated: {
    title: "Team role updated",
    description: "The new access level is now saved.",
    tone: "success"
  },
  announcement_saved: {
    title: "Announcement saved",
    description: "You can publish it when it is ready.",
    tone: "success"
  },
  announcement_published: {
    title: "Announcement published",
    description: "Players can now see this update.",
    tone: "success"
  },
  announcement_archived: {
    title: "Announcement archived",
    description: "That announcement is no longer public.",
    tone: "success"
  },
  channel_saved: {
    title: "Channel saved",
    description: "The community channel settings are updated.",
    tone: "success"
  }
};

function friendlyError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("primary game account") || lower.includes("complete your player profile")) {
    return {
      title: "Finish your profile first",
      description: "Add your player details and primary game account in Profile, then come back to create or join rooms."
    };
  }

  if (lower.includes("sign in") || lower.includes("session")) {
    return {
      title: "Please sign in again",
      description: "Your session may have expired. Sign in, then try that action again."
    };
  }

  if (lower.includes("funding proof") || lower.includes("transfer proof")) {
    return {
      title: "Funding proof needed",
      description: message
    };
  }

  if (lower.includes("livestream") || lower.includes("stream")) {
    return {
      title: "Stream could not be saved",
      description: message
    };
  }

  return {
    title: "Action could not be completed",
    description: message
  };
}

function firstMessage(params: URLSearchParams): FeedbackMessage | null {
  const error = params.get("error");
  if (error) {
    const friendly = friendlyError(error);
    return { key: `error:${error}`, tone: "danger", ...friendly };
  }

  const success = params.get("success");
  if (success) {
    return {
      key: `success:${success}`,
      title: "Saved",
      description: success,
      tone: "success"
    };
  }

  for (const [key, message] of Object.entries(flagMessages)) {
    if (params.has(key)) return { key, ...message };
  }

  return null;
}

export function GlobalActionFeedback() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsText = searchParams.toString();
  const message = useMemo(() => firstMessage(new URLSearchParams(paramsText)), [paramsText]);
  const [visibleMessage, setVisibleMessage] = useState<FeedbackMessage | null>(message);
  const toastRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleMessage(message);
  }, [message]);

  useEffect(() => {
    if (!message) return;

    const focusTimer = window.setTimeout(() => {
      toastRef.current?.focus({ preventScroll: true });
    }, 80);

    const clearTimer = window.setTimeout(() => {
      const params = new URLSearchParams(paramsText);
      params.delete("error");
      params.delete("success");
      for (const key of Object.keys(flagMessages)) params.delete(key);
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      setVisibleMessage(null);
    }, message.tone === "danger" ? 14000 : 9000);

    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(clearTimer);
    };
  }, [message, paramsText, pathname, router]);

  if (!visibleMessage) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[80] md:inset-x-auto md:right-6 md:top-20 md:bottom-auto md:w-[24rem]">
      <div
        className="pointer-events-auto motion-page-enter outline-none"
        ref={toastRef}
        role={visibleMessage.tone === "danger" ? "alert" : "status"}
        tabIndex={-1}
      >
        <Toast
          description={visibleMessage.description}
          title={visibleMessage.title}
          tone={visibleMessage.tone}
        >
          <button
            aria-label="Dismiss message"
            className="rounded-sm px-2 py-1 text-xs font-black text-muted hover:bg-white/60 hover:text-ink"
            onClick={() => setVisibleMessage(null)}
            type="button"
          >
            Close
          </button>
        </Toast>
      </div>
    </div>
  );
}
