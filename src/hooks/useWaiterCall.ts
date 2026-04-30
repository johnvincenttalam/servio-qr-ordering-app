import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { WaiterCallKind } from "@/types";

const COOLDOWN_MS = 60_000;
const STORAGE_PREFIX = "servio.waiter-call.";

export interface CallResult {
  ok: boolean;
  reason?: "cooldown" | "insert-failed";
  message?: string;
  /** ms until the user can call this kind again, when reason === "cooldown" */
  retryInMs?: number;
}

interface UseWaiterCallReturn {
  /** how many ms until each kind can be called again (0 if ready) */
  cooldown: Record<WaiterCallKind, number>;
  /** true while an insert is in flight for a given kind */
  inflight: WaiterCallKind | null;
  call: (
    tableId: string,
    kind: WaiterCallKind,
    options?: { orderId?: string | null; note?: string | null }
  ) => Promise<CallResult>;
}

function storageKey(tableId: string, kind: WaiterCallKind) {
  return `${STORAGE_PREFIX}${tableId}.${kind}`;
}

function readLastCall(tableId: string, kind: WaiterCallKind): number {
  if (typeof window === "undefined") return 0;
  const raw = sessionStorage.getItem(storageKey(tableId, kind));
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function writeLastCall(tableId: string, kind: WaiterCallKind, ts: number) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(storageKey(tableId, kind), String(ts));
}

/**
 * Customer-side helper for inserting waiter_calls rows. Tracks a per-kind
 * 60s cooldown in sessionStorage so the UI can disable the button instantly,
 * and surfaces the server-side cooldown error (P0001) the trigger raises.
 */
export function useWaiterCall(tableId: string | null): UseWaiterCallReturn {
  const [inflight, setInflight] = useState<WaiterCallKind | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second so the disabled state lifts when the cooldown elapses.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const cooldown: Record<WaiterCallKind, number> = {
    service: tableId
      ? Math.max(0, COOLDOWN_MS - (now - readLastCall(tableId, "service")))
      : 0,
    bill: tableId
      ? Math.max(0, COOLDOWN_MS - (now - readLastCall(tableId, "bill")))
      : 0,
  };

  const call = useCallback<UseWaiterCallReturn["call"]>(
    async (callTableId, kind, options) => {
      const remaining = Math.max(
        0,
        COOLDOWN_MS - (Date.now() - readLastCall(callTableId, kind))
      );
      if (remaining > 0) {
        return { ok: false, reason: "cooldown", retryInMs: remaining };
      }

      setInflight(kind);
      try {
        const { error } = await supabase.from("waiter_calls").insert({
          table_id: callTableId,
          kind,
          order_id: options?.orderId ?? null,
          note: options?.note ?? null,
        });

        if (error) {
          // The trigger raises a custom plpgsql exception with code P0001
          // when a recent unresolved call exists for the same (table, kind).
          if (error.code === "P0001") {
            writeLastCall(callTableId, kind, Date.now());
            return {
              ok: false,
              reason: "cooldown",
              retryInMs: COOLDOWN_MS,
            };
          }
          return {
            ok: false,
            reason: "insert-failed",
            message: error.message,
          };
        }

        writeLastCall(callTableId, kind, Date.now());
        return { ok: true };
      } finally {
        setInflight(null);
      }
    },
    []
  );

  return { cooldown, inflight, call };
}
