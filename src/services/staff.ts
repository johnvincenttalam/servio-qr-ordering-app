/**
 * Staff data layer — wraps the list_staff RPC, the admin-create-staff
 * + admin-reset-password edge functions, and the direct staff-table
 * mutations the admin uses to flip role / display name / avatar.
 */
import { supabase } from "@/lib/supabase";
import { removeStaffAvatar, uploadStaffAvatar } from "@/lib/avatarUpload";

export type StaffRole = "admin" | "kitchen" | "waiter";

export interface StaffMember {
  userId: string;
  email: string;
  username: string | null;
  role: StaffRole;
  displayName: string | null;
  avatarUrl: string | null;
  passwordTemporary: boolean;
  createdAt: number;
  lastSignInAt: number | null;
}

interface StaffRow {
  user_id: string;
  email: string;
  username: string | null;
  role: StaffRole;
  display_name: string | null;
  avatar_url: string | null;
  password_temporary: boolean | null;
  created_at: string;
  last_sign_in_at: string | null;
}

function rowToMember(row: StaffRow): StaffMember {
  return {
    userId: row.user_id,
    email: row.email,
    username: row.username,
    role: row.role,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    passwordTemporary: row.password_temporary ?? false,
    createdAt: new Date(row.created_at).getTime(),
    lastSignInAt: row.last_sign_in_at
      ? new Date(row.last_sign_in_at).getTime()
      : null,
  };
}

export interface CreateStaffParams {
  email?: string;
  username?: string;
  role: StaffRole;
  displayName?: string;
  /** Optional admin-supplied password; the server generates one when omitted. */
  password?: string;
}

export interface CreateStaffResult {
  ok: boolean;
  message?: string;
  /** The just-set password — show to the admin once and never store. */
  password?: string;
  email?: string;
  username?: string | null;
}

export interface ResetPasswordResult {
  ok: boolean;
  message?: string;
  password?: string;
}

/**
 * supabase-js wraps a non-2xx edge response in a FunctionsHttpError
 * with the generic message "Edge Function returned a non-2xx status
 * code". The actual response body — where our { error } field lives —
 * is on the .context Response object. This pulls it out so the UI can
 * show the real reason ("Username already exists", etc.).
 */
async function unpackEdgeError(
  err: unknown
): Promise<{ ok: false; message: string }> {
  try {
    const response = (err as { context?: Response }).context;
    if (response) {
      const body = await response.clone().json();
      if (body?.error) return { ok: false, message: String(body.error) };
    }
  } catch {
    // fall through to the generic message
  }
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Edge function failed",
  };
}

// ──────────────────────────────────────────────────────────────────
// Reads
// ──────────────────────────────────────────────────────────────────

export interface StaffFetchResult {
  members: StaffMember[];
  error: string | null;
}

/**
 * Pulls staff via the list_staff RPC (which joins auth.users for
 * email + last_sign_in_at, since direct auth-schema reads are
 * blocked by Supabase).
 */
export async function fetchStaff(): Promise<StaffFetchResult> {
  const { data, error } = await supabase.rpc("list_staff");
  if (error) {
    console.error("[services/staff] list_staff failed:", error);
    return { members: [], error: error.message };
  }
  return {
    members: ((data ?? []) as StaffRow[]).map(rowToMember),
    error: null,
  };
}

// ──────────────────────────────────────────────────────────────────
// Edge-function calls (auth-touching workflows)
// ──────────────────────────────────────────────────────────────────

/**
 * Calls the admin-create-staff edge function which provisions an auth
 * user, inserts the staff row, and returns a one-time password.
 */
export async function createStaff(
  params: CreateStaffParams
): Promise<CreateStaffResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    user_id?: string;
    email?: string;
    username?: string | null;
    password?: string;
    error?: string;
  }>("admin-create-staff", {
    body: {
      email: params.email,
      username: params.username,
      role: params.role,
      displayName: params.displayName,
      password: params.password,
    },
  });

  if (error) return await unpackEdgeError(error);
  if (data && !data.ok) {
    return { ok: false, message: data.error ?? "Couldn't create staff" };
  }
  if (!data?.password) {
    return { ok: false, message: "Server didn't return a password" };
  }
  return {
    ok: true,
    password: data.password,
    email: data.email,
    username: data.username ?? null,
  };
}

/**
 * Calls the admin-reset-password edge function which generates a fresh
 * temp password and flips password_temporary back to true so the
 * affected user is forced through /admin/reset-password on next sign-in.
 */
export async function resetStaffPassword(
  userId: string
): Promise<ResetPasswordResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    password?: string;
    error?: string;
  }>("admin-reset-password", {
    body: { user_id: userId },
  });

  if (error) return await unpackEdgeError(error);
  if (data && !data.ok) {
    return { ok: false, message: data.error ?? "Reset failed" };
  }
  if (!data?.password) {
    return { ok: false, message: "Server didn't return a password" };
  }
  return { ok: true, password: data.password };
}

// ──────────────────────────────────────────────────────────────────
// Direct staff-row mutations
// ──────────────────────────────────────────────────────────────────

export interface StaffUpdateError {
  /** Postgres error code; `"P0001"` is our last-admin guard trigger. */
  code?: string;
  message: string;
}

export async function setStaffRole(
  userId: string,
  role: StaffRole
): Promise<{ error: StaffUpdateError | null }> {
  const { error } = await supabase
    .from("staff")
    .update({ role })
    .eq("user_id", userId);
  return { error };
}

export async function setStaffDisplayName(
  userId: string,
  name: string | null
): Promise<{ error: StaffUpdateError | null }> {
  const { error } = await supabase
    .from("staff")
    .update({ display_name: name })
    .eq("user_id", userId);
  return { error };
}

/**
 * Upload + persist the avatar URL on the staff row. Throws on any
 * failure (storage upload error or DB write error) so the caller can
 * surface a single error message.
 */
export async function setStaffAvatar(
  userId: string,
  file: File
): Promise<string> {
  const url = await uploadStaffAvatar(userId, file);
  const { error } = await supabase
    .from("staff")
    .update({ avatar_url: url })
    .eq("user_id", userId);
  if (error) {
    console.error("[services/staff] avatar update failed:", error);
    throw new Error("Couldn't save avatar");
  }
  return url;
}

/**
 * Clear the avatar_url column and (best-effort) delete the underlying
 * storage object. Returns the DB error if the column write fails;
 * storage delete failures are silent (orphans under the cap are fine).
 */
export async function clearStaffAvatar(
  userId: string
): Promise<{ error: StaffUpdateError | null }> {
  const { error } = await supabase
    .from("staff")
    .update({ avatar_url: null })
    .eq("user_id", userId);
  if (error) return { error };
  await removeStaffAvatar(userId);
  return { error: null };
}

export async function deleteStaffMember(
  userId: string
): Promise<{ error: StaffUpdateError | null }> {
  const { error } = await supabase.from("staff").delete().eq("user_id", userId);
  return { error };
}
