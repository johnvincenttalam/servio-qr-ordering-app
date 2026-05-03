/**
 * Menu data layer — owns every Supabase query that touches menu_items,
 * categories, and the public banners read. Mixes customer-facing
 * (anon read) and admin-facing functions in one file because the
 * underlying tables are the same and RLS handles the access split.
 *
 * Mutations return the supabase query builder unawaited so they slot
 * into optimisticUpdate's PromiseLike<DbResult> request shape without
 * extra plumbing.
 */
import { supabase } from "@/lib/supabase";
import type {
  Category,
  MenuCategory,
  MenuItem,
  MenuOption,
  PromoBanner,
} from "@/types";

// ──────────────────────────────────────────────────────────────────
// Row interfaces — DB shape, internal to the data layer.
// Hooks should never see these.
// ──────────────────────────────────────────────────────────────────

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

interface CategoryRow {
  id: string;
  label: string;
  icon: string | null;
  position: number;
  archived_at: string | null;
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

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    position: row.position,
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
  };
}

// ──────────────────────────────────────────────────────────────────
// Domain types exposed by the data layer.
// ──────────────────────────────────────────────────────────────────

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

function draftToRow(draft: MenuItemDraft) {
  return {
    name: draft.name,
    price: draft.price,
    image: draft.image,
    category: draft.category,
    description: draft.description,
    top_pick: draft.topPick,
    in_stock: draft.inStock,
    options: draft.options && draft.options.length > 0 ? draft.options : null,
  };
}

/**
 * Generate a stable id for a new menu item. Stamp + random keeps it
 * unique without a server-side sequence and human-scannable since the
 * category prefix tells you what the row is.
 */
function generateMenuItemId(category: MenuCategory): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 5);
  return `${category}-${stamp}-${rand}`;
}

// ──────────────────────────────────────────────────────────────────
// Reads — admin
// ──────────────────────────────────────────────────────────────────

export interface MenuOverviewFetchResult {
  items: MenuItem[];
  categories: Category[];
  error: string | null;
}

/**
 * Bundle the menu_items + categories fetch into a single Promise.all.
 * Categories drive the filter chips and item-editor picker so they're
 * pulled alongside items. Returns mapped domain objects + an optional
 * error string the hook can surface. Admin manager view.
 */
export async function fetchMenuOverview(): Promise<MenuOverviewFetchResult> {
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
    console.error("[services/menu] fetch failed:", e);
    return {
      items: [],
      categories: [],
      error: e?.message ?? "Couldn't load menu",
    };
  }

  return {
    items: ((itemsRes.data ?? []) as MenuItemRow[]).map(rowToItem),
    categories: ((catsRes.data ?? []) as CategoryRow[]).map(rowToCategory),
    error: null,
  };
}

// ──────────────────────────────────────────────────────────────────
// Reads — public (customer side, anon read)
// ──────────────────────────────────────────────────────────────────

/**
 * Customer-side flat list of active items, ordered for display.
 * Throws on error — the customer hook layer catches and falls back
 * to an empty list with a banner.
 */
export async function fetchActiveMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select(
      "id, name, price, image, category, description, top_pick, in_stock, options, position"
    )
    .is("archived_at", null)
    .order("category", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as MenuItemRow[]).map(rowToItem);
}

/**
 * Customer-side category list for the chip filter. RLS hides
 * archived rows from anonymous customers; the explicit filter is
 * defence in depth.
 */
export async function fetchActiveCategories(): Promise<
  { id: MenuCategory; label: string; icon: string | null }[]
> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, label, icon")
    .is("archived_at", null)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as { id: MenuCategory; label: string; icon: string | null }[];
}

/** Single item lookup; used by fly-to-cart / direct-link flows. */
export async function fetchMenuItem(
  id: string
): Promise<MenuItem | undefined> {
  const { data, error } = await supabase
    .from("menu_items")
    .select(
      "id, name, price, image, category, description, top_pick, in_stock, options, position"
    )
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToItem(data as MenuItemRow) : undefined;
}

interface BannerRow {
  id: string;
  image: string;
  title: string | null;
  subtitle: string | null;
  position: number;
}

/**
 * Customer-side banners — only active=true rows surface on the
 * promo carousel. Maps to PromoBanner (the customer-friendly type
 * with optional title/subtitle).
 */
export async function fetchActiveBanners(): Promise<PromoBanner[]> {
  const { data, error } = await supabase
    .from("banners")
    .select("id, image, title, subtitle, position")
    .eq("active", true)
    .order("position", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as BannerRow[]).map((row) => ({
    id: row.id,
    image: row.image,
    title: row.title ?? undefined,
    subtitle: row.subtitle ?? undefined,
  }));
}

// ──────────────────────────────────────────────────────────────────
// Mutations
// All return the unawaited Supabase query so they fit
// optimisticUpdate's PromiseLike<DbResult> shape.
// ──────────────────────────────────────────────────────────────────

export function setMenuItemInStock(id: string, inStock: boolean) {
  return supabase
    .from("menu_items")
    .update({ in_stock: inStock })
    .eq("id", id);
}

export function setMenuItemsInStock(ids: string[], inStock: boolean) {
  return supabase
    .from("menu_items")
    .update({ in_stock: inStock })
    .in("id", ids);
}

export function setMenuItemPrice(id: string, price: number) {
  return supabase.from("menu_items").update({ price }).eq("id", id);
}

/**
 * One-shot top-pick toggle. The editor sets this alongside other
 * fields, but the admin grid/list also exposes it via a kebab so
 * staff can flip an item to/from the customer "Top picks" strip
 * without opening the full editor.
 */
export function setMenuItemTopPick(id: string, topPick: boolean) {
  return supabase
    .from("menu_items")
    .update({ top_pick: topPick })
    .eq("id", id);
}

/**
 * Full update from a MenuItemDraft. Throws on error so callers can
 * surface validation messages on the editor form.
 */
export async function saveMenuItem(
  id: string,
  draft: MenuItemDraft
): Promise<void> {
  const { error } = await supabase
    .from("menu_items")
    .update(draftToRow(draft))
    .eq("id", id);
  if (error) {
    console.error("[services/menu] save failed:", error);
    throw error;
  }
}

/**
 * Insert a new item. The position is appended past the last item in
 * the same category so the new row lands at the bottom of its group
 * without disturbing existing ordering. Throws on error.
 */
export async function createMenuItem(
  draft: MenuItemDraft,
  itemsInCategory: number
): Promise<void> {
  const id = generateMenuItemId(draft.category);
  const position = (itemsInCategory + 1) * 10;
  const { error } = await supabase
    .from("menu_items")
    .insert({ id, ...draftToRow(draft), position });
  if (error) {
    console.error("[services/menu] create failed:", error);
    throw error;
  }
}

/** Soft-delete via archived_at timestamp. Throws on error. */
export async function archiveMenuItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("menu_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[services/menu] archive failed:", error);
    throw error;
  }
}
