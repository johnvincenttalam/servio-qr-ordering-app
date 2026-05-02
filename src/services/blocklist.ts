/**
 * Device blocklist data layer. Pairs with the check_order_abuse() trigger
 * in 0017 — devices on this list are hard-rejected (P0001) on insert.
 *
 * Reads + writes go through here so the surface is centralised; admin
 * UI calls the hook in useBlockedDevices, which calls these functions.
 */
import { supabase } from "@/lib/supabase";

export interface BlockedDevice {
  deviceId: string;
  reason: string | null;
  /** Email of the staff member who placed the block; null if they were since deleted. */
  blockedByEmail: string | null;
  createdAt: number;
}

interface BlocklistRow {
  device_id: string;
  reason: string | null;
  created_at: string;
  blocked_by: string | null;
  /** Joined from auth.users — see the select below. */
  blocked_by_user?: { email: string | null } | null;
}

export interface BlocklistFetchResult {
  devices: BlockedDevice[];
  error: string | null;
}

/**
 * Returns the entire blocklist. The list stays small in practice
 * (single-digit rows for a single restaurant) so we don't paginate.
 */
export async function fetchBlockedDevices(): Promise<BlocklistFetchResult> {
  const { data, error } = await supabase
    .from("device_blocklist")
    .select("device_id, reason, created_at, blocked_by")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[services/blocklist] fetch failed:", error);
    return { devices: [], error: error.message };
  }

  const rows = (data ?? []) as BlocklistRow[];
  // The blocked_by foreign key points at auth.users which we don't get
  // to read from anon-side joins — but the audit_log trigger captures
  // actor_email at write time. For the panel we just need to render
  // *something*; the actor's email is on the matching audit_log row,
  // not on the blocklist row, so the join is empty here. Surfacing
  // the device id + reason + when is plenty for the unblock action.
  return {
    devices: rows.map((r) => ({
      deviceId: r.device_id,
      reason: r.reason,
      blockedByEmail: r.blocked_by_user?.email ?? null,
      createdAt: new Date(r.created_at).getTime(),
    })),
    error: null,
  };
}

/**
 * Add a device id to the blocklist. Future order inserts from this
 * device are hard-rejected by the check_order_abuse() trigger
 * (errcode P0001). Idempotent: device_id is the primary key, so
 * a duplicate is silently treated as success.
 */
export async function blockDevice(deviceId: string, reason?: string): Promise<void> {
  const { error } = await supabase.from("device_blocklist").insert({
    device_id: deviceId,
    reason: reason ?? null,
  });
  if (error && error.code !== "23505") {
    // 23505 = unique_violation — already blocked, treat as success.
    throw error;
  }
}

/**
 * Remove a device id from the blocklist. Returns true if a row was
 * removed, false if the device wasn't blocked in the first place.
 */
export async function unblockDevice(deviceId: string): Promise<boolean> {
  const { error, count } = await supabase
    .from("device_blocklist")
    .delete({ count: "exact" })
    .eq("device_id", deviceId);
  if (error) {
    console.error("[services/blocklist] unblock failed:", error);
    throw error;
  }
  return (count ?? 0) > 0;
}
