import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import { optimisticUpdate } from "@/lib/optimistic";
import { formatPrice } from "@/utils";
import type { Category, MenuCategory, MenuItem, MenuOption } from "@/types";

interface MenuItemRow {
  id: string;
  name: string;
  price: number | string;
  image: string;
  category: MenuCategory;
  description: string;
  top_pick: boolean;
  in_stock: boolean;
  options: MenuOption[] | null;
  position: number;
}

function rowToItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    image: row.image,
    category: row.category,
    description: row.description,
    topPick: row.top_pick,
    inStock: row.in_stock,
    options: row.options ?? undefined,
  };
}

export interface MenuItemDraft {
  name: string;
  price: number;
  image: string;
  category: MenuCategory;
  description: string;
  topPick: boolean;
  inStock: boolean;
  options?: MenuOption[];
}

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
  saveItem: (id: string, draft: MenuItemDraft) => Promise<void>;
  createItem: (draft: MenuItemDraft) => Promise<void>;
  archiveItem: (id: string) => Promise<void>;
}

function generateItemId(category: MenuCategory): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 5);
  return `${category}-${stamp}-${rand}`;
}

export function useAdminMenu(): UseAdminMenuReturn {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    // Categories drive the filter chips and the item-editor picker, so
    // they need to load alongside the items themselves. One round trip
    // via Promise.all instead of two sequential fetches.
    const [itemsRes, catsRes] = await Promise.all([
      supabase
        .from("menu_items")
        .select(
          "id, name, price, image, category, description, top_pick, in_stock, options, position"
        )
        .is("archived_at", null)
        .order("category", { ascending: true })
        .order("position", { ascending: true }),
      supabase
        .from("categories")
        .select("id, label, icon, position, archived_at")
        .is("archived_at", null)
        .order("position", { ascending: true }),
    ]);

    if (itemsRes.error || catsRes.error) {
      const e = itemsRes.error ?? catsRes.error;
      console.error("[admin/menu] fetch failed:", e);
      setError(e?.message ?? "Couldn't load menu");
      return;
    }

    setError(null);
    setItems(((itemsRes.data ?? []) as MenuItemRow[]).map(rowToItem));
    setCategories(((catsRes.data ?? []) as CategoryRow[]).map(rowToCategory));
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
        request: () =>
          supabase
            .from("menu_items")
            .update({ in_stock: inStock })
            .eq("id", id),
        undoRequest: () =>
          supabase
            .from("menu_items")
            .update({ in_stock: !inStock })
            .eq("id", id),
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
        request: () =>
          supabase
            .from("menu_items")
            .update({ in_stock: inStock })
            .in("id", ids),
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
              ? supabase
                  .from("menu_items")
                  .update({ in_stock: true })
                  .in("id", toIn)
              : Promise.resolve({ error: null }),
            toOut.length > 0
              ? supabase
                  .from("menu_items")
                  .update({ in_stock: false })
                  .in("id", toOut)
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
        request: () =>
          supabase.from("menu_items").update({ price }).eq("id", id),
        undoRequest:
          prevPrice !== undefined
            ? () =>
                supabase
                  .from("menu_items")
                  .update({ price: prevPrice })
                  .eq("id", id)
            : undefined,
        refetch,
        errorMessage: "Couldn't update price — try again",
        successMessage,
        logTag: "[admin/menu] price update",
      });
    },
    [items, refetch]
  );

  const draftToRow = (draft: MenuItemDraft) => ({
    name: draft.name,
    price: draft.price,
    image: draft.image,
    category: draft.category,
    description: draft.description,
    top_pick: draft.topPick,
    in_stock: draft.inStock,
    options: draft.options && draft.options.length > 0 ? draft.options : null,
  });

  const saveItem = useCallback(
    async (id: string, draft: MenuItemDraft) => {
      const { error: updateError } = await supabase
        .from("menu_items")
        .update(draftToRow(draft))
        .eq("id", id);

      if (updateError) {
        console.error("[admin/menu] save failed:", updateError);
        throw updateError;
      }
      await refetch();
    },
    [refetch]
  );

  const createItem = useCallback(
    async (draft: MenuItemDraft) => {
      const id = generateItemId(draft.category);
      const lastInCategory =
        items.filter((it) => it.category === draft.category).length * 10;

      const { error: insertError } = await supabase
        .from("menu_items")
        .insert({
          id,
          ...draftToRow(draft),
          position: lastInCategory + 10,
        });

      if (insertError) {
        console.error("[admin/menu] create failed:", insertError);
        throw insertError;
      }
      await refetch();
    },
    [items, refetch]
  );

  const archiveItem = useCallback(
    async (id: string) => {
      const { error: updateError } = await supabase
        .from("menu_items")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);

      if (updateError) {
        console.error("[admin/menu] archive failed:", updateError);
        throw updateError;
      }
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
    saveItem,
    createItem,
    archiveItem,
  };
}
