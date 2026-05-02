import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import { optimisticUpdate } from "@/lib/optimistic";
import {
  archiveCategory,
  compareCategoriesForList,
  countItemsInCategory,
  createCategory,
  fetchCategories,
  restoreCategory,
  saveCategoryDetails,
  swapCategoryPositions,
  type CategoryDraft,
} from "@/services/categories";
import type { Category } from "@/types";

export type { CategoryDraft };

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

export function useAdminCategories(): UseAdminCategoriesReturn {
  const [items, setItems] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const result = await fetchCategories();
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
    channel: "admin-categories",
    tables: ["categories"],
    onChange: () => refetch(),
  });

  const create = useCallback(
    async (draft: CategoryDraft) => {
      const maxPosition = items.reduce(
        (m, c) => (c.position > m ? c.position : m),
        0
      );
      await createCategory(draft, maxPosition);
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
        request: () => saveCategoryDetails(id, { label: trimmed, icon }),
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
      const archivedAt = Date.now();
      return optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((c) => (c.id === id ? { ...c, archivedAt } : c))
          ),
        request: () => archiveCategory(id),
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
        request: () => restoreCategory(id),
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
          return next.sort(compareCategoriesForList);
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

      const { error: swapError } = await swapCategoryPositions(
        current,
        neighbor
      );
      if (swapError) {
        toast.error("Couldn't reorder");
        await refetch();
      }
    },
    [items, refetch]
  );

  const countItems = useCallback(
    (id: string) => countItemsInCategory(id),
    []
  );

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
