"use client";

import { createContext, useContext, useMemo, useRef, useState, type ButtonHTMLAttributes, type FormHTMLAttributes, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { webQueryKeys } from "@/components/realtime/webRealtimeInvalidation";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";

type TournamentCommand =
  | "review_contribution"
  | "seed"
  | "generate_structure"
  | "link_match_rooms"
  | "apply_scores"
  | "review_match_result"
  | "reserve_settlement"
  | "reserve_refunds"
  | "grant_host"
  | "update_event";

type CommandResult = {
  ok: boolean;
  data?: {
    tournament_id?: string | null;
    message?: string;
  };
  message?: string;
};

type MutationContextValue = {
  pending: boolean;
  activeSubmitter: string | null;
};

type AdminTournamentMutationFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  command: TournamentCommand;
  children: ReactNode;
  successMessage?: string;
};

type AdminTournamentMutationButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> & {
  idleLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

const MutationContext = createContext<MutationContextValue | null>(null);

function formDataFields(formData: FormData) {
  const fields: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const existing = fields[key];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else if (typeof existing === "string") {
      fields[key] = [existing, value];
    } else {
      fields[key] = value;
    }
  }
  return fields;
}

function submitterKey(submitter: HTMLElement | null) {
  if (!(submitter instanceof HTMLButtonElement)) return "__default";
  return `${submitter.name || "__submit"}:${String(submitter.value ?? "")}`;
}

export function AdminTournamentMutationForm({ command, children, successMessage, className, ...props }: AdminTournamentMutationFormProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [activeSubmitter, setActiveSubmitter] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ title: string; description: string; tone: "success" | "danger" } | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ formData }: { formData: FormData }) => {
      const response = await fetch("/api/admin/tournaments/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command, fields: formDataFields(formData) })
      });
      const result = (await response.json().catch(() => null)) as CommandResult | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || "The tournament action could not be completed.");
      }
      return result;
    },
    onSuccess: (result) => {
      const tournamentId = result.data?.tournament_id || "";
      void queryClient.invalidateQueries({ queryKey: [...webQueryKeys.admin, "tournaments"] });
      void queryClient.invalidateQueries({ queryKey: webQueryKeys.admin });
      void queryClient.invalidateQueries({ queryKey: webQueryKeys.tournaments });
      void queryClient.invalidateQueries({ queryKey: webQueryKeys.home });
      if (tournamentId) {
        void queryClient.invalidateQueries({ queryKey: webQueryKeys.tournament(tournamentId) });
        void queryClient.invalidateQueries({ queryKey: webQueryKeys.tournamentFunding(tournamentId) });
        void queryClient.invalidateQueries({ queryKey: webQueryKeys.tournamentResults(tournamentId) });
      }
      router.refresh();
      setFeedback({
        title: "Tournament action saved",
        description: successMessage || result.data?.message || "The tournament view will update with the latest information.",
        tone: "success"
      });
      if (["review_contribution", "reserve_settlement", "reserve_refunds"].includes(command)) formRef.current?.reset();
    },
    onError: (error) => {
      setFeedback({
        title: "Action could not be completed",
        description: error instanceof Error ? error.message : "Please check the details and try again.",
        tone: "danger"
      });
    },
    onSettled: () => setActiveSubmitter(null)
  });

  const value = useMemo<MutationContextValue>(() => ({ pending: mutation.isPending, activeSubmitter }), [activeSubmitter, mutation.isPending]);

  return (
    <MutationContext.Provider value={value}>
      <form
        className={className}
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          const nativeEvent = event.nativeEvent as SubmitEvent;
          const submitter = nativeEvent.submitter instanceof HTMLElement ? nativeEvent.submitter : null;
          const form = event.currentTarget;
          if (!form.reportValidity()) return;
          const formData = new FormData(form);
          if (submitter instanceof HTMLButtonElement && submitter.name) formData.set(submitter.name, submitter.value);
          setActiveSubmitter(submitterKey(submitter));
          setFeedback(null);
          mutation.mutate({ formData });
        }}
        {...props}
      >
        {feedback ? (
          <Toast description={feedback.description} title={feedback.title} tone={feedback.tone}>
            <button className="text-xs font-black text-muted hover:text-ink" onClick={() => setFeedback(null)} type="button">
              Close
            </button>
          </Toast>
        ) : null}
        {children}
      </form>
    </MutationContext.Provider>
  );
}

export function AdminTournamentMutationButton({
  idleLabel,
  pendingLabel = "Saving...",
  disabled,
  variant,
  size,
  fullWidth,
  className,
  name,
  value,
  ...props
}: AdminTournamentMutationButtonProps) {
  const context = useContext(MutationContext);
  const key = `${name || "__submit"}:${String(value ?? "")}`;
  const active = Boolean(context?.pending && (!context.activeSubmitter || context.activeSubmitter === key || context.activeSubmitter === "__default"));

  return (
    <Button
      aria-busy={active}
      className={[active ? "motion-sheen motion-working" : "", className ?? ""].join(" ")}
      disabled={disabled || Boolean(context?.pending)}
      fullWidth={fullWidth}
      name={name}
      size={size}
      type="submit"
      value={value}
      variant={variant}
      {...props}
    >
      {active ? <span className="motion-busy-dot" aria-hidden="true" /> : null}
      <span>{active ? pendingLabel : idleLabel}</span>
    </Button>
  );
}
