/**
 * Banners data layer — Supabase queries for the carousel banners. Hard
 * delete (no archived_at column); reorder is via integer position.
 */
import { supabase } from "@/lib/supabase";

export interface AdminBanner {
  id: string;
  image: string;
  title: string | null;
  subtitle: string | null;
  position: number;
  active: boolean;
}

export interface BannerDraft {
  image: string;
  title: string | null;
  subtitle: string | null;
  active: boolean;
}

interface BannerRow {
  id: string;
  image: string;
  title: string | null;
  subtitle: string | null;
  position: number;
  active: boolean;
}

function rowToBanner(row: BannerRow): AdminBanner {
  return row;
}

function draftToRow(draft: BannerDraft) {
  return {
    image: draft.image,
    title: draft.title,
    subtitle: draft.subtitle,
    active: draft.active,
  };
}

function generateBannerId(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 5);
  return `banner-${stamp}-${rand}`;
}

// ──────────────────────────────────────────────────────────────────
// Reads
// ──────────────────────────────────────────────────────────────────

export interface BannersFetchResult {
  items: AdminBanner[];
  error: string | null;
}

export async function fetchBanners(): Promise<BannersFetchResult> {
  const { data, error } = await supabase
    .from("banners")
    .select("id, image, title, subtitle, position, active")
    .order("position", { ascending: true });

  if (error) {
    console.error("[services/banners] fetch failed:", error);
    return { items: [], error: error.message };
  }

  return {
    items: ((data ?? []) as BannerRow[]).map(rowToBanner),
    error: null,
  };
}

// ──────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────

export function setBannerActive(id: string, active: boolean) {
  return supabase.from("banners").update({ active }).eq("id", id);
}

export async function saveBanner(
  id: string,
  draft: BannerDraft
): Promise<void> {
  const { error } = await supabase
    .from("banners")
    .update(draftToRow(draft))
    .eq("id", id);
  if (error) {
    console.error("[services/banners] save failed:", error);
    throw error;
  }
}

/**
 * Insert a new banner. Caller passes the highest existing position so
 * we can append past it without disturbing existing ordering.
 */
export async function createBanner(
  draft: BannerDraft,
  maxPosition: number
): Promise<void> {
  const id = generateBannerId();
  const { error } = await supabase.from("banners").insert({
    id,
    ...draftToRow(draft),
    position: maxPosition + 10,
  });
  if (error) {
    console.error("[services/banners] create failed:", error);
    throw error;
  }
}

/** Hard delete — banners don't carry an archived_at column. */
export async function deleteBanner(id: string): Promise<void> {
  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) {
    console.error("[services/banners] delete failed:", error);
    throw error;
  }
}

/**
 * Swap two banners' positions in a single Promise.all. Returns the
 * combined error if either side failed so the caller can decide
 * whether to refetch.
 */
export async function swapBannerPositions(
  a: { id: string; position: number },
  b: { id: string; position: number }
): Promise<{ error: unknown }> {
  const [r1, r2] = await Promise.all([
    supabase.from("banners").update({ position: b.position }).eq("id", a.id),
    supabase.from("banners").update({ position: a.position }).eq("id", b.id),
  ]);
  return { error: r1.error ?? r2.error ?? null };
}
