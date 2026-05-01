import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  AvatarError,
  removeStaffAvatar,
  uploadStaffAvatar,
} from "@/lib/avatarUpload";

export interface PasswordChangeResult {
  ok: boolean;
  message?: string;
}

/**
 * Self-service profile actions for the currently signed-in staff
 * member. Each method goes through the security-definer RPCs from
 * migration 0011 so non-admin users can update their own row without
 * being granted broad UPDATE rights on the staff table.
 */
export function useMyProfile(userId: string | null) {
  const [pending, setPending] = useState<
    "name" | "avatar" | "password" | null
  >(null);

  const saveDisplayName = useCallback(
    async (name: string | null) => {
      setPending("name");
      try {
        const { error } = await supabase.rpc("update_my_display_name", {
          p_name: name ?? "",
        });
        if (error) {
          console.error("[profile] saveDisplayName failed:", error);
          throw new Error("Couldn't save name");
        }
      } finally {
        setPending(null);
      }
    },
    []
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!userId) throw new Error("Not signed in");
      setPending("avatar");
      try {
        const url = await uploadStaffAvatar(userId, file);
        const { error } = await supabase.rpc("update_my_avatar_url", {
          p_url: url,
        });
        if (error) {
          console.error("[profile] uploadAvatar saveUrl failed:", error);
          throw new Error("Couldn't save avatar URL");
        }
        return url;
      } catch (err) {
        const message =
          err instanceof AvatarError || err instanceof Error
            ? err.message
            : "Couldn't upload avatar";
        toast.error(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setPending(null);
      }
    },
    [userId]
  );

  const removeAvatar = useCallback(async () => {
    if (!userId) throw new Error("Not signed in");
    setPending("avatar");
    try {
      const { error } = await supabase.rpc("update_my_avatar_url", {
        p_url: "",
      });
      if (error) {
        console.error("[profile] removeAvatar clear failed:", error);
        throw new Error("Couldn't remove avatar");
      }
      // Best-effort delete of the underlying file. Storage RLS lets the
      // user delete their own folder; ignoring the error because the
      // staff.avatar_url column has already been cleared, which is the
      // user-visible bit.
      await removeStaffAvatar(userId);
    } finally {
      setPending(null);
    }
  }, [userId]);

  const changePassword = useCallback(
    async (newPassword: string): Promise<PasswordChangeResult> => {
      setPending("password");
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) {
          return { ok: false, message: error.message };
        }
        // Clearing the temp flag here is harmless when it was already
        // false. Covers the case where the user landed on /admin/profile
        // mid-forced-flow and changed password from there.
        await supabase.rpc("clear_password_temporary");
        return { ok: true };
      } finally {
        setPending(null);
      }
    },
    []
  );

  return {
    pending,
    saveDisplayName,
    uploadAvatar,
    removeAvatar,
    changePassword,
  };
}
