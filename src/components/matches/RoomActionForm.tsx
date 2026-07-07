"use client";

import { useActionState, useEffect, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { initialRoomActionState, type RoomActionState } from "@/lib/room-action-state";

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

  useEffect(() => {
    if (!refreshOnSuccess || state.status !== "success" || !state.refreshToken) return;
    startTransition(() => {
      router.refresh();
    });
  }, [refreshOnSuccess, router, state.refreshToken, state.status]);

  return (
    <form action={formAction} className={className}>
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
