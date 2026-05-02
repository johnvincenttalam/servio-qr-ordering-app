import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";

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

interface UseTableSessionsReturn {
  sessions: Map<string, TableSession>;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Loads all non-terminal orders and returns a Map<tableId, TableSession>
 * with the per-table aggregations the Tables page needs to render its
 * "Live session" cards. Subscribes to the orders + order_items tables
 * via a dedicated realtime channel so a new order arriving from a
 * customer immediately bumps the right card.
 *
 * Kept lightweight (single SELECT, single subscription) so it doesn't
 * step on the Orders page's hook — different channel name, different
 * column projection.
 */
export function useTableSessions(): UseTableSessionsReturn {
  const [sessions, setSessions] = useState<Map<string, TableSession>>(
    () => new Map()
  );
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("table_id, status, total, created_at, order_items(quantity)")
      .not("status", "in", "(served,cancelled)");

    if (error) {
      console.warn("[admin/table-sessions] fetch failed:", error);
      return;
    }

    const next = new Map<string, TableSession>();
    for (const row of (data ?? []) as OrderRow[]) {
      const createdAt = new Date(row.created_at).getTime();
      const itemCount = row.order_items.reduce(
        (sum, it) => sum + (it.quantity ?? 0),
        0
      );
      const total = Number(row.total);
      const existing = next.get(row.table_id);
      if (existing) {
        existing.activeCount += 1;
        existing.itemCount += itemCount;
        existing.total += total;
        existing.oldestCreatedAt = Math.min(
          existing.oldestCreatedAt,
          createdAt
        );
      } else {
        next.set(row.table_id, {
          activeCount: 1,
          itemCount,
          total,
          oldestCreatedAt: createdAt,
        });
      }
    }
    setSessions(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      await refetch();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  // A change on either orders (status flips, new inserts) or order_items
  // (a line added or quantity edited) can shift a table's aggregate, so
  // we listen on both. Refetching the whole set is simpler than diffing
  // payload deltas, and the result set is small (active orders only).
  useRealtimeTables({
    channel: "admin-table-sessions",
    tables: ["orders", "order_items"],
    onChange: () => {
      void refetch();
    },
  });

  return { sessions, isLoading, refetch };
}
