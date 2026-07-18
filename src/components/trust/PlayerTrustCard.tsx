import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { PlayerTrustBadge, PlayerTrustSummary } from "@/lib/match-room-api";

function trustTone(level: PlayerTrustSummary["trust_level"]): BadgeTone {
  if (level === "ready") return "success";
  if (level === "blocked") return "danger";
  if (level === "review") return "warning";
  return "neutral";
}

function trustLabel(level: PlayerTrustSummary["trust_level"]) {
  if (level === "ready") return "Ready";
  if (level === "blocked") return "Blocked";
  if (level === "review") return "Review";
  return "Incomplete";
}

function playerLabel(trust: PlayerTrustSummary) {
  return trust.display_name || trust.username || `${trust.user_id.slice(0, 8)}...${trust.user_id.slice(-4)}`;
}

function badgeTone(tone: PlayerTrustBadge["tone"]): BadgeTone {
  if (tone === "strong") return "success";
  if (tone === "good") return "cyan";
  if (tone === "watch") return "warning";
  return "neutral";
}

function fallbackTrustBadges(trust: PlayerTrustSummary): PlayerTrustBadge[] {
  return [
    {
      key: "verified_profile",
      label: "Verified profile",
      value: trust.profile_complete ? "Ready" : "Needs setup",
      tone: trust.profile_complete ? "strong" : "watch",
      public_note: trust.profile_complete ? "This player has finished the required player setup." : "This player still has profile steps to finish."
    },
    {
      key: "verified_game_handle",
      label: "Verified game handle",
      value: trust.primary_game_status === "verified" ? "Verified" : trust.primary_game_status ? "Pending" : "Missing",
      tone: trust.primary_game_status === "verified" ? "strong" : trust.primary_game_status ? "good" : "watch",
      public_note: trust.primary_game_status === "verified" ? "This player has a checked primary game handle." : "This player has not completed game handle verification yet."
    },
    {
      key: "completed_matches",
      label: "Completed matches",
      value: trust.completed_matches.toString(),
      tone: trust.completed_matches >= 20 ? "strong" : trust.completed_matches >= 5 ? "good" : "new",
      public_note: "This is the player's settled match history."
    }
  ];
}

export function PlayerTrustCard({ trust, compact = false }: { trust: PlayerTrustSummary; compact?: boolean }) {
  const totalGames = Math.max(trust.wins + trust.losses, 0);
  const winRate = totalGames > 0 ? Math.round((trust.wins / totalGames) * 100) : 0;
  const badges = trust.trust_badges?.length ? trust.trust_badges : fallbackTrustBadges(trust);
  const visibleBadges = compact ? badges.slice(0, 4) : badges;

  return (
    <article className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-tight">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">Player trust</p>
          <h3 className="mt-2 truncate text-lg font-black text-ink">{playerLabel(trust)}</h3>
          {trust.primary_game_handle ? (
            <p className="mt-1 truncate font-mono text-xs font-bold text-muted">{trust.primary_game_handle}</p>
          ) : null}
        </div>
        <Badge tone={trustTone(trust.trust_level)}>{trustLabel(trust.trust_level)}</Badge>
      </div>

      <div className={["mt-4 grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"].join(" ")}>
        <div className="min-w-0 rounded-md border border-line bg-surfaceWarm p-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Trust score</span>
          <strong className="mt-1 block text-xl font-black text-ink">{trust.reputation_score}</strong>
        </div>
        <div className="min-w-0 rounded-md border border-line bg-surfaceWarm p-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Matches</span>
          <strong className="mt-1 block text-xl font-black text-ink">{trust.completed_matches}</strong>
        </div>
        <div className="min-w-0 rounded-md border border-line bg-surfaceWarm p-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Win rate</span>
          <strong className="mt-1 block text-xl font-black text-success">{winRate}%</strong>
        </div>
        <div className="min-w-0 rounded-md border border-line bg-surfaceWarm p-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Dispute rate</span>
          <strong className="mt-1 block text-xl font-black text-warning">{trust.dispute_rate ?? 0}%</strong>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {visibleBadges.map((item) => (
          <div className="rounded-md border border-line bg-surfaceHigh p-3" key={item.key}>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-black uppercase tracking-[0.12em] text-muted">{item.label}</span>
              <Badge tone={badgeTone(item.tone)}>{item.value}</Badge>
            </div>
            {!compact ? <p className="mt-2 text-xs leading-5 text-muted">{item.public_note}</p> : null}
          </div>
        ))}
      </div>

      {!compact && typeof trust.open_risk_flags === "number" ? (
        <p className="mt-3 text-xs font-bold text-muted">
          Admin view: {trust.open_risk_flags} open safety note{trust.open_risk_flags === 1 ? "" : "s"}.
        </p>
      ) : null}
    </article>
  );
}
