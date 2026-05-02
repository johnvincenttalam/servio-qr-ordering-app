/**
 * Customer-session data layer. Wraps the start_customer_session RPC
 * (see migrations/0021_customer_sessions.sql) so the rest of the app
 * deals with a typed result instead of raw jsonb.
 *
 * "Customer session" here = the visit row that ties a device to a
 * table for a 4-hour window. It's the gate for placing orders;
 * without an active session, check_order_abuse() rejects the insert.
 */
import { supabase } from "@/lib/supabase";

export interface CustomerSession {
  sessionId: string;
  /** ms epoch — same shape as Date.now() so callers can compare directly. */
  expiresAt: number;
}

/** Stable error codes returned by the RPC. The client maps them to copy. */
export type StartSessionError =
  | "TABLE_NOT_FOUND"
  | "TABLE_ARCHIVED"
  | "QR_ROTATED"
  | "INVALID_TABLE"
  | "INVALID_DEVICE"
  | "UNKNOWN";

export type StartSessionResult =
  | { ok: true; session: CustomerSession }
  | { ok: false; error: StartSessionError };

interface RpcResponse {
  session_id?: string;
  expires_at?: string;
  error?: StartSessionError;
}

const KNOWN_ERRORS: ReadonlySet<StartSessionError> = new Set([
  "TABLE_NOT_FOUND",
  "TABLE_ARCHIVED",
  "QR_ROTATED",
  "INVALID_TABLE",
  "INVALID_DEVICE",
  "UNKNOWN",
]);

export async function startCustomerSession(
  tableId: string,
  qrToken: string,
  deviceId: string
): Promise<StartSessionResult> {
  const { data, error } = await supabase.rpc("start_customer_session", {
    p_table_id: tableId,
    p_qr_token: qrToken,
    p_device_id: deviceId,
  });

  if (error) {
    console.error("[services/sessions] start failed:", error);
    return { ok: false, error: "UNKNOWN" };
  }

  const payload = data as RpcResponse | null;
  if (!payload) return { ok: false, error: "UNKNOWN" };

  if (payload.error) {
    return {
      ok: false,
      error: KNOWN_ERRORS.has(payload.error) ? payload.error : "UNKNOWN",
    };
  }

  if (!payload.session_id || !payload.expires_at) {
    return { ok: false, error: "UNKNOWN" };
  }

  return {
    ok: true,
    session: {
      sessionId: payload.session_id,
      expiresAt: new Date(payload.expires_at).getTime(),
    },
  };
}

/**
 * Customer-friendly copy for each error code. Centralised so toast
 * messages and inline banners read the same.
 */
export const SESSION_ERROR_COPY: Record<StartSessionError, string> = {
  TABLE_NOT_FOUND: "Table not found. Please scan a valid QR code.",
  TABLE_ARCHIVED: "This table isn't active right now. Please ask staff.",
  QR_ROTATED:
    "This QR sticker is out of date. Please ask staff for a new one.",
  INVALID_TABLE: "Invalid table. Please rescan the QR code.",
  INVALID_DEVICE: "Couldn't identify this device. Please reload the page.",
  UNKNOWN: "Couldn't start your session. Please try again.",
};
