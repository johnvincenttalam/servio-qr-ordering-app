import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import type { CartItemSelection, OrderStatus } from "@/types";

export interface KitchenOrderItem {
  lineId: string;
  name: string;
  quantity: number;
  selections: CartItemSelection[];
}

export interface KitchenOrder {
  id: string;
  tableId: string;
  status: OrderStatus;
  customerName: string | null;
  notes: string | null;
  createdAt: number;
  items: KitchenOrderItem[];
}

interface OrderRow {
  id: string;
  table_id: string;
  status: OrderStatus;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
  items: {
    line_id: string;
    name: string;
    quantity: number;
    selections: CartItemSelection[] | null;
  }[];
}

const ACTIVE_STATUSES: OrderStatus[] = ["pending", "preparing", "ready"];

function rowToOrder(row: OrderRow): KitchenOrder {
  return {
    id: row.id,
    tableId: row.table_id,
    status: row.status,
    customerName: row.customer_name,
    notes: row.notes,
    createdAt: new Date(row.created_at).getTime(),
    items: row.items.map((it) => ({
      lineId: it.line_id,
      name: it.name,
      quantity: it.quantity,
      selections: it.selections ?? [],
    })),
  };
}

interface UseKitchenOrdersReturn {
  orders: KitchenOrder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  advance: (id: string, current: OrderStatus) => Promise<void>;
}

export function useKitchenOrders(): UseKitchenOrdersReturn {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("orders")
      .select(
        `
        id, table_id, status, customer_name, notes, created_at,
        items:order_items(line_id, name, quantity, selections)
        `
      )
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: true });

    if (queryError) {
      console.error("[kitchen] fetch failed:", queryError);
      setError(queryError.message);
      return;
    }

    setError(null);
    setOrders(((data ?? []) as OrderRow[]).map(rowToOrder));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refetch();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  useRealtimeTables({
    channel: "kitchen-orders",
    tables: ["orders", "order_items"],
    onChange: () => refetch(),
  });

  const advance = useCallback(
    async (id: string, current: OrderStatus) => {
      const next: OrderStatus | "served" | null =
        current === "pending"
          ? "preparing"
          : current === "preparing"
          ? "ready"
          : current === "ready"
          ? "served"
          : null;
      if (!next) return;

      // Optimistic update — wrapped in startViewTransition so the card
      // smoothly morphs between columns (or fades out when served)
      // instead of pop-disappearing. Each card has a stable
      // viewTransitionName ("kitchen-order-<id>") which the browser
      // tracks across positions.
      const performAdvance = () => {
        setOrders((prev) => {
          if (next === "served") {
            return prev.filter((o) => o.id !== id);
          }
          return prev.map((o) =>
            o.id === id ? { ...o, status: next as OrderStatus } : o
          );
        });
      };

      const docVT = document as Document & {
        startViewTransition?: (cb: () => void) => unknown;
      };
      if (typeof docVT.startViewTransition === "function") {
        docVT.startViewTransition(performAdvance);
      } else {
        performAdvance();
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: next })
        .eq("id", id);

      if (updateError) {
        console.error("[kitchen] advance failed:", updateError);
        toast.error("Couldn't update order — try again");
        // Roll back by refetching
        refetch();
        return;
      }

      // Fire-and-forget push notification when an order becomes ready.
      // Errors are logged but don't block the UI flow.
      if (next === "ready") {
        supabase.functions
          .invoke("send-order-push", { body: { order_id: id } })
          .then(({ error: pushError }) => {
            if (pushError) {
              console.warn("[kitchen] push send failed:", pushError);
            }
          });
      }
    },
    [refetch]
  );

  return { orders, isLoading, error, refetch, advance };
}
