import type { Metadata, Viewport } from "next";
import "./globals.css";

const metadataBase = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100");
const googleSiteVerification =
  process.env.GOOGLE_SITE_VERIFICATION || "wn_XVKvcJ_ARs9kgs8mWqMRUe2AjdXsxwp5tcidZiOU";

export const metadata: Metadata = {
  title: "Skillsroom",
  description: "Fair match rooms, tournaments, and gaming community tools on Skillsroom.",
  metadataBase,
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  },
  verification: {
    google: googleSiteVerification
  },
  openGraph: {
    title: "Skillsroom",
    description: "Fair match rooms, tournaments, and gaming community tools on Skillsroom.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    siteName: "Skillsroom",
    type: "website",
    url: metadataBase
  },
  twitter: {
    card: "summary_large_image",
    title: "Skillsroom",
    description: "Fair match rooms, tournaments, and gaming community tools on Skillsroom.",
    images: ["/opengraph-image"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#172331"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body className="font-ui">{children}</body>
    </html>
  );
}
