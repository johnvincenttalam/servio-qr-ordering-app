/**
 * Waiter-calls data layer — used by both the customer-side useWaiterCall
 * (insert + cooldown handling) and the staff-side useWaiterCalls
 * (unresolved list + resolve).
 */
import { supabase } from "@/lib/supabase";
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

// ──────────────────────────────────────────────────────────────────
// Reads
// ──────────────────────────────────────────────────────────────────

export interface WaiterCallsFetchResult {
  calls: WaiterCall[];
  error: string | null;
}

/**
 * Staff-side fetch — only unresolved rows, oldest first so the
 * banner reads as a queue.
 */
export async function fetchUnresolvedWaiterCalls(): Promise<WaiterCallsFetchResult> {
  const { data, error } = await supabase
    .from("waiter_calls")
    .select(
      "id, table_id, order_id, kind, note, created_at, resolved_at, resolved_by"
    )
    .is("resolved_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[services/waiter-calls] fetch failed:", error);
    return { calls: [], error: error.message };
  }
  return {
    calls: ((data ?? []) as WaiterCallRow[]).map(rowToCall),
    error: null,
  };
}

// ──────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────

export interface CreateWaiterCallParams {
  tableId: string;
  kind: WaiterCallKind;
  orderId?: string | null;
  note?: string | null;
}

/**
 * Customer-side insert. The DB has a trigger that rejects rapid
 * duplicates with code "P0001" — caller surfaces that as a cooldown
 * message in the UI.
 */
export async function createWaiterCall(
  params: CreateWaiterCallParams
): Promise<{ error: { code?: string; message: string } | null }> {
  const { error } = await supabase.from("waiter_calls").insert({
    table_id: params.tableId,
    kind: params.kind,
    order_id: params.orderId ?? null,
    note: params.note ?? null,
  });
  return { error };
}

/**
 * Staff-side resolve — stamps resolved_at + resolved_by on the row.
 * The audit_log trigger picks this up and emits a "Resolved Table N
 * call" entry with the response time.
 */
export async function resolveWaiterCall(
  id: string
): Promise<{ error: { message: string } | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("waiter_calls")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: userData.user?.id ?? null,
    })
    .eq("id", id);
  return { error };
}
