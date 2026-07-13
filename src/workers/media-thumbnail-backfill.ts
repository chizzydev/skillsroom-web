import { fileURLToPath } from "node:url";
import {
  cdnUrlForObjectPath,
  evidenceFileNamePattern,
  evidenceObjectPath,
  readEvidenceMetadata,
  type StoredEvidenceMetadata
} from "@/lib/evidence-storage";
import { evidenceStorageProvider } from "@/lib/evidence-storage-provider";
import { imageDimensions } from "@/lib/image-dimensions";
import { generateImageThumbnail, thumbnailFileName } from "@/lib/media-thumbnails";

type BackfillResult = {
  scanned: number;
  skipped: number;
  generated: number;
  metadataUpdated: number;
  failed: Array<{ fileName: string; message: string }>;
};

function mimeTypeForFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

async function fileExists(fileName: string) {
  try {
    await evidenceStorageProvider().statFile(fileName);
    return true;
  } catch {
    return false;
  }
}

function shouldUpdateMetadata(metadata: StoredEvidenceMetadata, thumbnail: { width: number; height: number }) {
  if (!metadata.thumbnail) return true;
  if (metadata.thumbnail.width !== thumbnail.width || metadata.thumbnail.height !== thumbnail.height) return true;
  if (!metadata.thumbnail.objectPath || metadata.thumbnail.objectPath !== evidenceObjectPath(metadata.fileName).replace(/\.[^.]+$/, ".thumb.webp")) return true;
  if (!metadata.mediaObjectPath || !metadata.cdnUrl && cdnUrlForObjectPath(metadata.mediaObjectPath)) return true;
  return false;
}

async function maybeUpdateEvidenceMetadata(fileName: string, thumbnail: { width: number; height: number }, dimensions: { width: number; height: number } | null) {
  if (!evidenceFileNamePattern.test(fileName)) return false;
  const provider = evidenceStorageProvider();
  const metadata = await readEvidenceMetadata(fileName);
  const mediaObjectPath = evidenceObjectPath(fileName);
  const thumbnailObjectPath = mediaObjectPath.replace(/\.[^.]+$/, ".thumb.webp");
  if (!shouldUpdateMetadata(metadata, thumbnail) && metadata.width && metadata.height) return false;
  const nextMetadata: StoredEvidenceMetadata = {
    ...metadata,
    width: metadata.width ?? dimensions?.width ?? null,
    height: metadata.height ?? dimensions?.height ?? null,
    mediaObjectPath,
    cdnUrl: cdnUrlForObjectPath(mediaObjectPath),
    thumbnail: {
      width: thumbnail.width,
      height: thumbnail.height,
      objectPath: thumbnailObjectPath,
      url: cdnUrlForObjectPath(thumbnailObjectPath)
    }
  };
  await provider.writeMetadata(fileName, nextMetadata);
  return true;
}

export async function backfillMediaThumbnails(input: { force?: boolean } = {}): Promise<BackfillResult> {
  const provider = evidenceStorageProvider();
  const activeFileNames = await provider.listActiveFileNames();
  const result: BackfillResult = {
    scanned: 0,
    skipped: 0,
    generated: 0,
    metadataUpdated: 0,
    failed: []
  };

  for (const fileName of activeFileNames) {
    const mimeType = mimeTypeForFileName(fileName);
    if (!mimeType || fileName.toLowerCase().endsWith(".thumb.webp")) continue;
    result.scanned += 1;

    try {
      const thumbName = thumbnailFileName(fileName);
      const thumbExists = await fileExists(thumbName);
      const bytes = await provider.readFile(fileName);
      const dimensions = imageDimensions(bytes, mimeType);
      const thumbnail = await generateImageThumbnail({ bytes, mimeType, fallbackDimensions: dimensions });
      if (!thumbnail) {
        result.skipped += 1;
        continue;
      }

      if (input.force || !thumbExists) {
        await provider.writeFile(thumbName, thumbnail.bytes, { contentType: thumbnail.mimeType });
        result.generated += 1;
      } else {
        result.skipped += 1;
      }

      if (await maybeUpdateEvidenceMetadata(fileName, thumbnail, dimensions)) {
        result.metadataUpdated += 1;
      }
    } catch (error) {
      result.failed.push({
        fileName,
        message: error instanceof Error ? error.message : "Unknown thumbnail backfill error."
      });
    }
  }

  return result;
}

function isMainModule() {
  return process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
}

if (isMainModule()) {
  backfillMediaThumbnails({ force: process.env.MEDIA_THUMBNAIL_BACKFILL_FORCE === "true" })
    .then((result) => {
      console.log(JSON.stringify({ ok: true, result }, null, 2));
      if (result.failed.length) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Thumbnail backfill failed." }, null, 2));
      process.exitCode = 1;
    });
}
