export type SupportedLivestreamProvider = "youtube" | "twitch" | "kick" | "tiktok";

export const supportedLivestreamProviders: SupportedLivestreamProvider[] = ["youtube", "twitch", "kick", "tiktok"];

export const livestreamProviderLabels: Record<SupportedLivestreamProvider, string> = {
  youtube: "YouTube",
  twitch: "Twitch",
  kick: "Kick",
  tiktok: "TikTok"
};

export const livestreamUrlPlaceholders: Record<SupportedLivestreamProvider, string> = {
  youtube: "https://www.youtube.com/watch?v=...",
  twitch: "https://www.twitch.tv/...",
  kick: "https://kick.com/...",
  tiktok: "https://www.tiktok.com/@player/video/..."
};

const livestreamSubmitHosts: Record<SupportedLivestreamProvider, string[]> = {
  youtube: ["youtube.com", "youtu.be"],
  twitch: ["twitch.tv"],
  kick: ["kick.com", "player.kick.com"],
  tiktok: ["tiktok.com", "tiktokv.com", "vt.tiktok.com"]
};

function hostMatches(host: string, acceptedHost: string) {
  return host === acceptedHost || host.endsWith(`.${acceptedHost}`);
}

export function isSupportedLivestreamProvider(value: string): value is SupportedLivestreamProvider {
  return supportedLivestreamProviders.includes(value as SupportedLivestreamProvider);
}

export function livestreamProviderLabel(provider: string | null | undefined) {
  return isSupportedLivestreamProvider(String(provider || ""))
    ? livestreamProviderLabels[provider as SupportedLivestreamProvider]
    : "Stream";
}

export function inferLivestreamProvider(streamUrl: string): SupportedLivestreamProvider | null {
  try {
    const host = new URL(streamUrl).hostname.toLowerCase();
    if (host === "youtu.be" || hostMatches(host, "youtube.com") || hostMatches(host, "youtube-nocookie.com")) {
      return "youtube";
    }
    if (hostMatches(host, "twitch.tv")) return "twitch";
    if (hostMatches(host, "kick.com")) return "kick";
    if (hostMatches(host, "tiktok.com") || hostMatches(host, "tiktokv.com") || hostMatches(host, "vt.tiktok.com")) {
      return "tiktok";
    }
    return null;
  } catch {
    return null;
  }
}

export function validateLivestreamUrl(provider: SupportedLivestreamProvider, streamUrl: string) {
  try {
    const parsed = new URL(streamUrl);
    if (parsed.protocol !== "https:") return "Use a secure HTTPS stream link.";

    const detectedProvider = inferLivestreamProvider(streamUrl);
    if (!detectedProvider) return "Use a YouTube, Twitch, Kick, or TikTok stream link.";

    if (detectedProvider !== provider) {
      return `Paste a ${livestreamProviderLabels[provider]} link or choose the matching provider.`;
    }

    const host = parsed.hostname.toLowerCase();
    const allowedHosts = livestreamSubmitHosts[provider];
    if (!allowedHosts.some((acceptedHost) => hostMatches(host, acceptedHost))) {
      return `Paste a public ${livestreamProviderLabels[provider]} link.`;
    }

    return null;
  } catch {
    return "Enter a valid stream link.";
  }
}
