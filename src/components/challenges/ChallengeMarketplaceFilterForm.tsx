"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect } from "react";
import type { Game, MatchChallengeSkillLevel } from "@/lib/match-room-api";

type ChallengeMarketplaceFilterFormProps = {
  games: Game[];
  selectedGameSlug?: string;
  selectedPlatform?: string;
  selectedRegion?: string;
  selectedSkillLevel?: MatchChallengeSkillLevel;
  skillLevels: { value: MatchChallengeSkillLevel; label: string }[];
  platforms: string[];
  regions: string[];
};

const resultsHash = "#challenge-results";

function clean(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value.trim() : "";
  const normalized = next.toLowerCase();
  if (normalized === "any" || normalized === "all" || normalized === "any region" || normalized === "all regions") return undefined;
  return next ? next : undefined;
}

function marketplaceUrl(params: Record<string, string | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `/challenges?${query}${resultsHash}` : `/challenges${resultsHash}`;
}

function realOptions(values: string[]) {
  return values.filter((value) => clean(value));
}

function scrollToResults() {
  window.requestAnimationFrame(() => {
    document.getElementById("challenge-results")?.scrollIntoView({ block: "start" });
  });
}

export function ChallengeMarketplaceFilterForm({
  games,
  selectedGameSlug,
  selectedPlatform,
  selectedRegion,
  selectedSkillLevel,
  skillLevels,
  platforms,
  regions
}: ChallengeMarketplaceFilterFormProps) {
  const router = useRouter();
  const platformOptions = realOptions(platforms);
  const regionOptions = realOptions(regions);

  useEffect(() => {
    if (window.location.hash === resultsHash) scrollToResults();
  }, [selectedGameSlug, selectedPlatform, selectedRegion, selectedSkillLevel]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    router.push(marketplaceUrl({
      game_slug: clean(formData.get("game_slug")),
      platform: clean(formData.get("platform")),
      region: clean(formData.get("region")),
      skill_level: clean(formData.get("skill_level"))
    }));
    scrollToResults();
  };

  const handleClear = () => {
    router.push(marketplaceUrl({}));
    scrollToResults();
  };

  return (
    <form className="grid gap-3 border-b border-line bg-white p-4 md:grid-cols-5" onSubmit={handleSubmit}>
      <div className="min-w-0 md:col-span-5">
        <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Marketplace</p>
        <h3 className="mt-1 text-base font-black leading-tight text-ink">Open H2H challenges</h3>
        <p className="mt-1 text-sm leading-6 text-muted">Filter by the kind of match you want to play now.</p>
      </div>
      <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
        Game
        <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-bold normal-case tracking-normal text-ink outline-none focus:border-action" name="game_slug" defaultValue={selectedGameSlug ?? ""}>
          <option value="">All games</option>
          {games.map((game) => <option key={game.id} value={game.slug}>{game.name}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
        Platform
        <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-bold normal-case tracking-normal text-ink outline-none focus:border-action" name="platform" defaultValue={selectedPlatform ?? ""}>
          <option value="">Any platform</option>
          {platformOptions.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
        Region
        <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-bold normal-case tracking-normal text-ink outline-none focus:border-action" name="region" defaultValue={selectedRegion ?? ""}>
          <option value="">Any region</option>
          {regionOptions.map((region) => <option key={region} value={region}>{region}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
        Skill
        <select className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-bold normal-case tracking-normal text-ink outline-none focus:border-action" name="skill_level" defaultValue={selectedSkillLevel ?? ""}>
          <option value="">All skills</option>
          {skillLevels.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <div className="grid gap-2">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-muted">Filters</span>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          <button className="min-h-11 rounded-md bg-navy-900 px-3 text-sm font-black text-white hover:bg-navy-800" type="submit">Show matches</button>
          <button className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-black text-muted hover:bg-surfaceHigh hover:text-ink" onClick={handleClear} type="button">
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}
