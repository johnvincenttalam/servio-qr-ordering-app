import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import {
  approveHeldOrder,
  blockDevice,
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
  };
}
