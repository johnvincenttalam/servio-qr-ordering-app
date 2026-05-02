import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import { optimisticUpdate } from "@/lib/optimistic";
import type { Category } from "@/types";

interface CategoryRow {
  id: string;
  label: string;
  icon: string | null;
  position: number;
  archived_at: string | null;
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    position: row.position,
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
  };
}

export interface CategoryDraft {
  id: string;
  label: string;
  icon: string | null;
}

interface UseAdminCategoriesReturn {
  items: Category[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (draft: CategoryDraft) => Promise<void>;
  /** Updates label and icon together — the editor saves both at once. */
  saveDetails: (
    id: string,
    fields: { label: string; icon: string | null }
  ) => Promise<void>;
  archive: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  move: (id: string, direction: "up" | "down") => Promise<void>;
  /** Items currently using this category (so archive can warn). */
  countItems: (id: string) => Promise<number>;
}

function compareIds(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function useAdminCategories(): UseAdminCategoriesReturn {
  const [items, setItems] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("categories")
      .select("id, label, icon, position, archived_at");

    if (queryError) {
      console.error("[admin/categories] fetch failed:", queryError);
      setError(queryError.message);
      return;
    }

    setError(null);
    const rows = ((data ?? []) as CategoryRow[]).map(rowToCategory);
    rows.sort((a, b) => {
      // Active rows first (sorted by position), archived rows after
      // (sorted by id) so the manager always lists usable categories
      // at the top regardless of when they were archived.
      const aArchived = a.archivedAt !== null;
      const bArchived = b.archivedAt !== null;
      if (aArchived !== bArchived) return aArchived ? 1 : -1;
      if (!aArchived) return a.position - b.position;
      return compareIds(a.id, b.id);
    });
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
    channel: "admin-categories",
    tables: ["categories"],
    onChange: () => refetch(),
  });

  const create = useCallback(
    async (draft: CategoryDraft) => {
      const trimmedId = draft.id.trim().toLowerCase();
      const trimmedLabel = draft.label.trim();
      // New categories land at the bottom — bigger than the largest
      // current position so they don't disturb existing ordering.
      const maxPosition = items.reduce(
        (m, c) => (c.position > m ? c.position : m),
        0
      );
      const { error: insertError } = await supabase
        .from("categories")
        .insert({
          id: trimmedId,
          label: trimmedLabel,
          icon: draft.icon,
          position: maxPosition + 10,
        });
      if (insertError) {
        console.error("[admin/categories] create failed:", insertError);
        throw insertError;
      }
      await refetch();
    },
    [items, refetch]
  );

  const saveDetails = useCallback(
    async (
      id: string,
      fields: { label: string; icon: string | null }
    ) => {
      const trimmed = fields.label.trim();
      const icon = fields.icon ?? null;
      return optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, label: trimmed, icon } : c
            )
          ),
        request: () =>
          supabase
            .from("categories")
            .update({ label: trimmed, icon })
            .eq("id", id),
        refetch,
        errorMessage: "Couldn't save changes",
        successMessage: null,
        logTag: "[admin/categories] save",
      });
    },
    [refetch]
  );

  const archive = useCallback(
    async (id: string) => {
      const at = new Date().toISOString();
      const archivedAt = new Date(at).getTime();
      return optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((c) => (c.id === id ? { ...c, archivedAt } : c))
          ),
        request: () =>
          supabase
            .from("categories")
            .update({ archived_at: at })
            .eq("id", id),
        refetch,
        errorMessage: "Couldn't archive",
        successMessage: null,
        logTag: "[admin/categories] archive",
      });
    },
    [refetch]
  );

  const restore = useCallback(
    async (id: string) =>
      optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((c) => (c.id === id ? { ...c, archivedAt: null } : c))
          ),
        request: () =>
          supabase
            .from("categories")
            .update({ archived_at: null })
            .eq("id", id),
        refetch,
        errorMessage: "Couldn't restore",
        successMessage: null,
        logTag: "[admin/categories] restore",
      }),
    [refetch]
  );

  const move = useCallback(
    async (id: string, direction: "up" | "down") => {
      // Reorder among active rows only — archived ones don't have a
      // visual position the user cares about.
      const active = items.filter((c) => c.archivedAt === null);
      const sorted = [...active].sort((a, b) => a.position - b.position);
      const index = sorted.findIndex((c) => c.id === id);
      if (index < 0) return;
      const neighborIndex = direction === "up" ? index - 1 : index + 1;
      if (neighborIndex < 0 || neighborIndex >= sorted.length) return;

      const current = sorted[index];
      const neighbor = sorted[neighborIndex];

      const performSwap = () => {
        setItems((prev) => {
          const next = prev.map((c) => {
            if (c.id === current.id) return { ...c, position: neighbor.position };
            if (c.id === neighbor.id) return { ...c, position: current.position };
            return c;
          });
          // Re-sort same way as refetch (active first by position).
          return next.sort((a, b) => {
            const aA = a.archivedAt !== null;
            const bA = b.archivedAt !== null;
            if (aA !== bA) return aA ? 1 : -1;
            if (!aA) return a.position - b.position;
            return compareIds(a.id, b.id);
          });
        });
      };

      const docVT = document as Document & {
        startViewTransition?: (cb: () => void) => unknown;
      };
      if (typeof docVT.startViewTransition === "function") {
        docVT.startViewTransition(performSwap);
      } else {
        performSwap();
      }

      const [r1, r2] = await Promise.all([
        supabase
          .from("categories")
          .update({ position: neighbor.position })
          .eq("id", current.id),
        supabase
          .from("categories")
          .update({ position: current.position })
          .eq("id", neighbor.id),
      ]);

      if (r1.error || r2.error) {
        console.error(
          "[admin/categories] reorder failed:",
          r1.error || r2.error
        );
        toast.error("Couldn't reorder");
        await refetch();
      }
    },
    [items, refetch]
  );

  const countItems = useCallback(async (id: string) => {
    const { count, error: queryError } = await supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("category", id)
      .is("archived_at", null);
    if (queryError) {
      console.error("[admin/categories] count failed:", queryError);
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
    saveDetails,
    archive,
    restore,
    move,
    countItems,
  };
}
