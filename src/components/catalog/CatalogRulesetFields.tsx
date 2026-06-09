"use client";

import { useEffect, useMemo, useState } from "react";
import type { Game, MatchRuleset } from "@/lib/match-room-api";

type CatalogRulesetFieldsProps = {
  games: Game[];
  rulesets: MatchRuleset[];
  initialGameSlug?: string | null;
  initialRulesetSlug?: string | null;
  gameFieldName?: string;
  rulesetFieldName?: string;
  gameLabel?: string;
  rulesetLabel?: string;
  includeFlexibleOption?: boolean;
  flexibleLabel?: string;
};

function labelizePlatform(value: string) {
  return value.replaceAll("_", " ");
}

export function CatalogRulesetFields({
  games,
  rulesets,
  initialGameSlug,
  initialRulesetSlug,
  gameFieldName = "game_slug",
  rulesetFieldName = "ruleset_slug",
  gameLabel = "Game",
  rulesetLabel = "Ruleset",
  includeFlexibleOption = false,
  flexibleLabel = "No fixed ruleset"
}: CatalogRulesetFieldsProps) {
  const fallbackGameSlug = initialGameSlug && games.some((game) => game.slug === initialGameSlug)
    ? initialGameSlug
    : games[0]?.slug ?? "";
  const [selectedGameSlug, setSelectedGameSlug] = useState(fallbackGameSlug);
  const [selectedRulesetSlug, setSelectedRulesetSlug] = useState(initialRulesetSlug ?? "");

  const filteredRulesets = useMemo(() => {
    const game = games.find((item) => item.slug === selectedGameSlug);
    if (!game) return [];
    return rulesets.filter((ruleset) => ruleset.game_id === game.id);
  }, [games, rulesets, selectedGameSlug]);

  useEffect(() => {
    if (!filteredRulesets.length) {
      if (selectedRulesetSlug) setSelectedRulesetSlug("");
      return;
    }

    if (!filteredRulesets.some((ruleset) => ruleset.slug === selectedRulesetSlug)) {
      setSelectedRulesetSlug(filteredRulesets[0]?.slug ?? "");
    }
  }, [filteredRulesets, selectedRulesetSlug]);

  return (
    <>
      <label className="grid gap-2 text-sm font-bold text-ink">
        {gameLabel}
        <select
          className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
          name={gameFieldName}
          onChange={(event) => setSelectedGameSlug(event.target.value)}
          value={selectedGameSlug}
        >
          {games.map((game) => (
            <option key={game.id} value={game.slug}>
              {game.name} · {labelizePlatform(game.platform)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-bold text-ink">
        {rulesetLabel}
        <select
          className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
          name={rulesetFieldName}
          onChange={(event) => setSelectedRulesetSlug(event.target.value)}
          value={selectedRulesetSlug}
        >
          {includeFlexibleOption ? <option value="">{flexibleLabel}</option> : null}
          {filteredRulesets.map((ruleset) => (
            <option key={ruleset.id} value={ruleset.slug}>
              {ruleset.title}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
