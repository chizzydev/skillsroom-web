"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { FormActionButton } from "@/components/ui/FormActionButton";
import type { AdminAnalyticsUserCandidate } from "@/lib/match-room-api";

type SearchPayload = {
  ok: boolean;
  data?: { users: AdminAnalyticsUserCandidate[] };
  error?: { message?: string };
};

function candidateLabel(candidate: AdminAnalyticsUserCandidate) {
  return candidate.display_name || candidate.username || candidate.email || candidate.user_id;
}

function candidateDetail(candidate: AdminAnalyticsUserCandidate) {
  const parts = [
    candidate.username ? `@${candidate.username}` : null,
    candidate.email,
    candidate.primary_game_handle ? `Handle: ${candidate.primary_game_handle}` : null
  ].filter(Boolean);
  return parts.join(" · ");
}

function statusTone(status: string | null) {
  if (status === "active") return "success";
  if (status === "locked" || status === "disabled") return "danger";
  return "neutral";
}

export function AnalyticsUserExclusionPicker({
  action,
  days
}: {
  action: (formData: FormData) => void | Promise<void>;
  days: number;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminAnalyticsUserCandidate[]>([]);
  const [selected, setSelected] = useState<AdminAnalyticsUserCandidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const readyToSearch = trimmedQuery.length >= 2;
  const selectedAlreadyExcluded = Boolean(selected?.analytics_excluded);

  useEffect(() => {
    if (!readyToSearch) {
      setUsers([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q: trimmedQuery, limit: "10" });
        const response = await fetch(`/api/admin/analytics/users/search?${params}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as SearchPayload | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Player search is temporarily unavailable.");
        }
        setUsers(payload.data?.users ?? []);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setUsers([]);
        setError(caught instanceof Error ? caught.message : "Player search is temporarily unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [readyToSearch, trimmedQuery]);

  const helperText = useMemo(() => {
    if (!readyToSearch) return "Search by email, username, player name, game handle, or user ID.";
    if (loading) return "Searching player accounts...";
    if (error) return error;
    if (!users.length) return "No matching player accounts found.";
    return "Choose the account that belongs outside production analytics.";
  }, [error, loading, readyToSearch, users.length]);

  function selectUser(candidate: AdminAnalyticsUserCandidate) {
    setSelected(candidate);
    setQuery(candidateLabel(candidate));
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setUsers([]);
    setError(null);
  }

  return (
    <form action={action} className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-[0_14px_34px_rgba(3,10,20,0.06)]">
      <input name="days" type="hidden" value={days} />
      <input name="user_id" type="hidden" value={selected?.user_id ?? ""} />
      <div>
        <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Exclude player</p>
        <h3 className="mt-1 text-lg font-black text-ink">Find a test account</h3>
        <p className="mt-1 text-sm font-bold leading-6 text-muted">
          Search for the player, confirm the account, then exclude it from production reporting.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-bold text-ink" htmlFor="analytics-user-search">Player account</label>
        <input
          autoComplete="off"
          className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-bold outline-none focus:border-action"
          id="analytics-user-search"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
          }}
          placeholder="Search email, username, game handle, or user ID"
          type="search"
          value={query}
        />
        <p className={["text-xs font-bold leading-5", error ? "text-danger" : "text-muted"].join(" ")} aria-live="polite">
          {helperText}
        </p>
      </div>

      {readyToSearch && !selected ? (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-line bg-surfaceWarm p-2">
          {users.map((candidate) => (
            <button
              className="grid w-full gap-2 rounded-md border border-transparent bg-white px-3 py-3 text-left shadow-sm transition hover:border-action focus:border-action focus:outline-none"
              key={candidate.user_id}
              onClick={() => selectUser(candidate)}
              type="button"
            >
              <span className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-ink">{candidateLabel(candidate)}</span>
                  <span className="mt-1 block break-words text-xs font-bold text-muted">{candidateDetail(candidate) || candidate.user_id}</span>
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Badge tone={candidate.analytics_excluded ? "warning" : "cyan"}>
                    {candidate.analytics_excluded ? "Excluded" : "Available"}
                  </Badge>
                  <Badge tone={statusTone(candidate.status)}>{candidate.status ?? "Unknown"}</Badge>
                </span>
              </span>
              <span className="break-all font-mono text-[0.68rem] font-black uppercase tracking-[0.1em] text-dim">{candidate.user_id}</span>
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <div className="rounded-lg border border-cyan/35 bg-cyan/5 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black text-ink">{candidateLabel(selected)}</p>
              <p className="mt-1 break-words text-xs font-bold leading-5 text-muted">{candidateDetail(selected) || "Selected account"}</p>
              <p className="mt-2 break-all font-mono text-[0.68rem] font-black uppercase tracking-[0.1em] text-dim">{selected.user_id}</p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Badge tone={selected.analytics_excluded ? "warning" : "success"}>
                {selected.analytics_excluded ? "Already excluded" : "Ready"}
              </Badge>
              <button className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-black text-ink transition hover:border-action" onClick={clearSelection} type="button">
                Change
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <label className="grid gap-2 text-sm font-bold text-ink">
        Reason
        <textarea
          className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action"
          maxLength={240}
          name="reason"
          placeholder="Example: Android release smoke test account."
          required
        />
      </label>
      <FormActionButton
        disabled={!selected || selectedAlreadyExcluded}
        idleLabel={selectedAlreadyExcluded ? "Already excluded" : "Exclude selected player"}
        pendingLabel="Saving exclusion..."
        variant="secondary"
      />
    </form>
  );
}
