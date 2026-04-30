import { useState, useEffect } from "react";
import {
  fetchMenu,
  fetchCategories,
  fetchBanners,
} from "@/services/menu-service";
import type { MenuItem, MenuCategory, PromoBanner } from "@/types";

interface UseMenuReturn {
  items: MenuItem[];
  categories: { id: MenuCategory; label: string }[];
  banners: PromoBanner[];
  isLoading: boolean;
  error: string | null;
}

export function useMenu(): UseMenuReturn {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<
    { id: MenuCategory; label: string }[]
  >([]);
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        const [menuItems, menuCategories, promoBanners] = await Promise.all([
          fetchMenu(),
          fetchCategories(),
          fetchBanners(),
        ]);
        if (!cancelled) {
          setItems(menuItems);
          setCategories(menuCategories);
          setBanners(promoBanners);
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

  return { items, categories, banners, isLoading, error };
}
