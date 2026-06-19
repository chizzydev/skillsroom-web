import { createHash } from "node:crypto";
import { evidenceStorageProvider } from "./evidence-storage-provider";

export const chatImageMaxBytes = 8 * 1024 * 1024;
export const chatDocumentMaxBytes = 12 * 1024 * 1024;

function formatByteSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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
  "application/pdf": {
    extension: "pdf",
    matches: (bytes) => {
      const probe = bytes.subarray(0, Math.min(bytes.byteLength, 1024));
      return probe.indexOf(Buffer.from("%PDF-")) >= 0;
    }
  },
  "application/msword": { extension: "doc", matches: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: "docx", matches: (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) },
  "application/vnd.oasis.opendocument.text": { extension: "odt", matches: (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) },
  "text/plain": { extension: "txt", matches: (bytes) => bytes.byteLength > 0 && bytes.subarray(0, Math.min(bytes.byteLength, 4096)).every((byte) => byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte !== 0x7f)) }
};

function fileExtension(fileName: string | null | undefined) {
  const normalized = fileName?.trim().toLowerCase() ?? "";
  const lastDot = normalized.lastIndexOf(".");
  return lastDot >= 0 ? normalized.slice(lastDot + 1) : "";
}

function classifyChatMedia(file: File): { attachmentType: ChatAttachmentKind; extension: string; mimeType: ChatMediaMime; matches: (bytes: Buffer) => boolean; maxBytes: number } {
  const imageRule = imageRules[file.type as ChatImageMime];
  if (imageRule) return { attachmentType: "image", extension: imageRule.extension, mimeType: file.type as ChatImageMime, matches: imageRule.matches, maxBytes: chatImageMaxBytes };
  const documentRule = documentRules[file.type as ChatDocumentMime];
  if (documentRule) return { attachmentType: "document", extension: documentRule.extension, mimeType: file.type as ChatDocumentMime, matches: documentRule.matches, maxBytes: chatDocumentMaxBytes };
  const extension = fileExtension(file.name);
  if (extension === "jpg" || extension === "jpeg") return { attachmentType: "image", extension: "jpg", mimeType: "image/jpeg", matches: imageRules["image/jpeg"].matches, maxBytes: chatImageMaxBytes };
  if (extension === "png") return { attachmentType: "image", extension: "png", mimeType: "image/png", matches: imageRules["image/png"].matches, maxBytes: chatImageMaxBytes };
  if (extension === "webp") return { attachmentType: "image", extension: "webp", mimeType: "image/webp", matches: imageRules["image/webp"].matches, maxBytes: chatImageMaxBytes };
  if (extension === "pdf") return { attachmentType: "document", extension: "pdf", mimeType: "application/pdf", matches: documentRules["application/pdf"].matches, maxBytes: chatDocumentMaxBytes };
  if (extension === "doc") return { attachmentType: "document", extension: "doc", mimeType: "application/msword", matches: documentRules["application/msword"].matches, maxBytes: chatDocumentMaxBytes };
  if (extension === "docx") return { attachmentType: "document", extension: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", matches: documentRules["application/vnd.openxmlformats-officedocument.wordprocessingml.document"].matches, maxBytes: chatDocumentMaxBytes };
  if (extension === "odt") return { attachmentType: "document", extension: "odt", mimeType: "application/vnd.oasis.opendocument.text", matches: documentRules["application/vnd.oasis.opendocument.text"].matches, maxBytes: chatDocumentMaxBytes };
  if (extension === "txt") return { attachmentType: "document", extension: "txt", mimeType: "text/plain", matches: documentRules["text/plain"].matches, maxBytes: chatDocumentMaxBytes };
  throw new Error("Only JPG, PNG, WEBP, PDF, DOC, DOCX, ODT, and TXT files are supported.");
}

export async function storeChatMedia(input: { file: File; attachmentId: string }) {
  const rule = classifyChatMedia(input.file);
  const bytes = Buffer.from(await input.file.arrayBuffer());
  if (bytes.byteLength < 1) throw new Error("Attachment is empty. Choose a different file.");
  if (bytes.byteLength > rule.maxBytes) {
    throw new Error(
      rule.attachmentType === "image"
        ? `Image is ${formatByteSize(bytes.byteLength)}. Max is 8 MB.`
        : `Document is ${formatByteSize(bytes.byteLength)}. Max is 12 MB.`
    );
  }
  if (!rule.matches(bytes)) throw new Error("The file content does not match its file type.");
  const storageKey = `chat-media-v1_${input.attachmentId}.${rule.extension}`;
  await evidenceStorageProvider().writeFile(storageKey, bytes, { exclusive: true });
  return {
    attachmentType: rule.attachmentType,
    storageKey,
    mimeType: rule.mimeType,
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
