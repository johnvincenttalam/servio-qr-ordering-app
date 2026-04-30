import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { MenuCategory, MenuItem, MenuOption } from "@/types";

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

interface UseAdminMenuReturn {
  items: MenuItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setInStock: (id: string, inStock: boolean) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("menu_items")
      .select(
        "id, name, price, image, category, description, top_pick, in_stock, options, position"
      )
      .is("archived_at", null)
      .order("category", { ascending: true })
      .order("position", { ascending: true });

    if (queryError) {
      console.error("[admin/menu] fetch failed:", queryError);
      setError(queryError.message);
      return;
    }

    setError(null);
    setItems(((data ?? []) as MenuItemRow[]).map(rowToItem));
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

  const setInStock = useCallback(
    async (id: string, inStock: boolean) => {
      const prevItem = items.find((it) => it.id === id);

      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, inStock } : item))
      );

      const { error: updateError } = await supabase
        .from("menu_items")
        .update({ in_stock: inStock })
        .eq("id", id);

      if (updateError) {
        console.error("[admin/menu] toggle failed:", updateError);
        toast.error("Couldn't update stock — try again");
        await refetch();
        return;
      }

      const name = prevItem?.name ?? "Item";
      toast(
        inStock ? `${name} back in stock` : `${name} marked sold out`,
        {
          action: {
            label: "Undo",
            onClick: async () => {
              setItems((prev) =>
                prev.map((item) =>
                  item.id === id ? { ...item, inStock: !inStock } : item
                )
              );
              const { error: undoError } = await supabase
                .from("menu_items")
                .update({ in_stock: !inStock })
                .eq("id", id);
              if (undoError) {
                console.error("[admin/menu] undo failed:", undoError);
                toast.error("Couldn't undo — try again");
                await refetch();
              }
            },
          },
          duration: 4000,
        }
      );
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
    isLoading,
    error,
    refetch,
    setInStock,
    saveItem,
    createItem,
    archiveItem,
  };
}
