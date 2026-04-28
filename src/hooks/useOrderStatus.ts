import { useState, useEffect, useCallback } from "react";
import { fetchOrderStatus } from "@/services/order-service";
import type { Order } from "@/types";

interface UseOrderStatusReturn {
  order: Order | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useOrderStatus(orderId: string | null): UseOrderStatusReturn {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!orderId) return;
    setIsLoading(true);
    try {
      const result = await fetchOrderStatus(orderId);
      setOrder(result ?? null);
    } catch {
      // Keep previous state on error
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    refetch();
    const interval = setInterval(refetch, 5000);
    return () => clearInterval(interval);
  }, [orderId, refetch]);

  return { order, isLoading, refetch };
}
