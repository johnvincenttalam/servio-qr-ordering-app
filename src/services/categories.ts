/**
 * Categories data layer — Supabase queries for the menu categories
 * table plus comparison + sort helpers shared with the hook.
 */
import { supabase } from "@/lib/supabase";
import type { Category } from "@/types";

export interface CategoryDraft {
  id: string;
  label: string;
  icon: string | null;
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

function compareIds(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Active rows first (sorted by position), archived rows after (sorted
 * by id) so the manager always lists usable categories at the top
 * regardless of when they were archived. Exported so the move()
 * optimistic re-sort matches the fetched order exactly.
 */
export function compareCategoriesForList(a: Category, b: Category): number {
  const aArchived = a.archivedAt !== null;
  const bArchived = b.archivedAt !== null;
  if (aArchived !== bArchived) return aArchived ? 1 : -1;
  if (!aArchived) return a.position - b.position;
  return compareIds(a.id, b.id);
}

// ──────────────────────────────────────────────────────────────────
// Reads
// ──────────────────────────────────────────────────────────────────

export interface CategoriesFetchResult {
  items: Category[];
  error: string | null;
}

export async function fetchCategories(): Promise<CategoriesFetchResult> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, label, icon, position, archived_at");

  if (error) {
    console.error("[services/categories] fetch failed:", error);
    return { items: [], error: error.message };
  }

  const items = ((data ?? []) as CategoryRow[]).map(rowToCategory);
  items.sort(compareCategoriesForList);
  return { items, error: null };
}

/**
 * Active menu items currently using this category. Drives the archive
 * confirmation's warning so admins see at a glance whether they're
 * archiving a category that still has dependents.
 */
export async function countItemsInCategory(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("category", id)
    .is("archived_at", null);
  if (error) {
    console.error("[services/categories] count failed:", error);
    return 0;
  }
  return count ?? 0;
}

// ──────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────

/**
 * Insert a new category. Caller passes the highest existing position
 * so we can append past it without reshuffling.
 */
export async function createCategory(
  draft: CategoryDraft,
  maxPosition: number
): Promise<void> {
  const trimmedId = draft.id.trim().toLowerCase();
  const trimmedLabel = draft.label.trim();
  const { error } = await supabase.from("categories").insert({
    id: trimmedId,
    label: trimmedLabel,
    icon: draft.icon,
    position: maxPosition + 10,
  });
  if (error) {
    console.error("[services/categories] create failed:", error);
    throw error;
  }
}

export function saveCategoryDetails(
  id: string,
  fields: { label: string; icon: string | null }
) {
  return supabase
    .from("categories")
    .update({ label: fields.label.trim(), icon: fields.icon ?? null })
    .eq("id", id);
}

export function archiveCategory(id: string) {
  return supabase
    .from("categories")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
}

export function restoreCategory(id: string) {
  return supabase
    .from("categories")
    .update({ archived_at: null })
    .eq("id", id);
}

/**
 * Swap two categories' positions in a single Promise.all. Returns
 * combined error so the caller can refetch on failure.
 */
export async function swapCategoryPositions(
  a: { id: string; position: number },
  b: { id: string; position: number }
): Promise<{ error: unknown }> {
  const [r1, r2] = await Promise.all([
    supabase
      .from("categories")
      .update({ position: b.position })
      .eq("id", a.id),
    supabase
      .from("categories")
      .update({ position: a.position })
      .eq("id", b.id),
  ]);
  return { error: r1.error ?? r2.error ?? null };
}
