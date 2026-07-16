"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { initialRoomActionState, type RoomActionState } from "@/lib/room-action-state";
import { Toast } from "@/components/ui/Toast";

type RoomActionHandler = (state: RoomActionState, formData: FormData) => Promise<RoomActionState>;

type RoomActionFormProps = {
  action: RoomActionHandler;
  children: ReactNode;
  className?: string;
  refreshOnSuccess?: boolean;
};

export function RoomActionForm({
  action,
  children,
  className,
  refreshOnSuccess = true
}: RoomActionFormProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [state, formAction] = useActionState(action, initialRoomActionState);
  const [toastVisible, setToastVisible] = useState(false);
  const toastRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!refreshOnSuccess || state.status !== "success" || !state.refreshToken) return;
    startTransition(() => {
      router.refresh();
    });
  }, [refreshOnSuccess, router, state.refreshToken, state.status]);

  useEffect(() => {
    if (state.status === "idle" || !state.message) return;
    setToastVisible(true);

    if (state.status === "success") {
      formRef.current?.reset();
    }

    const focusTimer = window.setTimeout(() => {
      toastRef.current?.focus({ preventScroll: true });
    }, 80);
    const clearTimer = window.setTimeout(() => {
      setToastVisible(false);
    }, state.status === "error" ? 14000 : 9000);

    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(clearTimer);
    };
  }, [state.message, state.refreshToken, state.status]);

  const toastTone = state.status === "error" ? "danger" : "success";
  const toastTitle = state.status === "error" ? "Action could not be completed" : "Action saved";

  return (
    <form action={formAction} className={className} ref={formRef}>
      {toastVisible && state.status !== "idle" && state.message ? (
        <div className="pointer-events-none fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[85] md:inset-x-auto md:right-6 md:top-20 md:bottom-auto md:w-[24rem]">
          <div
            className="pointer-events-auto motion-page-enter outline-none"
            ref={toastRef}
            role={state.status === "error" ? "alert" : "status"}
            tabIndex={-1}
          >
            <Toast description={state.message} title={toastTitle} tone={toastTone}>
              <button
                aria-label="Dismiss message"
                className="rounded-sm px-2 py-1 text-xs font-black text-muted hover:bg-white/60 hover:text-ink"
                onClick={() => setToastVisible(false)}
                type="button"
              >
                Close
              </button>
            </Toast>
          </div>
        </div>
      ) : null}
      {state.status !== "idle" ? (
        <div
          aria-live="polite"
          className={[
            "rounded-md border p-3 text-sm font-bold leading-6",
            state.status === "success"
              ? "border-success/30 bg-emerald-50 text-success"
              : "border-danger bg-red-50 text-danger"
          ].join(" ")}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
          {state.status === "success" && isRefreshing ? (
            <span className="ml-2 text-xs text-muted">Updating room...</span>
          ) : null}
        </div>
      ) : null}
      {children}
    </form>
  );
}
