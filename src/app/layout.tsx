import type { Metadata } from "next";
import "./globals.css";

const metadataBase = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100");
const googleSiteVerification =
  process.env.GOOGLE_SITE_VERIFICATION || "wn_XVKvcJ_ARs9kgs8mWqMRUe2AjdXsxwp5tcidZiOU";

export const metadata: Metadata = {
  title: "Skillsroom",
  description: "Private competitive gaming rooms with verified match review.",
  metadataBase,
  verification: {
    google: googleSiteVerification
  },
  openGraph: {
    title: "Skillsroom",
    description: "Private competitive gaming rooms with verified match review.",
    siteName: "Skillsroom",
    type: "website",
    url: metadataBase
  },
  twitter: {
    card: "summary_large_image",
    title: "Skillsroom",
    description: "Private competitive gaming rooms with verified match review."
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body className="font-ui">{children}</body>
    </html>
  );
}
