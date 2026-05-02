/**
 * Self-service profile data layer — wraps the security-definer RPCs
 * from migration 0011 so non-admin staff can update their own row
 * without being granted broad UPDATE rights on the staff table.
 */
import { supabase } from "@/lib/supabase";
import { removeStaffAvatar, uploadStaffAvatar } from "@/lib/avatarUpload";

export interface PasswordChangeResult {
  ok: boolean;
  message?: string;
}

export async function updateMyDisplayName(name: string | null): Promise<void> {
  const { error } = await supabase.rpc("update_my_display_name", {
    p_name: name ?? "",
  });
  if (error) {
    console.error("[services/profile] updateMyDisplayName failed:", error);
    throw new Error("Couldn't save name");
  }
}

/**
 * Upload the avatar file to Storage, then write the resulting URL
 * onto the staff row via RPC. Returns the URL on success; throws on
 * any failure path.
 */
export async function uploadMyAvatar(
  userId: string,
  file: File
): Promise<string> {
  const url = await uploadStaffAvatar(userId, file);
  const { error } = await supabase.rpc("update_my_avatar_url", { p_url: url });
  if (error) {
    console.error("[services/profile] uploadMyAvatar saveUrl failed:", error);
    throw new Error("Couldn't save avatar URL");
  }
  return url;
}

/**
 * Clear the avatar URL column and (best-effort) delete the underlying
 * storage object. Throws if the column write fails; storage delete
 * failures are silent (the user-visible state is the cleared column).
 */
export async function removeMyAvatar(userId: string): Promise<void> {
  const { error } = await supabase.rpc("update_my_avatar_url", { p_url: "" });
  if (error) {
    console.error("[services/profile] removeMyAvatar clear failed:", error);
    throw new Error("Couldn't remove avatar");
  }
  await removeStaffAvatar(userId);
}

export async function changeMyPassword(
  newPassword: string
): Promise<PasswordChangeResult> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, message: error.message };
  // Clearing the temp flag here is harmless when it was already false.
  // Covers the case where the user landed on /admin/profile mid-forced-flow
  // and changed password from there.
  await supabase.rpc("clear_password_temporary");
  return { ok: true };
}
