import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

function BrandMark() {
  return (
    <svg fill="none" height="132" viewBox="0 0 64 64" width="132" xmlns="http://www.w3.org/2000/svg">
      <rect fill="#0B1324" height="64" rx="18" width="64" />
      <path
        d="M17 21C17 18.7909 18.7909 17 21 17H43C45.2091 17 47 18.7909 47 21V23.25C47 24.6307 45.8807 25.75 44.5 25.75C43.1193 25.75 42 24.6307 42 23.25V22H22V42H31C32.3807 42 33.5 43.1193 33.5 44.5C33.5 45.8807 32.3807 47 31 47H21C18.7909 47 17 45.2091 17 43V21Z"
        fill="#23D8B0"
      />
      <path
        d="M29 19.5C29 18.1193 30.1193 17 31.5 17H43C45.2091 17 47 18.7909 47 21V33.5C47 34.8807 45.8807 36 44.5 36C43.1193 36 42 34.8807 42 33.5V22H31.5C30.1193 22 29 20.8807 29 19.5Z"
        fill="#E9FFF8"
      />
      <path
        d="M28 34.5C28 31.4624 30.4624 29 33.5 29H44C45.6569 29 47 30.3431 47 32V43C47 45.2091 45.2091 47 43 47H33.5C30.4624 47 28 44.5376 28 41.5V34.5Z"
        fill="#23D8B0"
      />
      <path d="M35 34H40.75C41.4404 34 42 34.5596 42 35.25C42 35.9404 41.4404 36.5 40.75 36.5H35C34.3096 36.5 33.75 35.9404 33.75 35.25C33.75 34.5596 34.3096 34 35 34Z" fill="#0B1324" />
      <path d="M35 39.5H40.75C41.4404 39.5 42 40.0596 42 40.75C42 41.4404 41.4404 42 40.75 42H35C34.3096 42 33.75 41.4404 33.75 40.75C33.75 40.0596 34.3096 39.5 35 39.5Z" fill="#0B1324" />
    </svg>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #08111f 0%, #102642 58%, #15345b 100%)",
          color: "#F8FAFC",
          display: "flex",
          height: "100%",
          width: "100%"
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            justifyContent: "space-between",
            padding: "56px 64px"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", maxWidth: 760 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                style={{
                  color: "#78F0D0",
                  display: "flex",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: 4,
                  textTransform: "uppercase"
                }}
              >
                Private Competitive Play
              </div>
              <div style={{ display: "flex", fontSize: 84, fontWeight: 900, letterSpacing: 0, lineHeight: 1.02 }}>
                Skillsroom
              </div>
              <div style={{ color: "#D9E7F7", display: "flex", fontSize: 34, lineHeight: 1.4 }}>
                Verified rooms, tournament operations, evidence review, and controlled settlement flows for serious players.
              </div>
            </div>
            <div style={{ display: "flex", gap: 18 }}>
              {["Rooms", "Tournaments", "Evidence", "Settlement"].map((item) => (
                <div
                  key={item}
                  style={{
                    background: "rgba(233,255,248,0.08)",
                    border: "2px solid rgba(120,240,208,0.22)",
                    borderRadius: 999,
                    color: "#E9FFF8",
                    display: "flex",
                    fontSize: 24,
                    fontWeight: 800,
                    padding: "14px 22px"
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ alignItems: "center", display: "flex", justifyContent: "center", minWidth: 250 }}>
            <div
              style={{
                alignItems: "center",
                background: "rgba(8,17,31,0.38)",
                border: "2px solid rgba(120,240,208,0.18)",
                borderRadius: 40,
                display: "flex",
                height: 250,
                justifyContent: "center",
                width: 250
              }}
            >
              <BrandMark />
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
