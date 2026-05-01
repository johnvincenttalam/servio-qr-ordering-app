import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import {
  AvatarError,
  removeStaffAvatar,
  uploadStaffAvatar,
} from "@/lib/avatarUpload";

export type StaffRole = "admin" | "kitchen" | "waiter";

export interface StaffMember {
  userId: string;
  email: string;
  role: StaffRole;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: number;
  lastSignInAt: number | null;
}

interface StaffRow {
  user_id: string;
  email: string;
  role: StaffRole;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

function rowToMember(row: StaffRow): StaffMember {
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: new Date(row.created_at).getTime(),
    lastSignInAt: row.last_sign_in_at
      ? new Date(row.last_sign_in_at).getTime()
      : null,
  };
}

export interface InviteParams {
  email: string;
  role: StaffRole;
  displayName?: string;
}

export interface InviteResult {
  ok: boolean;
  message?: string;
}

interface UseAdminStaffReturn {
  members: StaffMember[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invite: (params: InviteParams) => Promise<InviteResult>;
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
    const { data, error: rpcError } = await supabase.rpc("list_staff");
    if (rpcError) {
      console.error("[admin/staff] list_staff failed:", rpcError);
      setError(rpcError.message);
      return;
    }
    setError(null);
    setMembers(((data ?? []) as StaffRow[]).map(rowToMember));
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

  const invite = useCallback<UseAdminStaffReturn["invite"]>(
    async (params) => {
      const { data, error: invokeError } = await supabase.functions.invoke<
        { ok: boolean; user_id?: string; error?: string }
      >("admin-invite", {
        body: {
          email: params.email,
          role: params.role,
          displayName: params.displayName,
        },
      });

      if (invokeError) {
        return {
          ok: false,
          message: invokeError.message ?? "Couldn't reach the invite service",
        };
      }
      if (data && !data.ok) {
        return { ok: false, message: data.error ?? "Invite failed" };
      }

      await refetch();
      return { ok: true };
    },
    [refetch]
  );

  const setRole = useCallback(
    async (userId: string, role: StaffRole) => {
      // Optimistic
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m))
      );

      const { error: updateError } = await supabase
        .from("staff")
        .update({ role })
        .eq("user_id", userId);

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

      const { error: updateError } = await supabase
        .from("staff")
        .update({ display_name: trimmed })
        .eq("user_id", userId);

      if (updateError) {
        console.error("[admin/staff] name update failed:", updateError);
        toast.error("Couldn't save name");
        await refetch();
      }
    },
    [refetch]
  );

  const setAvatar = useCallback(
    async (userId: string, file: File) => {
      try {
        const url = await uploadStaffAvatar(userId, file);
        const { error: updateError } = await supabase
          .from("staff")
          .update({ avatar_url: url })
          .eq("user_id", userId);
        if (updateError) {
          console.error("[admin/staff] avatar update failed:", updateError);
          throw new Error("Couldn't save avatar");
        }
        // Optimistic + realtime will both kick in; doing it here avoids the
        // brief flash of the old URL while we wait for the channel event.
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
    },
    []
  );

  const removeAvatar = useCallback(
    async (userId: string) => {
      // Clear the column first so the UI updates instantly even if the
      // storage delete races; orphaned files are harmless under the cap.
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === userId ? { ...m, avatarUrl: null } : m
        )
      );
      const { error: updateError } = await supabase
        .from("staff")
        .update({ avatar_url: null })
        .eq("user_id", userId);
      if (updateError) {
        console.error("[admin/staff] avatar clear failed:", updateError);
        toast.error("Couldn't remove avatar");
        await refetch();
        return;
      }
      await removeStaffAvatar(userId);
    },
    [refetch]
  );

  const remove = useCallback(
    async (userId: string) => {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));

      const { error: deleteError } = await supabase
        .from("staff")
        .delete()
        .eq("user_id", userId);

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
    invite,
    setRole,
    setDisplayName,
    setAvatar,
    removeAvatar,
    remove,
  };
}
