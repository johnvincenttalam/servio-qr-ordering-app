import { useState, useEffect } from "react";
import {
  fetchActiveBanners,
  fetchActiveCategories,
  fetchActiveMenuItems,
} from "@/services/menu";
import type { MenuItem, MenuCategory, PromoBanner } from "@/types";

interface UseMenuReturn {
  items: MenuItem[];
  categories: { id: MenuCategory; label: string; icon: string | null }[];
  banners: PromoBanner[];
  isLoading: boolean;
  error: string | null;
}

export function useMenu(): UseMenuReturn {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<
    { id: MenuCategory; label: string; icon: string | null }[]
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
          fetchActiveMenuItems(),
          fetchActiveCategories(),
          fetchActiveBanners(),
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
