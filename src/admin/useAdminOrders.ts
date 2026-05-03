import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import {
  approveHeldOrder,
  compOrderItem,
  fetchAdminOrders,
  removeOrderItem,
  sendReadyPush,
  setOrderStatus,
  uncompOrderItem,
  ADMIN_ITEM_MOD_ERROR_COPY,
  type AdminItemModResult,
  type AdminOrder,
  type AdminOrderItem,
  type AdminOrderStatus,
} from "@/services/orders";
import { blockDevice } from "@/services/blocklist";

export type { AdminOrder, AdminOrderItem, AdminOrderStatus, AdminItemModResult };

interface UseAdminOrdersReturn {
  orders: AdminOrder[];
  /** Subset where requires_review = true — drives the "Held orders" banner. */
  heldOrders: AdminOrder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setStatus: (id: string, status: AdminOrderStatus) => Promise<void>;
  /** Flip requires_review off so the ticket reaches the kitchen. */
  approveHeld: (id: string) => Promise<void>;
  /** Cancel a held order (rejected by staff). */
  rejectHeld: (id: string) => Promise<void>;
  /** Add the device id to device_blocklist; future orders auto-reject. */
  blockDeviceById: (deviceId: string, reason?: string) => Promise<void>;
  /** Comp a single line on an order — sets unit_price to 0, stamps reason. */
  compItem: (
    orderId: string,
    lineId: string,
    reason: string
  ) => Promise<AdminItemModResult>;
  /** Remove a single line. Order auto-cancels if it was the last line. */
  removeItem: (
    orderId: string,
    lineId: string,
    reason: string
  ) => Promise<AdminItemModResult>;
  /** Reverse a previous comp. Restores the line's unit_price from base + selection deltas. */
  uncompItem: (
    orderId: string,
    lineId: string,
    reason: string
  ) => Promise<AdminItemModResult>;
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

  const approveHeld = useCallback(
    async (id: string) => {
      // Optimistic — the ticket should disappear from the held banner
      // immediately so staff don't double-tap.
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, requiresReview: false } : o))
      );
      const { error: updateError } = await approveHeldOrder(id);
      if (updateError) {
        console.error("[admin/orders] approve failed:", updateError);
        toast.error("Couldn't approve order");
        await refetch();
        return;
      }
      toast.success("Order approved — sent to kitchen");
    },
    [refetch]
  );

  const rejectHeld = useCallback(
    async (id: string) => {
      // Reject = cancel. Reuse the same path so the audit trail is uniform.
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, status: "cancelled", requiresReview: false } : o
        )
      );
      const { error: updateError } = await setOrderStatus(id, "cancelled");
      if (updateError) {
        console.error("[admin/orders] reject failed:", updateError);
        toast.error("Couldn't reject order");
        await refetch();
        return;
      }
      toast.success("Order rejected");
    },
    [refetch]
  );

  const compItem = useCallback(
    async (orderId: string, lineId: string, reason: string) => {
      // Optimistic — flip unit_price to 0 + stamp comp_reason locally
      // so the OrderDetail re-renders immediately.
      const stamp = Date.now();
      setOrders((prev) =>
        prev.map((o) =>
          o.id !== orderId
            ? o
            : {
                ...o,
                items: o.items.map((it) =>
                  it.lineId === lineId
                    ? {
                        ...it,
                        unitPrice: 0,
                        compedAt: stamp,
                        compReason: reason,
                      }
                    : it
                ),
              }
        )
      );
      const result = await compOrderItem(orderId, lineId, reason);
      if (!result.ok) {
        toast.error(ADMIN_ITEM_MOD_ERROR_COPY[result.error]);
        await refetch();
        return result;
      }
      // Server-side total is authoritative — apply it locally so the
      // header summary stays in sync without a refetch.
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, total: result.newTotal } : o))
      );
      toast.success("Item comped");
      return result;
    },
    [refetch]
  );

  const uncompItem = useCallback(
    async (orderId: string, lineId: string, reason: string) => {
      // Optimistic restore — flip unit_price back to base + selection
      // deltas locally so the row repaints instantly. Server will
      // overwrite with its authoritative number after the round-trip.
      setOrders((prev) =>
        prev.map((o) =>
          o.id !== orderId
            ? o
            : {
                ...o,
                items: o.items.map((it) => {
                  if (it.lineId !== lineId) return it;
                  const restoredPrice =
                    it.basePrice +
                    it.selections.reduce((s, sel) => s + sel.priceDelta, 0);
                  return {
                    ...it,
                    unitPrice: restoredPrice,
                    compedAt: null,
                    compReason: null,
                  };
                }),
              }
        )
      );
      const result = await uncompOrderItem(orderId, lineId, reason);
      if (!result.ok) {
        toast.error(ADMIN_ITEM_MOD_ERROR_COPY[result.error]);
        await refetch();
        return result;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, total: result.newTotal } : o))
      );
      toast.success("Comp reversed");
      return result;
    },
    [refetch]
  );

  const removeItem = useCallback(
    async (orderId: string, lineId: string, reason: string) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.id !== orderId
            ? o
            : {
                ...o,
                items: o.items.filter((it) => it.lineId !== lineId),
              }
        )
      );
      const result = await removeOrderItem(orderId, lineId, reason);
      if (!result.ok) {
        toast.error(ADMIN_ITEM_MOD_ERROR_COPY[result.error]);
        await refetch();
        return result;
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                total: result.newTotal,
                status: result.orderCancelled ? "cancelled" : o.status,
              }
            : o
        )
      );
      toast.success(
        result.orderCancelled ? "Order cancelled — last item removed" : "Item removed"
      );
      return result;
    },
    [refetch]
  );

  const blockDeviceById = useCallback(
    async (deviceId: string, reason?: string) => {
      try {
        await blockDevice(deviceId, reason);
        toast.success("Device blocked");
      } catch (err) {
        console.error("[admin/orders] block device failed:", err);
        toast.error("Couldn't block device");
      }
    },
    []
  );

  const heldOrders = useMemo(
    () => orders.filter((o) => o.requiresReview && o.status === "pending"),
    [orders]
  );

  return {
    orders,
    heldOrders,
    isLoading,
    error,
    refetch,
    setStatus,
    approveHeld,
    rejectHeld,
    blockDeviceById,
    compItem,
    uncompItem,
    removeItem,
  };
}
