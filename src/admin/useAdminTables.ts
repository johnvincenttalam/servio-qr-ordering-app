import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import { optimisticUpdate } from "@/lib/optimistic";
import {
  archiveTable,
  countActiveOrdersForTable,
  createTable,
  fetchTables,
  restoreTable,
  rotateTableToken,
  saveTableLabel,
  type AdminTable,
  type TableDraft,
} from "@/services/tables";

export type { AdminTable, TableDraft };

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

export function useAdminTables(): UseAdminTablesReturn {
  const [items, setItems] = useState<AdminTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const result = await fetchTables();
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setItems(result.items);
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
      await createTable(draft);
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
        request: () => saveTableLabel(id, label),
        refetch,
        errorMessage: "Couldn't save label",
        successMessage: null,
        logTag: "[admin/tables] save label",
      }),
    [refetch]
  );

  const archive = useCallback(
    async (id: string) => {
      const archivedAt = Date.now();
      return optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((t) => (t.id === id ? { ...t, archivedAt } : t))
          ),
        request: () => archiveTable(id),
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
        request: () => restoreTable(id),
        refetch,
        errorMessage: "Couldn't restore",
        successMessage: null,
        logTag: "[admin/tables] restore",
      }),
    [refetch]
  );

  const rotateToken = useCallback(
    async (id: string) => {
      try {
        // Optimistic so the QR modal re-renders immediately. The
        // service throws on failure so we surface a toast + refetch
        // to reset to the server's truth.
        const next = await rotateTableToken(id);
        setItems((prev) =>
          prev.map((t) => (t.id === id ? { ...t, qrToken: next } : t))
        );
        return next;
      } catch (err) {
        toast.error("Couldn't rotate token");
        await refetch();
        throw err;
      }
    },
    [refetch]
  );

  const countActiveOrders = useCallback(
    (id: string) => countActiveOrdersForTable(id),
    []
  );

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
