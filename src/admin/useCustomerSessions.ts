import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import {
  bumpCustomerSession,
  fetchActiveCustomerSessions,
  seatCustomerSession,
  type AdminCustomerSession,
} from "@/services/customerSessions";

export type { AdminCustomerSession };

interface UseCustomerSessionsReturn {
  /** Active customer sessions keyed by table id (one per table). */
  byTableId: Map<string, AdminCustomerSession>;
  isLoading: boolean;
  refetch: () => Promise<void>;
  /** Mark the party as seated; unblocks order placement. */
  seat: (sessionId: string) => Promise<void>;
  /** Force-close the session; customer must rescan to start fresh. */
  bump: (sessionId: string) => Promise<void>;
}

/**
 * Wraps fetchActiveCustomerSessions plus realtime + the seat / bump
 * mutations. Shares no realtime channel name with useTableSessions
 * (the existing live-aggregate hook) so both can coexist on the
 * Tables page without colliding on the postgres_changes subscription.
 */
export function useCustomerSessions(): UseCustomerSessionsReturn {
  const [byTableId, setByTableId] = useState<Map<string, AdminCustomerSession>>(
    () => new Map()
  );
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const result = await fetchActiveCustomerSessions();
    setByTableId(result.byTableId);
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

  useRealtimeTables({
    channel: "admin-customer-sessions",
    tables: ["customer_sessions"],
    onChange: () => {
      void refetch();
    },
  });

  const seat = useCallback(
    async (sessionId: string) => {
      // Optimistic — the customer should be able to order the moment
      // staff taps Seat, even before the round-trip completes.
      setByTableId((prev) => {
        const next = new Map(prev);
        for (const [tableId, session] of next.entries()) {
          if (session.id === sessionId) {
            next.set(tableId, { ...session, seated: true });
          }
        }
        return next;
      });
      const { error } = await seatCustomerSession(sessionId);
      if (error) {
        console.error("[admin/customerSessions] seat failed:", error);
        toast.error("Couldn't seat — try again");
        await refetch();
        return;
      }
      toast.success("Seated — orders unlocked");
    },
    [refetch]
  );

  const bump = useCallback(
    async (sessionId: string) => {
      // Optimistic remove from the table-keyed map; the realtime
      // refetch reconciles if the update fails.
      setByTableId((prev) => {
        const next = new Map(prev);
        for (const [tableId, session] of next.entries()) {
          if (session.id === sessionId) {
            next.delete(tableId);
          }
        }
        return next;
      });
      const { error } = await bumpCustomerSession(sessionId);
      if (error) {
        console.error("[admin/customerSessions] bump failed:", error);
        toast.error("Couldn't bump — try again");
        await refetch();
        return;
      }
      toast.success("Session ended");
    },
    [refetch]
  );

  return { byTableId, isLoading, refetch, seat, bump };
}
