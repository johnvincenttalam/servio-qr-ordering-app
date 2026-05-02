import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import { AvatarError } from "@/lib/avatarUpload";
import {
  clearStaffAvatar,
  createStaff as createStaffService,
  deleteStaffMember,
  fetchStaff,
  resetStaffPassword,
  setStaffAvatar as setStaffAvatarService,
  setStaffDisplayName,
  setStaffRole as setStaffRoleService,
  type CreateStaffParams,
  type CreateStaffResult,
  type ResetPasswordResult,
  type StaffMember,
  type StaffRole,
} from "@/services/staff";

export type {
  CreateStaffParams,
  CreateStaffResult,
  ResetPasswordResult,
  StaffMember,
  StaffRole,
};

interface UseAdminStaffReturn {
  members: StaffMember[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createStaff: (params: CreateStaffParams) => Promise<CreateStaffResult>;
  resetPassword: (userId: string) => Promise<ResetPasswordResult>;
  setRole: (userId: string, role: StaffRole) => Promise<void>;
  setDisplayName: (userId: string, name: string | null) => Promise<void>;
  setAvatar: (userId: string, file: File) => Promise<void>;
  removeAvatar: (userId: string) => Promise<void>;
  remove: (userId: string) => Promise<void>;
}

export function useAdminStaff(): UseAdminStaffReturn {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const result = await fetchStaff();
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setMembers(result.members);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refetch();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  useRealtimeTables({
    channel: "admin-staff",
    tables: ["staff"],
    onChange: () => refetch(),
  });

  const createStaff = useCallback<UseAdminStaffReturn["createStaff"]>(
    async (params) => {
      const result = await createStaffService(params);
      if (result.ok) await refetch();
      return result;
    },
    [refetch]
  );

  const resetPassword = useCallback<UseAdminStaffReturn["resetPassword"]>(
    async (userId) => {
      const result = await resetStaffPassword(userId);
      // password_temporary flips back to true on the server; refresh
      // to pick that up regardless of which path we took.
      if (result.ok) await refetch();
      return result;
    },
    [refetch]
  );

  const setRole = useCallback(
    async (userId: string, role: StaffRole) => {
      // Optimistic
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m))
      );

      const { error: updateError } = await setStaffRoleService(userId, role);
      if (updateError) {
        // P0001 = our last-admin guard trigger
        const message =
          updateError.code === "P0001"
            ? "Can't demote the last admin"
            : "Couldn't update role";
        console.error("[admin/staff] role update failed:", updateError);
        toast.error(message);
        await refetch();
      }
    },
    [refetch]
  );

  const setDisplayName = useCallback(
    async (userId: string, name: string | null) => {
      const trimmed = name?.trim() || null;

      // Optimistic
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === userId ? { ...m, displayName: trimmed } : m
        )
      );

      const { error: updateError } = await setStaffDisplayName(
        userId,
        trimmed
      );
      if (updateError) {
        console.error("[admin/staff] name update failed:", updateError);
        toast.error("Couldn't save name");
        await refetch();
      }
    },
    [refetch]
  );

  const setAvatar = useCallback(async (userId: string, file: File) => {
    try {
      const url = await setStaffAvatarService(userId, file);
      // Local mirror so we don't flash the old URL between the upload
      // and the realtime channel event.
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === userId ? { ...m, avatarUrl: url } : m
        )
      );
    } catch (err) {
      const message =
        err instanceof AvatarError || err instanceof Error
          ? err.message
          : "Couldn't upload avatar";
      toast.error(message);
      throw err instanceof Error ? err : new Error(message);
    }
  }, []);

  const removeAvatar = useCallback(
    async (userId: string) => {
      // Clear the column first so the UI updates instantly even if the
      // storage delete races; orphaned files are harmless under the cap.
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === userId ? { ...m, avatarUrl: null } : m
        )
      );
      const { error: updateError } = await clearStaffAvatar(userId);
      if (updateError) {
        console.error("[admin/staff] avatar clear failed:", updateError);
        toast.error("Couldn't remove avatar");
        await refetch();
      }
    },
    [refetch]
  );

  const remove = useCallback(
    async (userId: string) => {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));

      const { error: deleteError } = await deleteStaffMember(userId);
      if (deleteError) {
        const message =
          deleteError.code === "P0001"
            ? "Can't remove the last admin"
            : "Couldn't remove staff member";
        console.error("[admin/staff] remove failed:", deleteError);
        toast.error(message);
        await refetch();
      }
    },
    [refetch]
  );

  return {
    members,
    isLoading,
    error,
    refetch,
    createStaff,
    resetPassword,
    setRole,
    setDisplayName,
    setAvatar,
    removeAvatar,
    remove,
  };
}
