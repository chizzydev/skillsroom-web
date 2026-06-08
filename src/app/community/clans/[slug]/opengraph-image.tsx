import { ImageResponse } from "next/og";
import { getCommunityClan } from "@/lib/match-room-api";
import { shareCardShell, shareCardSize } from "@/lib/share-cards";

export const alt = "Skillsroom clan profile";
export const size = shareCardSize;
export const contentType = "image/png";

type ClanOgImageProps = {
  params: Promise<{ slug: string }>;
};

export default async function OpenGraphImage({ params }: ClanOgImageProps) {
  const { slug } = await params;
  const detail = await getCommunityClan(slug);

  return new ImageResponse(
    shareCardShell({
      eyebrow: "Clan Profile",
      title: detail.clan.name,
      subtitle: `${detail.clan.game_focus.join(", ")} • ${detail.clan.member_count} members • captain ${detail.captain?.label ?? "visible player"}`,
      accent: "#38bdf8",
      metrics: [
        { label: "Reputation", value: detail.clan.reputation_score.toString() },
        { label: "Titles", value: detail.clan.tournament_wins.toString() },
        { label: "Record", value: `${detail.clan.match_record.wins}-${detail.clan.match_record.losses}-${detail.clan.match_record.draws}` }
      ],
      footer: "Verified team identity"
    }),
    size
  );
}
