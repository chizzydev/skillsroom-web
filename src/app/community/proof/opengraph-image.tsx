import { ImageResponse } from "next/og";
import { getCommunitySocialProof } from "@/lib/match-room-api";
import { shareCardShell, shareCardSize } from "@/lib/share-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = shareCardSize;
export const contentType = "image/png";

function formatMinor(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value / 100);
}

export default async function Image() {
  let title = "Skillsroom social proof";
  let subtitle = "Live public metrics for competition activity, winners, and queued obligations.";
  let metrics = [
    { label: "Public", value: "Live" },
    { label: "Payouts", value: "Locked" }
  ];

  try {
    const result = await getCommunitySocialProof();
    const proof = result.metrics;
    title = `${proof.matches_completed} matches completed`;
    subtitle = `${proof.tournaments_hosted} tournaments hosted, ${proof.winners_crowned} winners crowned, and ${proof.payout_queue_count} payouts queued.`;
    metrics = [
      { label: "Matches", value: proof.matches_completed.toString() },
      { label: "Winners", value: proof.winners_crowned.toString() },
      { label: "Queued", value: formatMinor(proof.payout_queue_minor) },
      { label: "Verified", value: proof.verified_payout_metrics_enabled ? "Open" : "Locked" }
    ];
  } catch {}

  return new ImageResponse(
    shareCardShell({
      eyebrow: "Social Proof",
      title,
      subtitle,
      accent: "#22c55e",
      metrics,
      footer: "Truth-first public platform metrics"
    }),
    size
  );
}
