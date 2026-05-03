import { useState, useEffect, useCallback } from "react";
import { fetchOrderStatus } from "@/services/orders";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/types";

interface UseOrderStatusReturn {
  order: Order | null;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Customer-side live order view. Subscribes to:
 *
 *   • orders          — status flips, total changes, modification_count
 *   • order_items     — admin comp / uncomp / remove, customer-side qty edits
 *
 * Both fire a full refetch (cheap — single order + its items) rather
 * than splice-merging payloads. This keeps the UI consistent with the
 * server's truth even when several mutations land in quick succession
 * (e.g., comp followed by remove on different lines), without the
 * partial-update bugs that plagued the previous status-only listener.
 */
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

    // Background refetch — fires on every realtime payload. Doesn't
    // toggle isLoading so the UI doesn't flicker on every kitchen
    // status flip / item edit.
    const refetchSilent = () => {
      if (cancelled) return;
      fetchOrderStatus(orderId)
        .then((result) => {
          if (!cancelled && result) setOrder(result);
        })
        .catch(() => {
          // Network blip — keep previous state. Next event re-fetches.
        });
    };

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
        refetchSilent
      )
      .on(
        "postgres_changes",
        {
          // Catches admin remove (DELETE), admin comp / uncomp (UPDATE),
          // customer qty-decrease (UPDATE), and any future inserts.
          event: "*",
          schema: "public",
          table: "order_items",
          filter: `order_id=eq.${orderId}`,
        },
        refetchSilent
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return { order, isLoading, refetch };
}
