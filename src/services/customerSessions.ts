/**
 * Admin-side customer session data layer. Pairs with the customer-side
 * services/sessions.ts (the customer never reads other devices'
 * sessions; admins do for the Seat / Bump workflow).
 *
 * RLS in 0021 permits admin SELECT/UPDATE on customer_sessions; these
 * helpers wrap those calls into a typed shape the Tables page can
 * consume directly.
 */
import { supabase } from "@/lib/supabase";

export interface AdminCustomerSession {
  id: string;
  tableId: string;
  deviceId: string;
  seated: boolean;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  closedAt: number | null;
}

interface SessionRow {
  id: string;
  table_id: string;
  device_id: string;
  seated: boolean;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  closed_at: string | null;
}

function rowToSession(row: SessionRow): AdminCustomerSession {
  return {
    id: row.id,
    tableId: row.table_id,
    deviceId: row.device_id,
    seated: row.seated,
    createdAt: new Date(row.created_at).getTime(),
    lastSeenAt: new Date(row.last_seen_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
    closedAt: row.closed_at ? new Date(row.closed_at).getTime() : null,
  };
}

export interface FetchSessionsResult {
  /** Map keyed by table id so the Tables page can look one up per card. */
  byTableId: Map<string, AdminCustomerSession>;
  error: string | null;
}

/**
 * Latest active (not closed, not expired) customer session per table.
 * One row per table — if a customer rescans we reuse the same session,
 * so "latest active" should always be unique within a table at any
 * moment. Returns a Map for O(1) lookup from the Tables grid.
 */
export async function fetchActiveCustomerSessions(): Promise<FetchSessionsResult> {
  const { data, error } = await supabase
    .from("customer_sessions")
    .select(
      "id, table_id, device_id, seated, created_at, last_seen_at, expires_at, closed_at"
    )
    .is("closed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[services/customerSessions] fetch failed:", error);
    return { byTableId: new Map(), error: error.message };
  }

  const map = new Map<string, AdminCustomerSession>();
  for (const row of (data ?? []) as SessionRow[]) {
    // First-seen wins because we ordered by created_at desc — that's
    // the most recent live session if the table somehow has multiple.
    if (!map.has(row.table_id)) {
      map.set(row.table_id, rowToSession(row));
    }
  }
  return { byTableId: map, error: null };
}

/** Mark a session as seated so the customer can place orders. */
export function seatCustomerSession(sessionId: string) {
  return supabase
    .from("customer_sessions")
    .update({ seated: true, last_seen_at: new Date().toISOString() })
    .eq("id", sessionId);
}

/**
 * Bump = close the session. Customer's next order attempt fails with
 * "Your session has ended" and they need to rescan. Use when a party
 * has clearly left or when the wrong device latched onto a table.
 */
export function bumpCustomerSession(sessionId: string) {
  return supabase
    .from("customer_sessions")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", sessionId);
}
