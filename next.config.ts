import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3200";
const appHost = new URL(appOrigin).origin;
const apiHost = new URL(apiOrigin).origin;
const connectSources = Array.from(
  new Set([
    "'self'",
    appHost,
    apiHost,
    "https://accounts.google.com",
    "https://www.googleapis.com",
    "https://oauth2.googleapis.com"
  ])
).join(" ");
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  `connect-src ${connectSources}`,
  "frame-src 'self' https://accounts.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.twitch.tv https://www.tiktok.com https://www.facebook.com https://www.instagram.com https://kick.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests"
].join("; ");

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }
        ]
      }
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "90mb"
    }
  }
};

export default nextConfig;
