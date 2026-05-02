import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import { optimisticUpdate } from "@/lib/optimistic";

export interface AdminTable {
  id: string;
  label: string;
  qrToken: string | null;
  archivedAt: number | null;
}

interface TableRow {
  id: string;
  label: string;
  qr_token: string | null;
  archived_at: string | null;
}

function rowToTable(row: TableRow): AdminTable {
  return {
    id: row.id,
    label: row.label,
    qrToken: row.qr_token,
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
  };
}

export interface TableDraft {
  id: string;
  label: string;
}

/**
 * 32-char hex token. 128 bits of entropy is plenty for a non-secret
 * URL parameter that just gates "is this the right printed sticker".
 */
function generateQrToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface UseAdminTablesReturn {
  items: AdminTable[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (draft: TableDraft) => Promise<void>;
  saveLabel: (id: string, label: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  /**
   * Generate or rotate the QR token, invalidating any printed stickers
   * that carried the previous value.
   */
  rotateToken: (id: string) => Promise<string>;
  /** Active orders (pending/preparing/ready) currently on a table. */
  countActiveOrders: (id: string) => Promise<number>;
}

function compareIds(a: string, b: string) {
  // "T2" vs "T10" — natural order so T10 doesn't sort before T2.
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function useAdminTables(): UseAdminTablesReturn {
  const [items, setItems] = useState<AdminTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("tables")
      .select("id, label, qr_token, archived_at");

    if (queryError) {
      console.error("[admin/tables] fetch failed:", queryError);
      setError(queryError.message);
      return;
    }

    setError(null);
    const rows = ((data ?? []) as TableRow[]).map(rowToTable);
    rows.sort((a, b) => compareIds(a.id, b.id));
    setItems(rows);
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
    channel: "admin-tables",
    tables: ["tables"],
    onChange: () => refetch(),
  });

  const create = useCallback(
    async (draft: TableDraft) => {
      // Mint a fresh token at create time so the new table is ready to
      // print without a separate "generate token" step.
      const { error: insertError } = await supabase
        .from("tables")
        .insert({
          id: draft.id,
          label: draft.label,
          qr_token: generateQrToken(),
        });
      if (insertError) {
        console.error("[admin/tables] create failed:", insertError);
        throw insertError;
      }
      await refetch();
    },
    [refetch]
  );

  const saveLabel = useCallback(
    async (id: string, label: string) =>
      optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((t) => (t.id === id ? { ...t, label } : t))
          ),
        request: () =>
          supabase.from("tables").update({ label }).eq("id", id),
        refetch,
        errorMessage: "Couldn't save label",
        successMessage: null,
        logTag: "[admin/tables] save label",
      }),
    [refetch]
  );

  const archive = useCallback(
    async (id: string) => {
      const at = new Date().toISOString();
      const archivedAt = new Date(at).getTime();
      return optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((t) => (t.id === id ? { ...t, archivedAt } : t))
          ),
        request: () =>
          supabase
            .from("tables")
            .update({ archived_at: at })
            .eq("id", id),
        refetch,
        errorMessage: "Couldn't archive",
        successMessage: null,
        logTag: "[admin/tables] archive",
      });
    },
    [refetch]
  );

  const restore = useCallback(
    async (id: string) =>
      optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((t) => (t.id === id ? { ...t, archivedAt: null } : t))
          ),
        request: () =>
          supabase
            .from("tables")
            .update({ archived_at: null })
            .eq("id", id),
        refetch,
        errorMessage: "Couldn't restore",
        successMessage: null,
        logTag: "[admin/tables] restore",
      }),
    [refetch]
  );

  const rotateToken = useCallback(
    async (id: string) => {
      const next = generateQrToken();
      // Optimistic so the QR modal re-renders immediately; if the write
      // fails we refetch to reset to the server's truth.
      setItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, qrToken: next } : t))
      );
      const { error: updateError } = await supabase
        .from("tables")
        .update({ qr_token: next })
        .eq("id", id);
      if (updateError) {
        console.error("[admin/tables] rotate token failed:", updateError);
        toast.error("Couldn't rotate token");
        await refetch();
        throw updateError;
      }
      return next;
    },
    [refetch]
  );

  const countActiveOrders = useCallback(async (id: string) => {
    const { count, error: queryError } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("table_id", id)
      .in("status", ["pending", "preparing", "ready"]);
    if (queryError) {
      console.error("[admin/tables] active-order count failed:", queryError);
      return 0;
    }
    return count ?? 0;
  }, []);

  return {
    items,
    isLoading,
    error,
    refetch,
    create,
    saveLabel,
    archive,
    restore,
    rotateToken,
    countActiveOrders,
  };
}
