import { supabase } from "./supabase";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const TARGET_SIZE = 256;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export class AvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarError";
  }
}

/**
 * Validates the file, decodes it, crops the center square, resizes to
 * TARGET_SIZE × TARGET_SIZE, and returns a PNG blob ready for upload.
 * Throws AvatarError with a user-friendly message on bad input.
 */
async function processToSquare(file: File): Promise<Blob> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new AvatarError("Pick a PNG, JPEG, or WebP image.");
  }
  if (file.size > MAX_BYTES) {
    throw new AvatarError("Image must be under 2 MB.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarError("Couldn't read that image — try another file.");
  }

  const sourceSize = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - sourceSize) / 2;
  const sy = (bitmap.height - sourceSize) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new AvatarError("Browser doesn't support canvas — can't process image.");
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sourceSize, sourceSize, 0, 0, TARGET_SIZE, TARGET_SIZE);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new AvatarError("Couldn't encode the cropped image."));
      },
      "image/png",
      0.92
    );
  });
}

function avatarPath(userId: string): string {
  // Stable path so successive uploads overwrite the previous file.
  return `staff/${userId}/avatar.png`;
}

/**
 * Crop, resize, upload, and return a public URL with a cache-bust suffix
 * so the browser refetches after a re-upload.
 */
export async function uploadStaffAvatar(
  userId: string,
  file: File
): Promise<string> {
  const blob = await processToSquare(file);
  const path = avatarPath(userId);

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, blob, {
      upsert: true,
      contentType: "image/png",
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new AvatarError(uploadError.message);
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/**
 * Remove the underlying file. Best-effort: if the object is already gone
 * we still treat the operation as successful so the caller can clear the
 * staff.avatar_url column without worrying about state drift.
 */
export async function removeStaffAvatar(userId: string): Promise<void> {
  const path = avatarPath(userId);
  await supabase.storage.from("avatars").remove([path]);
}
