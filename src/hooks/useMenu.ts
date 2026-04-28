import { useState, useEffect } from "react";
import { fetchMenu, fetchCategories } from "@/services/menu-service";
import type { MenuItem, MenuCategory } from "@/types";

interface UseMenuReturn {
  items: MenuItem[];
  categories: { id: MenuCategory; label: string }[];
  isLoading: boolean;
  error: string | null;
}

export function useMenu(): UseMenuReturn {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<
    { id: MenuCategory; label: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        const [menuItems, menuCategories] = await Promise.all([
          fetchMenu(),
          fetchCategories(),
        ]);
        if (!cancelled) {
          setItems(menuItems);
          setCategories(menuCategories);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load menu. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, categories, isLoading, error };
}
