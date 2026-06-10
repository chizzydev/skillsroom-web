import { ImageResponse } from "next/og";
import { formatMinorMoney, getMatchWinnerPage } from "@/lib/match-room-api";
import { shareCardShell, shareCardSize } from "@/lib/share-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = shareCardSize;
export const contentType = "image/png";

function scoreSummaryLabel(value: string | null | undefined) {
  return value && value.trim().length ? value : "No score line supplied";
}

export default async function Image({ params }: { params: Promise<{ matchRoomId: string }> }) {
  const { matchRoomId } = await params;
  let title = "Room winner approved";
  let subtitle = "Verified public match result on Skillsroom.";
  let metrics = [{ label: "Result", value: "Approved" }];

  try {
    const winnerPage = await getMatchWinnerPage(matchRoomId);
    title = winnerPage.winner.label;
    subtitle = `${winnerPage.room.title ?? winnerPage.room.room_code} in ${winnerPage.room.game_name ?? "Skillsroom"}.`;
    metrics = [
      { label: "Room", value: winnerPage.room.room_code },
      { label: "Stake", value: formatMinorMoney(winnerPage.room.currency, winnerPage.room.entry_amount_minor) },
      { label: "Score", value: scoreSummaryLabel(winnerPage.result.score_summary) },
      { label: "State", value: winnerPage.result.status_label }
    ];
  } catch {}

  return new ImageResponse(
    shareCardShell({
      eyebrow: "Room Winner",
      title,
      subtitle,
      accent: "#38bdf8",
      metrics,
      footer: "Approved room result"
    }),
    size
  );
}
