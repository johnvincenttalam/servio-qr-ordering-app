import { useCallback, useEffect, useState } from "react";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import { optimisticUpdate } from "@/lib/optimistic";
import {
  archiveMenuItem,
  createMenuItem,
  fetchMenuOverview,
  saveMenuItem,
  setMenuItemInStock,
  setMenuItemsInStock,
  setMenuItemPrice,
  setMenuItemTopPick,
  type MenuItemDraft,
} from "@/services/menu";
import { formatPrice } from "@/utils";
import type { Category, MenuItem } from "@/types";

export type { MenuItemDraft };

interface UseAdminMenuReturn {
  items: MenuItem[];
  /** Active (non-archived) categories, sorted by position. */
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setInStock: (id: string, inStock: boolean) => Promise<void>;
  setInStockBulk: (ids: string[], inStock: boolean) => Promise<void>;
  setPrice: (id: string, price: number) => Promise<void>;
  /** Toggle the "top pick" flag — surfaces in the customer Top Picks strip. */
  setTopPick: (id: string, value: boolean) => Promise<void>;
  saveItem: (id: string, draft: MenuItemDraft) => Promise<void>;
  createItem: (draft: MenuItemDraft) => Promise<void>;
  archiveItem: (id: string) => Promise<void>;
}

/**
 * Admin-side menu state + mutations. Owns React state + realtime
 * wiring; defers every Supabase call to @/services/menu so this hook
 * stays focused on orchestration and the data layer is testable on
 * its own.
 */
export function useAdminMenu(): UseAdminMenuReturn {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const result = await fetchMenuOverview();
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setItems(result.items);
    setCategories(result.categories);
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

  // Realtime: pick up category renames / new categories without a reload.
  useRealtimeTables({
    channel: "admin-menu-categories",
    tables: ["categories"],
    onChange: () => refetch(),
  });

  const setInStock = useCallback(
    async (id: string, inStock: boolean) => {
      const name = items.find((it) => it.id === id)?.name ?? "Item";
      await optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, inStock } : item
            )
          ),
        undo: () =>
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, inStock: !inStock } : item
            )
          ),
        request: () => setMenuItemInStock(id, inStock),
        undoRequest: () => setMenuItemInStock(id, !inStock),
        refetch,
        errorMessage: "Couldn't update stock — try again",
        successMessage: inStock
          ? `${name} back in stock`
          : `${name} marked sold out`,
        logTag: "[admin/menu] toggle",
      });
    },
    [items, refetch]
  );

  const setInStockBulk = useCallback(
    async (ids: string[], inStock: boolean) => {
      if (ids.length === 0) return;

      // Snapshot the prior states so the undo path can restore each
      // item back to where it was, not blanket-reset to the inverse —
      // some of the selected rows may have already been in the target
      // state (no-ops) and we don't want to undo them.
      const prevById = new Map(
        items
          .filter((it) => ids.includes(it.id))
          .map((it) => [it.id, it.inStock !== false] as const)
      );
      const idSet = new Set(ids);
      const noun = ids.length === 1 ? "item" : "items";
      const verb = inStock ? "back in stock" : "marked sold out";

      await optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((item) =>
              idSet.has(item.id) ? { ...item, inStock } : item
            )
          ),
        undo: () =>
          setItems((prev) =>
            prev.map((item) =>
              prevById.has(item.id)
                ? { ...item, inStock: prevById.get(item.id) ?? true }
                : item
            )
          ),
        request: () => setMenuItemsInStock(ids, inStock),
        undoRequest: async () => {
          // Bucket ids by their prior in-stock state so each direction
          // is a single round trip rather than N writes.
          const toIn: string[] = [];
          const toOut: string[] = [];
          for (const [id, wasInStock] of prevById) {
            (wasInStock ? toIn : toOut).push(id);
          }
          const results = await Promise.all([
            toIn.length > 0
              ? setMenuItemsInStock(toIn, true)
              : Promise.resolve({ error: null }),
            toOut.length > 0
              ? setMenuItemsInStock(toOut, false)
              : Promise.resolve({ error: null }),
          ]);
          return { error: results.find((r) => r.error)?.error ?? null };
        },
        refetch,
        errorMessage: "Couldn't update items — try again",
        successMessage: `${ids.length} ${noun} ${verb}`,
        logTag: "[admin/menu] bulk toggle",
      });
    },
    [items, refetch]
  );

  const setPrice = useCallback(
    async (id: string, price: number) => {
      const prevItem = items.find((it) => it.id === id);
      const prevPrice = prevItem?.price;
      const name = prevItem?.name ?? "Item";

      // No prior price (item not found locally) or it's a no-op
      // change → suppress the toast so the operator isn't told about
      // a non-event. The DB write still runs in case local state had
      // drifted from the source of truth.
      const successMessage =
        prevPrice !== undefined && prevPrice !== price
          ? `${name} price ${formatPrice(prevPrice)} → ${formatPrice(price)}`
          : null;

      await optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, price } : item
            )
          ),
        undo:
          prevPrice !== undefined
            ? () =>
                setItems((prev) =>
                  prev.map((item) =>
                    item.id === id ? { ...item, price: prevPrice } : item
                  )
                )
            : undefined,
        request: () => setMenuItemPrice(id, price),
        undoRequest:
          prevPrice !== undefined
            ? () => setMenuItemPrice(id, prevPrice)
            : undefined,
        refetch,
        errorMessage: "Couldn't update price — try again",
        successMessage,
        logTag: "[admin/menu] price update",
      });
    },
    [items, refetch]
  );

  const setTopPick = useCallback(
    async (id: string, value: boolean) => {
      const name = items.find((it) => it.id === id)?.name ?? "Item";
      await optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, topPick: value } : item
            )
          ),
        undo: () =>
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, topPick: !value } : item
            )
          ),
        request: () => setMenuItemTopPick(id, value),
        undoRequest: () => setMenuItemTopPick(id, !value),
        refetch,
        errorMessage: "Couldn't update top pick — try again",
        successMessage: value
          ? `${name} featured as top pick`
          : `${name} unfeatured from top picks`,
        logTag: "[admin/menu] top pick",
      });
    },
    [items, refetch]
  );

  const saveItem = useCallback(
    async (id: string, draft: MenuItemDraft) => {
      await saveMenuItem(id, draft);
      await refetch();
    },
    [refetch]
  );

  const createItem = useCallback(
    async (draft: MenuItemDraft) => {
      const itemsInCategory = items.filter(
        (it) => it.category === draft.category
      ).length;
      await createMenuItem(draft, itemsInCategory);
      await refetch();
    },
    [items, refetch]
  );

  const archiveItem = useCallback(
    async (id: string) => {
      await archiveMenuItem(id);
      await refetch();
    },
    [refetch]
  );

  return {
    items,
    categories,
    isLoading,
    error,
    refetch,
    setInStock,
    setInStockBulk,
    setPrice,
    setTopPick,
    saveItem,
    createItem,
    archiveItem,
  };
}
