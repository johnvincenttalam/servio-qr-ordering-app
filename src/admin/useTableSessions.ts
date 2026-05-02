import { useCallback, useEffect, useState } from "react";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import {
  fetchTableSessions,
  type TableSession,
} from "@/services/tableSessions";

export type { TableSession };

interface UseTableSessionsReturn {
  sessions: Map<string, TableSession>;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * State + realtime wrapper around fetchTableSessions. Subscribes to
 * orders + order_items so a new customer order or item edit flips
 * the right table card live. Different channel name from the Orders
 * page hook to avoid the realtime double-subscribe error.
 */
export function useTableSessions(): UseTableSessionsReturn {
  const [sessions, setSessions] = useState<Map<string, TableSession>>(
    () => new Map()
  );
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const result = await fetchTableSessions();
    setSessions(result.sessions);
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

  // A change on either orders (status flips, new inserts) or order_items
  // (a line added or quantity edited) can shift a table's aggregate, so
  // we listen on both. Refetching the whole set is simpler than diffing
  // payload deltas, and the result set is small (active orders only).
  useRealtimeTables({
    channel: "admin-table-sessions",
    tables: ["orders", "order_items"],
    onChange: () => {
      void refetch();
    },
  });

  return { sessions, isLoading, refetch };
}
