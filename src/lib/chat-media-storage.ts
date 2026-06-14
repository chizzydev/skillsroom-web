import { createHash } from "node:crypto";
import { evidenceStorageProvider } from "./evidence-storage-provider";

export const chatImageMaxBytes = 8 * 1024 * 1024;

const imageRules = {
  "image/jpeg": { extension: "jpg", matches: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", matches: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  "image/webp": { extension: "webp", matches: (bytes: Buffer) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" }
} as const;

export type ChatImageMime = keyof typeof imageRules;

export async function storeChatImage(input: { file: File; attachmentId: string }) {
  if (!input.file.size || input.file.size > chatImageMaxBytes) throw new Error("Choose a JPG, PNG, or WEBP image up to 8MB.");
  const rule = imageRules[input.file.type as ChatImageMime];
  if (!rule) throw new Error("Only JPG, PNG, and WEBP images are supported.");
  const bytes = Buffer.from(await input.file.arrayBuffer());
  if (!rule.matches(bytes)) throw new Error("The image content does not match its file type.");
  const storageKey = `chat-image-v1_${input.attachmentId}.${rule.extension}`;
  await evidenceStorageProvider().writeFile(storageKey, bytes, { exclusive: true });
  return { storageKey, mimeType: input.file.type as ChatImageMime, byteSize: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export function readChatImage(storageKey: string) {
  if (!/^chat-image-v1_[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(storageKey)) throw new Error("Invalid chat image key.");
  return evidenceStorageProvider().readFile(storageKey);
}

export async function deleteChatImage(storageKey: string) {
  if (!/^chat-image-v1_[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(storageKey)) return;
  await evidenceStorageProvider().deleteFile(storageKey).catch(() => undefined);
}
