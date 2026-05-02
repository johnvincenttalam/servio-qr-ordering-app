import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import {
  fetchUnresolvedWaiterCalls,
  resolveWaiterCall,
} from "@/services/waiterCalls";
import type { WaiterCall } from "@/types";

interface UseWaiterCallsReturn {
  calls: WaiterCall[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  resolve: (id: string) => Promise<void>;
}

/**
 * Staff-side hook returning unresolved waiter calls. Subscribes to the
 * waiter_calls table via postgres_changes so new calls appear instantly
 * and resolved ones drop off.
 */
export function useWaiterCalls(): UseWaiterCallsReturn {
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const result = await fetchUnresolvedWaiterCalls();
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setCalls(result.calls);
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
    channel: "staff-waiter-calls",
    tables: ["waiter_calls"],
    onChange: () => refetch(),
  });

  const resolve = useCallback(
    async (id: string) => {
      // Optimistic: drop it from the list immediately.
      setCalls((prev) => prev.filter((c) => c.id !== id));

      const { error: updateError } = await resolveWaiterCall(id);
      if (updateError) {
        console.error("[waiter-calls] resolve failed:", updateError);
        toast.error("Couldn't resolve — try again");
        await refetch();
      }
    },
    [refetch]
  );

  return { calls, isLoading, error, refetch, resolve };
}
