"use client";

import { useMemo, useState } from "react";
import { CatalogRulesetFields } from "@/components/catalog/CatalogRulesetFields";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Game, MatchRuleset, TournamentFormat } from "@/lib/match-room-api";

type TournamentCreateFormClientProps = {
  action: (formData: FormData) => void | Promise<void>;
  games: Game[];
  initialGameSlug: string;
  rulesets: MatchRuleset[];
};

const formatOptions: Array<{ value: TournamentFormat; label: string; note: string }> = [
  { value: "single_elimination", label: "Knockout", note: "One loss ends the run" },
  { value: "double_elimination", label: "Second chance bracket", note: "Players can recover from one loss" },
  { value: "round_robin", label: "Everyone plays", note: "Best for small groups" },
  { value: "swiss", label: "Swiss rounds", note: "Good for bigger player counts" },
  { value: "group_stage_playoffs", label: "Groups then finals", note: "Groups feed a final bracket" },
  { value: "league", label: "League", note: "Table play over time" },
  { value: "season", label: "Season", note: "Long-running league" },
  { value: "free_for_all", label: "Free-for-all", note: "Many players in one match" },
  { value: "leaderboard", label: "Leaderboard", note: "Rank by score" },
  { value: "race", label: "Race", note: "Rank by finish" },
  { value: "time_trial", label: "Time trial", note: "Rank by best time" },
  { value: "grand_prix", label: "Grand prix", note: "Multiple races with points" }
];

const formatGroups = [
  { label: "Common", values: ["single_elimination", "double_elimination", "round_robin", "swiss", "group_stage_playoffs"] },
  { label: "Long play", values: ["league", "season"] },
  { label: "Score based", values: ["free_for_all", "leaderboard", "race", "time_trial", "grand_prix"] }
];

function selectedFormatNote(value: string) {
  return formatOptions.find((option) => option.value === value)?.note ?? "Tournament format";
}

