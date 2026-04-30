import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { CartItemSelection, OrderStatus } from "@/types";

export type AdminOrderStatus = OrderStatus | "served" | "cancelled";

export interface AdminOrderItem {
  lineId: string;
  itemId: string | null;
  name: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  image: string;
  selections: CartItemSelection[];
}

export interface AdminOrder {
  id: string;
  tableId: string;
  status: AdminOrderStatus;
  total: number;
  customerName: string | null;
  notes: string | null;
  createdAt: number;
  readyAt: number | null;
  items: AdminOrderItem[];
}

interface OrderRow {
  id: string;
  table_id: string;
  status: AdminOrderStatus;
  total: number | string;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
  ready_at: string | null;
  items: {
    line_id: string;
    item_id: string | null;
    name: string;
    base_price: number | string;
    unit_price: number | string;
    quantity: number;
    image: string;
    selections: CartItemSelection[] | null;
  }[];
}

function rowToOrder(row: OrderRow): AdminOrder {
  return {
    id: row.id,
    tableId: row.table_id,
    status: row.status,
    total: Number(row.total),
    customerName: row.customer_name,
    notes: row.notes,
    createdAt: new Date(row.created_at).getTime(),
    readyAt: row.ready_at ? new Date(row.ready_at).getTime() : null,
    items: row.items.map((it) => ({
      lineId: it.line_id,
      itemId: it.item_id,
      name: it.name,
      basePrice: Number(it.base_price),
      unitPrice: Number(it.unit_price),
      quantity: it.quantity,
      image: it.image,
      selections: it.selections ?? [],
    })),
  };
}

interface UseAdminOrdersReturn {
  orders: AdminOrder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setStatus: (id: string, status: AdminOrderStatus) => Promise<void>;
}

const QUERY_LIMIT = 200;

export function useAdminOrders(): UseAdminOrdersReturn {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("orders")
      .select(
        `
        id, table_id, status, total, customer_name, notes, created_at, ready_at,
        items:order_items(line_id, item_id, name, base_price, unit_price, quantity, image, selections)
        `
      )
      .order("created_at", { ascending: false })
      .limit(QUERY_LIMIT);

    if (queryError) {
      console.error("[admin/orders] fetch failed:", queryError);
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

    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          if (!cancelled) refetch();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          if (!cancelled) refetch();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const setStatus = useCallback(
    async (id: string, status: AdminOrderStatus) => {
      // Optimistic
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status } : o))
      );

      const { error: updateError } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", id);

      if (updateError) {
        console.error("[admin/orders] status update failed:", updateError);
        toast.error("Couldn't update order status");
        await refetch();
      }
    },
    [refetch]
  );

  return { orders, isLoading, error, refetch, setStatus };
}
