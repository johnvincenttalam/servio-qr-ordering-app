/**
 * Table-sessions data layer — read-only aggregator that powers the
 * Tables page's "Live session" treatment per card. Pulls all
 * non-terminal orders and groups them by table_id.
 */
import { supabase } from "@/lib/supabase";

/**
 * Aggregate snapshot of the in-progress orders at a single table.
 * "Active" means any order that isn't served or cancelled — pending,
 * preparing, and ready all count as the kitchen-side session.
 */
export interface TableSession {
  activeCount: number;
  itemCount: number;
  total: number;
  oldestCreatedAt: number;
}

interface OrderRow {
  table_id: string;
  status: string;
  total: number | string;
  created_at: string;
  order_items: { quantity: number }[];
}

export interface TableSessionsFetchResult {
  sessions: Map<string, TableSession>;
  error: string | null;
}

/**
 * Loads all non-terminal orders + their item quantities in a single
 * round trip and returns a Map<tableId, TableSession>. The hook
 * layer wraps this with state + realtime; this function is pure.
 */
export async function fetchTableSessions(): Promise<TableSessionsFetchResult> {
  const { data, error } = await supabase
    .from("orders")
    .select("table_id, status, total, created_at, order_items(quantity)")
    .not("status", "in", "(served,cancelled)");

  if (error) {
    console.warn("[services/table-sessions] fetch failed:", error);
    return { sessions: new Map(), error: error.message };
  }

  const sessions = new Map<string, TableSession>();
  for (const row of (data ?? []) as OrderRow[]) {
    const createdAt = new Date(row.created_at).getTime();
    const itemCount = row.order_items.reduce(
      (sum, it) => sum + (it.quantity ?? 0),
      0
    );
    const total = Number(row.total);
    const existing = sessions.get(row.table_id);
    if (existing) {
      existing.activeCount += 1;
      existing.itemCount += itemCount;
      existing.total += total;
      existing.oldestCreatedAt = Math.min(existing.oldestCreatedAt, createdAt);
    } else {
      sessions.set(row.table_id, {
        activeCount: 1,
        itemCount,
        total,
        oldestCreatedAt: createdAt,
      });
    }
  }
  return { sessions, error: null };
}
