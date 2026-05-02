import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import {
  fetchAdminOrders,
  sendReadyPush,
  setOrderStatus,
  type AdminOrder,
  type AdminOrderItem,
  type AdminOrderStatus,
} from "@/services/orders";

export type { AdminOrder, AdminOrderItem, AdminOrderStatus };

interface UseAdminOrdersReturn {
  orders: AdminOrder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setStatus: (id: string, status: AdminOrderStatus) => Promise<void>;
}

export function useAdminOrders(): UseAdminOrdersReturn {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const result = await fetchAdminOrders();
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setOrders(result.orders);
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
    channel: "admin-orders",
    tables: ["orders", "order_items"],
    onChange: () => refetch(),
  });

  const setStatus = useCallback(
    async (id: string, status: AdminOrderStatus) => {
      // Optimistic
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status } : o))
      );

      const { error: updateError } = await setOrderStatus(id, status);

      if (updateError) {
        console.error("[admin/orders] status update failed:", updateError);
        toast.error("Couldn't update order status");
        await refetch();
        return;
      }

      if (status === "ready") {
        sendReadyPush(id);
      }
    },
    [refetch]
  );

  return { orders, isLoading, error, refetch, setStatus };
}
