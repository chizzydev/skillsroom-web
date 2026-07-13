import sharp from "sharp";
import { imageDimensions, type ImageDimensions } from "./image-dimensions";

export const mediaThumbnailWidth = 480;

export type GeneratedMediaThumbnail = {
  bytes: Buffer;
  width: number;
  height: number;
  mimeType: "image/webp";
};

export function thumbnailFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, ".thumb.webp");
}

export async function generateImageThumbnail(input: {
  bytes: Buffer;
  mimeType: string;
  fallbackDimensions?: ImageDimensions | null;
}): Promise<GeneratedMediaThumbnail | null> {
  if (!input.mimeType.startsWith("image/")) return null;
  const dimensions = input.fallbackDimensions ?? imageDimensions(input.bytes, input.mimeType);
  if (!dimensions) return null;

  const resized = sharp(input.bytes, { failOn: "error" })
    .rotate()
    .resize({ width: mediaThumbnailWidth, withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 });

  const { data, info } = await resized.toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) return null;
  return {
    bytes: data,
    width: info.width,
    height: info.height,
    mimeType: "image/webp"
  };
}
