import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import type { WaiterCall, WaiterCallKind } from "@/types";

interface WaiterCallRow {
  id: string;
  table_id: string;
  order_id: string | null;
  kind: WaiterCallKind;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

function rowToCall(row: WaiterCallRow): WaiterCall {
  return {
    id: row.id,
    tableId: row.table_id,
    orderId: row.order_id,
    kind: row.kind,
    note: row.note,
    createdAt: new Date(row.created_at).getTime(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : null,
    resolvedBy: row.resolved_by,
  };
}

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
    const { data, error: queryError } = await supabase
      .from("waiter_calls")
      .select(
        "id, table_id, order_id, kind, note, created_at, resolved_at, resolved_by"
      )
      .is("resolved_at", null)
      .order("created_at", { ascending: true });

    if (queryError) {
      console.error("[waiter-calls] fetch failed:", queryError);
      setError(queryError.message);
      return;
    }

    setError(null);
    setCalls(((data ?? []) as WaiterCallRow[]).map(rowToCall));
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

      const { data: userData } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from("waiter_calls")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: userData.user?.id ?? null,
        })
        .eq("id", id);

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
