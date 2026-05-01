import { supabase } from "./supabase";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
/**
 * Cap the longest edge so we don't store 12 MP phone shots that the
 * customer-side <img> would have to download and downscale. 1920 keeps
 * room for retina hero rendering on banners while still trimming most
 * uploads dramatically. Aspect ratio is preserved.
 */
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;
const BUCKET = "menu-images";

export class MenuImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MenuImageError";
  }
}

/**
 * Resize the source image so its longest edge ≤ MAX_DIMENSION while
 * preserving aspect ratio, then encode as JPEG. Photos compress far
 * better than PNG for menu/banner content (no transparency needed) so
 * we always re-encode regardless of the input format.
 */
async function processImage(file: File): Promise<Blob> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new MenuImageError("Pick a PNG, JPEG, or WebP image.");
  }
  if (file.size > MAX_BYTES) {
    throw new MenuImageError("Image must be under 5 MB.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new MenuImageError("Couldn't read that image — try another file.");
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
  const targetW = Math.round(bitmap.width * scale);
  const targetH = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new MenuImageError("Browser doesn't support canvas — can't process image.");
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new MenuImageError("Couldn't encode the image."));
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

function newImagePath(prefix: "items" | "banners"): string {
  // Random UUID per upload — uploads are independent of the menu item /
  // banner row that ends up referencing them. Worst case: a cancelled
  // upload leaves an orphan, which is fine for our scale.
  const id = (crypto as Crypto & { randomUUID: () => string }).randomUUID();
  return `${prefix}/${id}.jpg`;
}

/**
 * Process, upload, and return a public URL with a cache-bust suffix.
 * Used by both MenuItemEditor and BannerEditor — the prefix arg keeps
 * uploads from the two surfaces in separate folders within one bucket
 * so admins browsing the bucket can tell them apart.
 */
export async function uploadMenuImage(
  file: File,
  prefix: "items" | "banners"
): Promise<string> {
  const blob = await processImage(file);
  const path = newImagePath(prefix);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      upsert: false,
      contentType: "image/jpeg",
      cacheControl: "31536000", // 1 year — paths are unique so the URL never collides
    });

  if (uploadError) {
    throw new MenuImageError(uploadError.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
