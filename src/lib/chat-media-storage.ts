import { createHash } from "node:crypto";
import { evidenceStorageProvider } from "./evidence-storage-provider";

export const chatImageMaxBytes = 8 * 1024 * 1024;
export const chatDocumentMaxBytes = 12 * 1024 * 1024;

const imageRules = {
  "image/jpeg": { extension: "jpg", matches: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", matches: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  "image/webp": { extension: "webp", matches: (bytes: Buffer) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" }
} as const;

export type ChatImageMime = keyof typeof imageRules;
export type ChatDocumentMime =
  | "application/pdf"
  | "application/msword"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.oasis.opendocument.text"
  | "text/plain";
export type ChatMediaMime = ChatImageMime | ChatDocumentMime;
export type ChatAttachmentKind = "image" | "document";

const documentRules: Record<ChatDocumentMime, { extension: "pdf" | "doc" | "docx" | "odt" | "txt"; matches: (bytes: Buffer) => boolean }> = {
  "application/pdf": { extension: "pdf", matches: (bytes) => bytes.subarray(0, 5).toString("ascii") === "%PDF-" },
  "application/msword": { extension: "doc", matches: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: "docx", matches: (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) },
  "application/vnd.oasis.opendocument.text": { extension: "odt", matches: (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) },
  "text/plain": { extension: "txt", matches: (bytes) => bytes.byteLength > 0 && bytes.subarray(0, Math.min(bytes.byteLength, 4096)).every((byte) => byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte !== 0x7f)) }
};

function classifyChatMedia(file: File): { attachmentType: ChatAttachmentKind; extension: string; matches: (bytes: Buffer) => boolean; maxBytes: number } {
  const imageRule = imageRules[file.type as ChatImageMime];
  if (imageRule) return { attachmentType: "image", extension: imageRule.extension, matches: imageRule.matches, maxBytes: chatImageMaxBytes };
  const documentRule = documentRules[file.type as ChatDocumentMime];
  if (documentRule) return { attachmentType: "document", extension: documentRule.extension, matches: documentRule.matches, maxBytes: chatDocumentMaxBytes };
  throw new Error("Only JPG, PNG, WEBP, PDF, DOC, DOCX, ODT, and TXT files are supported.");
}

export async function storeChatMedia(input: { file: File; attachmentId: string }) {
  const rule = classifyChatMedia(input.file);
  if (!input.file.size || input.file.size > rule.maxBytes) {
    throw new Error(rule.attachmentType === "image" ? "Choose a JPG, PNG, or WEBP image up to 8MB." : "Choose a PDF, DOC, DOCX, ODT, or TXT file up to 12MB.");
  }
  const bytes = Buffer.from(await input.file.arrayBuffer());
  if (!rule.matches(bytes)) throw new Error("The file content does not match its file type.");
  const storageKey = `chat-media-v1_${input.attachmentId}.${rule.extension}`;
  await evidenceStorageProvider().writeFile(storageKey, bytes, { exclusive: true });
  return {
    attachmentType: rule.attachmentType,
    storageKey,
    mimeType: input.file.type as ChatMediaMime,
    byteSize: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

export async function storeChatImage(input: { file: File; attachmentId: string }) {
  const stored = await storeChatMedia(input);
  if (stored.attachmentType !== "image") throw new Error("Only JPG, PNG, and WEBP images are supported.");
  return stored;
}

export function readChatMedia(storageKey: string) {
  if (!/^chat-(?:image|media)-v1_[0-9a-f-]{36}\.(jpg|png|webp|pdf|doc|docx|odt|txt)$/i.test(storageKey)) throw new Error("Invalid chat media key.");
  return evidenceStorageProvider().readFile(storageKey);
}

export function readChatImage(storageKey: string) {
  return readChatMedia(storageKey);
}

export async function deleteChatMedia(storageKey: string) {
  if (!/^chat-(?:image|media)-v1_[0-9a-f-]{36}\.(jpg|png|webp|pdf|doc|docx|odt|txt)$/i.test(storageKey)) return;
  await evidenceStorageProvider().deleteFile(storageKey).catch(() => undefined);
}

export async function deleteChatImage(storageKey: string) {
  await deleteChatMedia(storageKey);
}
