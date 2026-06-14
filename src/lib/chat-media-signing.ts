import { createHmac, timingSafeEqual } from "node:crypto";

type MediaToken = { attachmentId: string; channel: string; storageKey: string; mimeType: string; exp: number };

function secret() {
  return process.env.CHAT_MEDIA_SIGNING_SECRET || process.env.SKILL_ROOMS_ACCESS_TOKEN_SECRET || "skillsroom-local-chat-media-signing-change-before-production";
}

export function signChatMedia(input: Omit<MediaToken, "exp">, ttlSeconds = 300) {
  const payload = Buffer.from(JSON.stringify({ ...input, exp: Math.floor(Date.now() / 1000) + ttlSeconds } satisfies MediaToken)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyChatMedia(token: string): MediaToken | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as MediaToken;
    if (value.exp < Math.floor(Date.now() / 1000)) return null;
    if (!/^[0-9a-f-]{36}$/i.test(value.attachmentId) || !/^[A-Za-z0-9_-]{2,80}$/.test(value.channel)) return null;
    return value;
  } catch { return null; }
}