export function TournamentCreateFormClient({ action, games, initialGameSlug, rulesets }: TournamentCreateFormClientProps) {
  const [entryMode, setEntryMode] = useState("free_solo");
  const [prizeModel, setPrizeModel] = useState("entry_prize");
  const [format, setFormat] = useState<TournamentFormat>("single_elimination");
  const paidEntry = entryMode.includes("paid");
  const teamEntry = entryMode.includes("team");
  const sponsorPrize = prizeModel === "sponsor_prize" || prizeModel === "hybrid_prize";
  const guaranteedPrize = prizeModel === "guaranteed_prize" || prizeModel === "hybrid_prize";

  const formatGroupLabel = useMemo(() => {
    return formatGroups.find((group) => group.values.includes(format))?.label ?? "Format";
  }, [format]);

  return (
    <form action={action} className="grid gap-5 p-4">
      <div className="rounded-md border border-cyan/20 bg-cyanSoft p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="cyan">Simple setup</Badge>
          <Badge tone="neutral">{formatGroupLabel}</Badge>
        </div>
        <p className="mt-3 text-sm font-bold leading-6 text-ink">
          Pick the game, format, entry mode, prize model, registration window, and rules. Extra controls stay below until you need them.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Tournament name
          <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="title" placeholder="Friday Night Masters" required />
        </label>
        <CatalogRulesetFields
          flexibleLabel="Use simple event rules"
          games={games}
          includeFlexibleOption
          initialGameSlug={initialGameSlug}
          initialRulesetSlug=""
          rulesetLabel="Rules"
          rulesets={rulesets}
        />
      </div>

      <label className="grid gap-2 text-sm font-bold text-ink">
        Format
        <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="format" onChange={(event) => setFormat(event.target.value as TournamentFormat)} value={format}>
          {formatGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {formatOptions.filter((option) => group.values.includes(option.value)).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.note}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="text-xs font-bold text-muted">{selectedFormatNote(format)}</span>
      </label>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Entry mode
          <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="entry_mode" onChange={(event) => setEntryMode(event.target.value)} value={entryMode}>
            <option value="free_solo">Free solo entries</option>
            <option value="paid_solo">Paid solo entries</option>
            <option value="sponsored_solo">Sponsored solo entries</option>
            <option value="free_team">Free team entries</option>
            <option value="paid_team">Paid team entries</option>
            <option value="sponsored_team">Sponsored team entries</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Prize model
          <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="prize_model" onChange={(event) => setPrizeModel(event.target.value)} value={prizeModel}>
            <option value="entry_prize">Prize comes from entries</option>
            <option value="no_prize">No prize</option>
            <option value="sponsor_prize">Sponsor adds prize</option>
            <option value="guaranteed_prize">Host sets prize</option>
            <option value="hybrid_prize">Entries plus sponsor or host prize</option>
          </select>
        </label>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-4">
        {paidEntry ? (
          <label className="grid gap-2 text-sm font-bold text-ink">
            Entry amount
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="1000" min="100" name="entry_fee_amount_naira" step="100" type="number" />
          </label>
        ) : null}
        {sponsorPrize ? (
          <label className="grid gap-2 text-sm font-bold text-ink">
            Sponsor prize
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="0" min="0" name="sponsored_prize_pool_naira" step="100" type="number" />
          </label>
        ) : null}
        {guaranteedPrize ? (
          <label className="grid gap-2 text-sm font-bold text-ink">
            Host prize
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="0" min="0" name="guaranteed_prize_pool_naira" step="100" type="number" />
          </label>
        ) : null}
        {teamEntry ? (
          <>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Smallest team
              <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="2" min="2" name="team_size_min" type="number" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Biggest team
              <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="4" min="2" name="team_size_max" type="number" />
            </label>
          </>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-4">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Registration opens
          <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="registration_opens_at" type="datetime-local" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Registration closes
          <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="registration_closes_at" type="datetime-local" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Tournament starts
          <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="starts_at" type="datetime-local" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Tournament ends
          <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="ends_at" type="datetime-local" />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-bold text-ink">
        Event notes
        <textarea className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action" name="description" placeholder="Short rules, platform details, contact path, and anything players must know before joining." />
      </label>

      <details className="rounded-md border border-line bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-black text-ink">More options</summary>
        <div className="grid gap-4 border-t border-line p-4">
          <div className="grid min-w-0 gap-4 lg:grid-cols-4">
            <label className="grid gap-2 text-sm font-bold text-ink">
              Currency
              <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm uppercase outline-none focus:border-action" defaultValue="NGN" maxLength={3} minLength={3} name="currency" required />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Min entries
              <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="2" min="2" name="min_entries" type="number" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Max entries
              <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" defaultValue="16" min="2" name="max_entries" required type="number" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Service fee
              <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="commission_bps" defaultValue="1000">
                <option value="0">No service fee</option>
                <option value="500">5%</option>
                <option value="1000">10%</option>
                <option value="1500">15%</option>
                <option value="2000">20%</option>
              </select>
            </label>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-ink">
              Scoring
              <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="scoring_mode" defaultValue={["free_for_all", "leaderboard", "race", "time_trial", "grand_prix"].includes(format) ? "placement" : "match_win_loss"}>
                <option value="match_win_loss">Win or loss</option>
                <option value="cumulative_score">Total score</option>
                <option value="points">Points</option>
                <option value="placement">Placement</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Prize split
              <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="prize_distribution_mode" defaultValue="winner_take_all">
                <option value="winner_take_all">Winner takes all</option>
                <option value="top_2_split">Top 2 split</option>
                <option value="top_3_split">Top 3 split</option>
                <option value="custom_fixed">Custom fixed</option>
                <option value="custom_percentage">Custom percentage</option>
              </select>
            </label>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_1fr_1fr]">
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink">
              <input defaultChecked name="evidence_required" type="checkbox" />
              Proof required
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink">
              <input name="match_check_in_required" type="checkbox" />
              Match check-in
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink">
              <input name="allow_waitlist" type="checkbox" />
              Waitlist
            </label>
          </div>

          <label className="grid gap-2 text-sm font-bold text-ink">
            Tie-breakers
            <input className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" name="tiebreakers" placeholder="Head-to-head, score difference, fastest time" />
          </label>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton idleLabel="Create draft tournament" pendingLabel="Creating draft tournament..." />
        <p className="text-xs font-bold leading-5 text-muted">
          You can publish, seed, review results, and prepare prizes after the draft is created.
        </p>
      </div>
    </form>
  );
}
