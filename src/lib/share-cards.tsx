import type { Metadata } from "next";

export const shareCardSize = {
  width: 1200,
  height: 630
} as const;

export function shareOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
}

export function shareUrl(path: string) {
  return new URL(path, shareOrigin()).toString();
}

export function shareMetadata(input: {
  title: string;
  description: string;
  path: string;
  imagePath?: string;
}) {
  const url = shareUrl(input.path);
  const image = shareUrl(input.imagePath ?? `${input.path.replace(/\/$/, "")}/opengraph-image`);

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      type: "website",
      images: [{ url: image, width: shareCardSize.width, height: shareCardSize.height }]
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image]
    }
  } satisfies Metadata;
}

export function shareCardShell(input: {
  eyebrow: string;
  title: string;
  subtitle: string;
  accent?: string;
  metrics?: Array<{ label: string; value: string }>;
  footer?: string;
}) {
  const accent = input.accent ?? "#22c55e";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background:
          "linear-gradient(135deg, #061223 0%, #0b1c32 45%, #10274a 100%)",
        color: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at top right, rgba(34,197,94,0.28), transparent 28%), radial-gradient(circle at bottom left, rgba(56,189,248,0.24), transparent 32%)"
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          padding: "56px 60px",
          position: "relative"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14
            }}
          >
            <div
              style={{
                display: "flex",
                width: 72,
                height: 72,
                borderRadius: 18,
                background: "#08111f",
                border: `2px solid ${accent}`,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 900,
                color: accent
              }}
            >
              SR
            </div>
            <div
              style={{
                display: "flex",
                padding: "10px 16px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#cbd5e1"
              }}
            >
              {input.eyebrow}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              maxWidth: 980
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 62,
                lineHeight: 1.02,
                fontWeight: 900
              }}
            >
              {input.title}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 28,
                lineHeight: 1.35,
                color: "#dbe4f0",
                maxWidth: 940
              }}
            >
              {input.subtitle}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {input.metrics?.length ? (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {input.metrics.slice(0, 4).map((metric) => (
                <div
                  key={`${metric.label}-${metric.value}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 210,
                    padding: "18px 20px",
                    borderRadius: 20,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: 18,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      color: "#94a3b8"
                    }}
                  >
                    {metric.label}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginTop: 8,
                      fontSize: 32,
                      fontWeight: 900,
                      color: "#f8fafc"
                    }}
                  >
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 20,
              fontWeight: 800,
              color: "#cbd5e1"
            }}
          >
            <div style={{ display: "flex" }}>{input.footer ?? "Verified competition flow"}</div>
            <div style={{ display: "flex", color: accent }}>skillrooms</div>
          </div>
        </div>
      </div>
    </div>
  );
}
