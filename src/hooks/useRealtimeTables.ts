import { useEffect, useRef } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type RealtimePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

interface UseRealtimeTablesOptions {
  channel: string;
  tables: readonly string[];
  onChange: (table: string, payload: RealtimePayload) => void;
  onStatus?: (status: string) => void;
}

/**
 * Subscribes to postgres_changes (event="*") on one or more public tables
 * for the lifetime of the calling component. The channel is torn down on
 * unmount; callbacks are kept fresh via refs so identity changes don't
 * trigger a resubscribe.
 */
export function useRealtimeTables({
  channel,
  tables,
  onChange,
  onStatus,
}: UseRealtimeTablesOptions): void {
  const onChangeRef = useRef(onChange);
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onChangeRef.current = onChange;
    onStatusRef.current = onStatus;
  });

  const tablesKey = tables.join("|");

  useEffect(() => {
    let ch = supabase.channel(channel);
    for (const table of tables) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => onChangeRef.current(table, payload as RealtimePayload)
      );
    }
    ch.subscribe((status) => onStatusRef.current?.(status));
    return () => {
      supabase.removeChannel(ch);
    };
    // tablesKey collapses the array into a stable string so the effect only
    // re-runs when the channel name or the set of tables actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, tablesKey]);
}
