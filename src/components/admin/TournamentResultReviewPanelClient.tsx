"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";

type ReviewAction = (formData: FormData) => void | Promise<void>;

type TournamentFormat =
  | "single_elimination"
  | "double_elimination"
  | "round_robin"
  | "swiss"
  | "group_stage_playoffs"
  | "league"
  | "season"
  | "free_for_all"
  | "leaderboard"
  | "race"
  | "time_trial"
  | "grand_prix";

type TournamentResultReviewDecision =
  | "confirm_score"
  | "mark_disputed"
  | "void_match"
  | "forfeit_entry"
  | "no_show_entry"
  | "disqualify_entry";

type TournamentEntry = {
  id: string;
  display_name: string | null;
  team_name: string | null;
  status: string;
};

type TournamentMatch = {
  id: string;
  match_number: number;
  round_id: string;
  stage_id: string;
  match_room_id: string | null;
  status: string;
};

type TournamentMatchSide = {
  id: string;
  tournament_match_id: string;
  entry_id: string | null;
  side_index: number;
  seed: number | null;
};

type TournamentMatchResultReview = {
  id: string;
  tournament_match_id: string;
  result_claim_id: string | null;
  decision: TournamentResultReviewDecision;
  winning_entry_id: string | null;
  penalized_entry_id: string | null;
  score_summary: string | null;
  note: string | null;
  created_at: string;
};

type TournamentDetail = {
  id: string;
  title: string;
  format: TournamentFormat;
  status: string;
  entries: TournamentEntry[];
  matches: TournamentMatch[];
  match_sides: TournamentMatchSide[];
  result_reviews: TournamentMatchResultReview[];
};

type Props = {
  action: ReviewAction;
  tournaments: TournamentDetail[];
};

const headToHeadDecisions: Array<{ value: TournamentResultReviewDecision; label: string }> = [
  { value: "confirm_score", label: "Confirm score" },
  { value: "mark_disputed", label: "Mark disputed" },
  { value: "void_match", label: "Void match" },
  { value: "forfeit_entry", label: "Forfeit entry" },
  { value: "no_show_entry", label: "No-show entry" },
  { value: "disqualify_entry", label: "Disqualify entry" }
];

const cumulativeDecisions: Array<{ value: TournamentResultReviewDecision; label: string }> = [
  { value: "mark_disputed", label: "Mark disputed" },
  { value: "void_match", label: "Void match" }
];

const cumulativeFormats = new Set<TournamentFormat>(["free_for_all", "leaderboard", "race", "time_trial", "grand_prix"]);
const winnerRequiredDecisions = new Set<TournamentResultReviewDecision>(["confirm_score", "forfeit_entry", "no_show_entry", "disqualify_entry"]);
const penalizedRequiredDecisions = new Set<TournamentResultReviewDecision>(["forfeit_entry", "no_show_entry", "disqualify_entry"]);

function displayEnumLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function entryLabel(entry: TournamentEntry | undefined, fallbackId: string | null) {
  if (!entry) return fallbackId ?? "TBD";
  return entry.team_name || entry.display_name || entry.id;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function matchEntrants(tournament: TournamentDetail, matchId: string) {
  const sides = tournament.match_sides
    .filter((side) => side.tournament_match_id === matchId)
    .sort((left, right) => left.side_index - right.side_index);
  if (!sides.length) return "No entrants assigned";
  return sides
    .map((side) => entryLabel(tournament.entries.find((entry) => entry.id === side.entry_id), side.entry_id))
    .join(" vs ");
}

function reviewsForMatch(reviews: TournamentMatchResultReview[], matchId: string) {
  return [...reviews]
    .filter((review) => review.tournament_match_id === matchId)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .slice(0, 4);
}

export function TournamentResultReviewPanelClient({ action, tournaments }: Props) {
  const actionableTournaments = useMemo(
    () =>
      tournaments.filter((tournament) =>
        tournament.matches.some((match) => !["completed", "voided", "cancelled"].includes(match.status))
      ),
    [tournaments]
  );

  const [selectedTournamentId, setSelectedTournamentId] = useState(() => actionableTournaments[0]?.id ?? tournaments[0]?.id ?? "");

  const selectedTournament = useMemo(
    () => tournaments.find((tournament) => tournament.id === selectedTournamentId) ?? actionableTournaments[0] ?? tournaments[0] ?? null,
    [actionableTournaments, selectedTournamentId, tournaments]
  );

  const selectedTournamentMatches = useMemo(
    () =>
      [...(selectedTournament?.matches ?? [])]
        .filter((match) => !["completed", "voided", "cancelled"].includes(match.status))
        .sort((left, right) => {
          const statusWeight = (status: string) => status === "disputed" ? 0 : status === "under_review" ? 1 : status === "awaiting_results" ? 2 : status === "active" ? 3 : 4;
          const byStatus = statusWeight(left.status) - statusWeight(right.status);
          if (byStatus !== 0) return byStatus;
          return left.match_number - right.match_number;
        }),
    [selectedTournament]
  );

  const [selectedMatchId, setSelectedMatchId] = useState(() => selectedTournamentMatches[0]?.id ?? "");

  useEffect(() => {
    if (!selectedTournament) {
      setSelectedMatchId("");
      return;
    }
    if (selectedTournamentMatches.some((match) => match.id === selectedMatchId)) return;
    setSelectedMatchId(selectedTournamentMatches[0]?.id ?? "");
  }, [selectedMatchId, selectedTournament, selectedTournamentMatches]);

  const selectedMatch = useMemo(
    () => selectedTournamentMatches.find((match) => match.id === selectedMatchId) ?? selectedTournamentMatches[0] ?? null,
    [selectedMatchId, selectedTournamentMatches]
  );

  const selectedFormat = selectedTournament?.format;
  const decisionOptions = selectedFormat && cumulativeFormats.has(selectedFormat) ? cumulativeDecisions : headToHeadDecisions;
  const [selectedDecision, setSelectedDecision] = useState<TournamentResultReviewDecision>(decisionOptions[0]?.value ?? "mark_disputed");

  useEffect(() => {
    if (decisionOptions.some((option) => option.value === selectedDecision)) return;
    setSelectedDecision(decisionOptions[0]?.value ?? "mark_disputed");
  }, [decisionOptions, selectedDecision]);

  const selectedMatchSides = useMemo(
    () =>
      (selectedTournament?.match_sides ?? [])
        .filter((side) => side.tournament_match_id === selectedMatch?.id && side.entry_id)
        .sort((left, right) => left.side_index - right.side_index),
    [selectedMatch?.id, selectedTournament]
  );

  const entrantOptions = selectedMatchSides.map((side) => {
    const entry = selectedTournament?.entries.find((item) => item.id === side.entry_id);
    return {
      entryId: side.entry_id!,
      label: `${entryLabel(entry, side.entry_id)}${typeof side.seed === "number" ? ` (Seed ${side.seed})` : ""}`
    };
  });

  if (!tournaments.length) {
    return <div className="rounded-md border border-line bg-surfaceWarm p-4 text-sm font-bold text-muted">Load tournament detail data to review results.</div>;
  }

  if (!selectedTournament || !selectedMatch) {
    return (
      <div className="grid gap-3 rounded-md border border-line bg-surfaceWarm p-4 text-sm font-bold text-muted">
        <p>No tournament matches are waiting for manual result review right now.</p>
        <p>You can still use cumulative scoring below for score-based formats.</p>
      </div>
    );
  }

  const needsWinner = winnerRequiredDecisions.has(selectedDecision);
  const needsPenalty = penalizedRequiredDecisions.has(selectedDecision);
  const recentReviews = reviewsForMatch(selectedTournament.result_reviews, selectedMatch.id);

  return (
    <form action={action} className="grid gap-4 p-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Tournament
          <select
            className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
            name="tournament_id"
            onChange={(event) => setSelectedTournamentId(event.target.value)}
            required
            value={selectedTournament.id}
          >
            {actionableTournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.title} - {displayEnumLabel(tournament.format)} - {displayEnumLabel(tournament.status)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Decision
          <select
            className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
            name="decision"
            onChange={(event) => setSelectedDecision(event.target.value as TournamentResultReviewDecision)}
            value={selectedDecision}
          >
            {decisionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-md border border-line bg-surfaceWarm p-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="cyan">{displayEnumLabel(selectedTournament.format)}</Badge>
          <Badge tone="warning">{displayEnumLabel(selectedTournament.status)}</Badge>
          <Badge tone="neutral">{displayEnumLabel(selectedMatch.status)}</Badge>
        </div>
        <p className="mt-3 text-sm font-black text-ink">
          Match #{selectedMatch.match_number}: {matchEntrants(selectedTournament, selectedMatch.id)}
        </p>
        <p className="mt-1 font-mono text-xs font-bold text-muted [overflow-wrap:anywhere]">
          Match ID: {selectedMatch.id}
          {selectedMatch.match_room_id ? ` / Room ID: ${selectedMatch.match_room_id}` : " / No linked room"}
        </p>
        {cumulativeFormats.has(selectedTournament.format) ? (
          <p className="mt-2 text-xs font-bold text-warning">
            This format settles placements through cumulative scoring. Use result review here only for dispute or void decisions.
          </p>
        ) : (
          <p className="mt-2 text-xs font-bold text-muted">
            Winner decisions here update tournament advancement, linked room state, and audit history together.
          </p>
        )}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Match
          <select
            className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
            name="match_id"
            onChange={(event) => setSelectedMatchId(event.target.value)}
            required
            value={selectedMatch.id}
          >
            {selectedTournamentMatches.map((match) => (
              <option key={match.id} value={match.id}>
                #{match.match_number} - {displayEnumLabel(match.status)} - {matchEntrants(selectedTournament, match.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Winning entry
          <select
            className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action disabled:bg-surface"
            disabled={!needsWinner}
            name="winning_entry_id"
          >
            <option value="">{needsWinner ? "Select winning entrant" : "Not needed for this decision"}</option>
            {entrantOptions.map((entrant) => (
              <option key={entrant.entryId} value={entrant.entryId}>
                {entrant.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Penalized entry
          <select
            className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action disabled:bg-surface"
            disabled={!needsPenalty}
            name="penalized_entry_id"
          >
            <option value="">{needsPenalty ? "Select penalized entrant" : "Not needed for this decision"}</option>
            {entrantOptions.map((entrant) => (
              <option key={entrant.entryId} value={entrant.entryId}>
                {entrant.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Linked room result claim ID
          <input
            className="min-h-11 rounded-md border border-line bg-white px-3 font-mono text-xs outline-none focus:border-action"
            name="result_claim_id"
            placeholder={selectedMatch.match_room_id ? "Optional open room claim ID for this linked room" : "Only used when this tournament match is linked to a room"}
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Score summary
          <input
            className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
            name="score_summary"
            placeholder="2-1, 12 pts, DQ, no-show, or dispute summary"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-bold text-ink">
        Review note
        <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="note" />
      </label>

      {recentReviews.length ? (
        <div className="grid gap-2 rounded-md border border-line bg-white p-3">
          <div>
            <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-dim">Recent review history</p>
            <p className="mt-1 text-xs font-bold text-muted">This keeps duplicate actions and conflicting admin decisions visible before you submit another one.</p>
          </div>
          {recentReviews.map((review) => (
            <div className="rounded-md border border-line bg-surfaceWarm p-3" key={review.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="cyan">{displayEnumLabel(review.decision)}</Badge>
                <span className="text-xs font-bold text-muted">{formatDateTime(review.created_at)}</span>
              </div>
              <p className="mt-2 text-sm font-bold text-ink">
                Winner: {entryLabel(selectedTournament.entries.find((entry) => entry.id === review.winning_entry_id), review.winning_entry_id)} / Penalized: {entryLabel(selectedTournament.entries.find((entry) => entry.id === review.penalized_entry_id), review.penalized_entry_id)}
              </p>
              {review.score_summary ? <p className="mt-1 text-xs font-bold text-muted">Score: {review.score_summary}</p> : null}
              {review.result_claim_id ? <p className="mt-1 font-mono text-[0.7rem] font-bold text-muted [overflow-wrap:anywhere]">Claim: {review.result_claim_id}</p> : null}
              {review.note ? <p className="mt-1 text-xs font-bold text-muted">{review.note}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton idleLabel="Save result decision" pendingLabel="Saving result decision..." />
        <p className="text-xs font-bold text-muted">
          Review history, winner identity, and linked room context stay visible so ops can confirm the right action before writing bracket state.
        </p>
      </div>
    </form>
  );
}
