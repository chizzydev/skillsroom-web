import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { PlayerTrustSummary } from "@/lib/match-room-api";

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

export function PlayerTrustCard({ trust, compact = false }: { trust: PlayerTrustSummary; compact?: boolean }) {
  const totalGames = Math.max(trust.wins + trust.losses, 0);
  const winRate = totalGames > 0 ? Math.round((trust.wins / totalGames) * 100) : 0;

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
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Rep</span>
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
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Disputes</span>
          <strong className="mt-1 block text-xl font-black text-warning">{trust.disputes_lost}</strong>
        </div>
      </div>

      {!compact ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone={trust.profile_complete ? "success" : "warning"}>{trust.profile_complete ? "Profile complete" : "Profile incomplete"}</Badge>
          <Badge tone={trust.primary_game_status === "verified" ? "success" : trust.primary_game_status ? "warning" : "neutral"}>
            {trust.primary_game_status ? `${trust.primary_game_status} handle` : "No primary handle"}
          </Badge>
          <Badge tone={trust.moderation_status === "clear" ? "success" : "danger"}>{trust.moderation_status.replace("_", " ")}</Badge>
          {typeof trust.open_risk_flags === "number" ? <Badge tone={trust.open_risk_flags > 0 ? "danger" : "success"}>{trust.open_risk_flags} flags</Badge> : null}
        </div>
      ) : null}
    </article>
  );
}
