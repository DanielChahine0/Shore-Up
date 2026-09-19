import "server-only";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export class UploadError extends Error {}

/**
 * Validates an upload and re-encodes it as WebP. Re-encoding drops every piece
 * of metadata, including GPS and other EXIF data, and the file type is checked
 * from the actual bytes rather than the name or the browser's claim.
 */
export async function processImage(file: File, kind: "avatar" | "post"): Promise<Buffer> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Photos can be up to 5 MB each.");
  if (!ALLOWED_TYPES.includes(file.type)) throw new UploadError("Use a JPG, PNG, or WebP photo.");

  const input = Buffer.from(await file.arrayBuffer());
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new UploadError("That file isn't a readable image.");
  }
  if (!format || !["jpeg", "png", "webp"].includes(format)) throw new UploadError("Use a JPG, PNG, or WebP photo.");

  // rotate() bakes in the EXIF orientation before the metadata is discarded.
  const image = sharp(input).rotate();
  const sized = kind === "avatar" ? image.resize(512, 512, { fit: "cover" }) : image.resize(1600, 1600, { fit: "inside", withoutEnlargement: true });
  return sized.webp({ quality: 82 }).toBuffer();
}
