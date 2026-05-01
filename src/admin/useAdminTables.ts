import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";

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

interface UseAdminTablesReturn {
  items: AdminTable[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (draft: TableDraft) => Promise<void>;
  saveLabel: (id: string, label: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
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
      const { error: insertError } = await supabase
        .from("tables")
        .insert({ id: draft.id, label: draft.label });
      if (insertError) {
        console.error("[admin/tables] create failed:", insertError);
        throw insertError;
      }
      await refetch();
    },
    [refetch]
  );

  const saveLabel = useCallback(
    async (id: string, label: string) => {
      // Optimistic
      setItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, label } : t))
      );

      const { error: updateError } = await supabase
        .from("tables")
        .update({ label })
        .eq("id", id);

      if (updateError) {
        console.error("[admin/tables] save failed:", updateError);
        toast.error("Couldn't save label");
        await refetch();
      }
    },
    [refetch]
  );

  const archive = useCallback(
    async (id: string) => {
      // Optimistic
      const at = new Date().toISOString();
      setItems((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, archivedAt: new Date(at).getTime() } : t
        )
      );

      const { error: updateError } = await supabase
        .from("tables")
        .update({ archived_at: at })
        .eq("id", id);

      if (updateError) {
        console.error("[admin/tables] archive failed:", updateError);
        toast.error("Couldn't archive");
        await refetch();
      }
    },
    [refetch]
  );

  const restore = useCallback(
    async (id: string) => {
      setItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, archivedAt: null } : t))
      );

      const { error: updateError } = await supabase
        .from("tables")
        .update({ archived_at: null })
        .eq("id", id);

      if (updateError) {
        console.error("[admin/tables] restore failed:", updateError);
        toast.error("Couldn't restore");
        await refetch();
      }
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
    countActiveOrders,
  };
}
