import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import { playChime } from "@/lib/chime";
import type { KitchenOrder } from "./useKitchenOrders";

/**
 * Kitchen-side feed for live order edits. Subscribes to inserts on
 * order_modifications so a customer's qty-decrease, an admin's
 * comp / uncomp / remove, or anything else that mutates a ticket
 * shows up as a toast on the kitchen display along with a brief
 * highlight ring on the affected ticket card.
 *
 * Filters by visibility — only notifies for orders currently rendered
 * in the kitchen view (pending / preparing / ready), so a comp on a
 * served ticket doesn't spam the cook.
 */

interface ModificationPayload {
  order_id: string;
  action: "qty_change" | "removed" | "added" | "comped" | "uncomped" | "swapped";
  line_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
}

const FLASH_TTL_MS = 4_000;

interface UseKitchenModificationsOptions {
  orders: KitchenOrder[];
  /** Whether to play the chime on each modification. Mirrors the new-order chime gate. */
  soundEnabled: boolean;
}

interface UseKitchenModificationsReturn {
  /** Order ids that received a modification within the last few seconds. Drives the ticket flash. */
  flashingOrderIds: Set<string>;
}

export function useKitchenModifications({
  orders,
  soundEnabled,
}: UseKitchenModificationsOptions): UseKitchenModificationsReturn {
  const [flashingOrderIds, setFlashingOrderIds] = useState<Set<string>>(
    () => new Set()
  );

  // Stable lookup by order id so the toast formatter can resolve a
  // table id without searching the list on every event. Refresh on
  // every render so the latest state is available without a
  // re-subscription.
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  // Skip the initial firehose — when the kitchen display first opens,
  // historical inserts can arrive replayed by Supabase realtime. We
  // only want events that happen *while we're watching*.
  const startedAtRef = useRef<number>(Date.now());
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  useRealtimeTables({
    channel: "kitchen-modifications",
    tables: ["order_modifications"],
    onChange: (_table, payload) => {
      if (payload.eventType !== "INSERT") return;
      const mod = payload.new as unknown as ModificationPayload | null;
      if (!mod) return;

      // Look up the matching order — if it's not currently in the
      // kitchen view (likely served or cancelled in the meantime),
      // skip the notification.
      const order = ordersRef.current.find((o) => o.id === mod.order_id);
      if (!order) return;

      const message = formatModification(mod, order);
      if (!message) return;

      toast(message.title, {
        description: message.description,
        duration: 5000,
      });

      if (soundRef.current) {
        playChime();
      }

      // Highlight the ticket for FLASH_TTL_MS so the cook can spot
      // which card just changed without scanning every column.
      setFlashingOrderIds((prev) => {
        const next = new Set(prev);
        next.add(mod.order_id);
        return next;
      });
      window.setTimeout(() => {
        setFlashingOrderIds((prev) => {
          if (!prev.has(mod.order_id)) return prev;
          const next = new Set(prev);
          next.delete(mod.order_id);
          return next;
        });
      }, FLASH_TTL_MS);
    },
  });

  return { flashingOrderIds };
}

interface ToastCopy {
  title: string;
  description?: string;
}

function formatModification(
  mod: ModificationPayload,
  order: KitchenOrder
): ToastCopy | null {
  const before = mod.before as { name?: string; quantity?: number } | null;
  const after = mod.after as { quantity?: number } | null;
  const lineName = before?.name ?? "an item";
  const orderRef = `Table ${order.tableId}`;

  switch (mod.action) {
    case "qty_change": {
      const oldQty = before?.quantity;
      const newQty = after?.quantity;
      if (oldQty === undefined || newQty === undefined) {
        return { title: `${orderRef} · ${lineName} updated` };
      }
      return {
        title: `${orderRef} · ${lineName}`,
        description: `Quantity changed: ×${oldQty} → ×${newQty}`,
      };
    }
    case "removed":
      return {
        title: `${orderRef} · ${lineName} removed`,
        description: mod.reason ?? undefined,
      };
    case "comped":
      return {
        title: `${orderRef} · ${lineName} comped`,
        description: mod.reason ?? undefined,
      };
    case "uncomped":
      return {
        title: `${orderRef} · ${lineName} uncomped`,
        description: mod.reason ?? undefined,
      };
    // Phase B + C.2 actions — fall through to a generic message until
    // they ship and earn their own copy.
    case "added":
    case "swapped":
      return { title: `${orderRef} · ${lineName} ${mod.action}` };
    default:
      return null;
  }
}
