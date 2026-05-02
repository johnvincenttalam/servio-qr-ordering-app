/**
 * Tables data layer — Supabase queries that touch the `tables` table
 * plus the QR-token generator. Returns mapped domain objects; the
 * hook layer wraps these with state + realtime + optimistic UI.
 */
import { supabase } from "@/lib/supabase";

export interface AdminTable {
  id: string;
  label: string;
  qrToken: string | null;
  archivedAt: number | null;
}

export interface TableDraft {
  id: string;
  label: string;
}

interface TableRow {
  id: string;
  label: string;
  qr_token: string | null;
  archived_at: string | null;
}

function rowToTable(row: TableRow): AdminTable {
  return {
    id: row.id,
    label: row.label,
    qrToken: row.qr_token,
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
  };
}

/**
 * 32-char hex token. 128 bits of entropy is plenty for a non-secret
 * URL parameter that just gates "is this the right printed sticker".
 */
export function generateQrToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Natural-order comparison so "T10" sorts after "T2" instead of
 * before it (lex order would do the wrong thing).
 */
export function compareTableIds(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

// ──────────────────────────────────────────────────────────────────
// Reads
// ──────────────────────────────────────────────────────────────────

export interface TablesFetchResult {
  items: AdminTable[];
  error: string | null;
}

export async function fetchTables(): Promise<TablesFetchResult> {
  const { data, error } = await supabase
    .from("tables")
    .select("id, label, qr_token, archived_at");

  if (error) {
    console.error("[services/tables] fetch failed:", error);
    return { items: [], error: error.message };
  }

  const items = ((data ?? []) as TableRow[]).map(rowToTable);
  items.sort((a, b) => compareTableIds(a.id, b.id));
  return { items, error: null };
}

/**
 * Active orders (pending/preparing/ready) currently on a table.
 * Used by the archive confirmation dialog so admins can see at a
 * glance whether they're hiding a table mid-meal.
 */
export async function countActiveOrdersForTable(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("table_id", id)
    .in("status", ["pending", "preparing", "ready"]);
  if (error) {
    console.error("[services/tables] active-order count failed:", error);
    return 0;
  }
  return count ?? 0;
}

// ──────────────────────────────────────────────────────────────────
// Mutations — return PromiseLike for optimisticUpdate, or throw for
// editor-form flows that need to surface validation errors inline.
// ──────────────────────────────────────────────────────────────────

export async function createTable(draft: TableDraft): Promise<void> {
  // Mint a fresh token at create time so the new table is ready to
  // print without a separate "generate token" step.
  const { error } = await supabase.from("tables").insert({
    id: draft.id,
    label: draft.label,
    qr_token: generateQrToken(),
  });
  if (error) {
    console.error("[services/tables] create failed:", error);
    throw error;
  }
}

export function saveTableLabel(id: string, label: string) {
  return supabase.from("tables").update({ label }).eq("id", id);
}

export function archiveTable(id: string) {
  return supabase
    .from("tables")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
}

export function restoreTable(id: string) {
  return supabase.from("tables").update({ archived_at: null }).eq("id", id);
}

/**
 * Rotate the per-table QR token. Returns the new token on success
 * so callers can update local state; throws on failure.
 */
export async function rotateTableToken(id: string): Promise<string> {
  const next = generateQrToken();
  const { error } = await supabase
    .from("tables")
    .update({ qr_token: next })
    .eq("id", id);
  if (error) {
    console.error("[services/tables] rotate token failed:", error);
    throw error;
  }
  return next;
}
