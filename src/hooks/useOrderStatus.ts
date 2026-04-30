import { useState, useEffect, useCallback } from "react";
import { fetchOrderStatus } from "@/services/order-service";
import { supabase } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/types";

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
    if (!orderId) {
      setOrder(null);
      return;
    }

    let cancelled = false;

    // Initial fetch
    (async () => {
      setIsLoading(true);
      try {
        const result = await fetchOrderStatus(orderId);
        if (!cancelled) setOrder(result ?? null);
      } catch {
        // Keep previous state on error
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    // Subscribe to status changes via Supabase realtime — staff updates the
    // status from the kitchen and the customer's UI reacts instantly.
    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if (cancelled) return;
          const next = payload.new as { status?: OrderStatus };
          if (next.status) {
            setOrder((prev) =>
              prev ? { ...prev, status: next.status as OrderStatus } : prev
            );
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return { order, isLoading, refetch };
}
