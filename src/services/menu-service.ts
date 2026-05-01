import { supabase } from "@/lib/supabase";
import type {
  MenuItem,
  MenuCategory,
  MenuOption,
  PromoBanner,
} from "@/types";

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

export async function fetchMenu(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, price, image, category, description, top_pick, in_stock, options, position")
    .is("archived_at", null)
    .order("category", { ascending: true })
    .order("position", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(rowToItem);
}

interface CategoryRow {
  id: string;
  label: string;
}

export async function fetchCategories(): Promise<
  { id: MenuCategory; label: string }[]
> {
  // RLS hides archived rows from anonymous customers, so the order here
  // is just position — no need for a separate filter.
  const { data, error } = await supabase
    .from("categories")
    .select("id, label")
    .is("archived_at", null)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

export async function fetchMenuItem(
  id: string
): Promise<MenuItem | undefined> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, price, image, category, description, top_pick, in_stock, options, position")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToItem(data) : undefined;
}

interface BannerRow {
  id: string;
  image: string;
  title: string | null;
  subtitle: string | null;
  position: number;
}

export async function fetchBanners(): Promise<PromoBanner[]> {
  const { data, error } = await supabase
    .from("banners")
    .select("id, image, title, subtitle, position")
    .eq("active", true)
    .order("position", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: BannerRow) => ({
    id: row.id,
    image: row.image,
    title: row.title ?? undefined,
    subtitle: row.subtitle ?? undefined,
  }));
}
