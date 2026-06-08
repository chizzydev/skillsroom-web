import { ImageResponse } from "next/og";
import { shareCardShell, shareCardSize } from "@/lib/share-cards";

export const alt = "Skillsroom public clans";
export const size = shareCardSize;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    shareCardShell({
      eyebrow: "Public Clans",
      title: "Skillsroom Team Profiles",
      subtitle: "Public clan identity, captains, members, record, and tournament history across the community.",
      accent: "#38bdf8",
      metrics: [
        { label: "Identity", value: "Public" },
        { label: "History", value: "Verified" },
        { label: "Mode", value: "Teams" }
      ],
      footer: "Community team surfaces"
    }),
    size
  );
}
