import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AvatarError } from "@/lib/avatarUpload";
import {
  changeMyPassword,
  removeMyAvatar,
  updateMyDisplayName,
  uploadMyAvatar,
  type PasswordChangeResult,
} from "@/services/profile";

export type { PasswordChangeResult };

/**
 * Self-service profile actions for the currently signed-in staff
 * member. Owns the per-action `pending` flag so each section's UI can
 * disable independently; everything else lives in @/services/profile.
 */
export function useMyProfile(userId: string | null) {
  const [pending, setPending] = useState<
    "name" | "avatar" | "password" | null
  >(null);

  const saveDisplayName = useCallback(async (name: string | null) => {
    setPending("name");
    try {
      await updateMyDisplayName(name);
    } finally {
      setPending(null);
    }
  }, []);

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!userId) throw new Error("Not signed in");
      setPending("avatar");
      try {
        return await uploadMyAvatar(userId, file);
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
      await removeMyAvatar(userId);
    } finally {
      setPending(null);
    }
  }, [userId]);

  const changePassword = useCallback(
    async (newPassword: string): Promise<PasswordChangeResult> => {
      setPending("password");
      try {
        return await changeMyPassword(newPassword);
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
