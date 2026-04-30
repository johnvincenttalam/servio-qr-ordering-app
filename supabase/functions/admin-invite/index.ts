// Supabase Edge Function: admin-invite
//
// Sends an invite email to a new staff member and inserts their row in the
// public.staff table with the requested role. Only admins may call it.
//
// Body:
//   { email: string; role: "admin" | "kitchen" | "waiter"; displayName?: string }
//
// Auth:
//   The function reads the caller's JWT from the Authorization header and
//   verifies they exist in public.staff with role='admin' before doing
//   anything privileged. If that check fails it returns 403.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface RequestBody {
  email: string;
  role: "admin" | "kitchen" | "waiter";
  displayName?: string;
}

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const VALID_ROLES = new Set(["admin", "kitchen", "waiter"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return jsonResponse(
      { error: "Edge function misconfigured: missing Supabase env vars" },
      500
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  // Step 1: verify caller is an admin (using their JWT, RLS-bound)
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Invalid session" }, 401);
  }

  const { data: staffRow, error: staffError } = await userClient
    .from("staff")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (staffError) {
    return jsonResponse({ error: staffError.message }, 500);
  }
  if (!staffRow || staffRow.role !== "admin") {
    return jsonResponse({ error: "Admins only" }, 403);
  }

  // Step 2: parse and validate body
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const role = body.role;
  const displayName = body.displayName?.trim() || null;

  if (!email || !email.includes("@")) {
    return jsonResponse({ error: "Valid email is required" }, 400);
  }
  if (!VALID_ROLES.has(role)) {
    return jsonResponse({ error: "role must be admin, kitchen, or waiter" }, 400);
  }

  // Step 3: invite via the admin API + insert staff row, using the
  // service-role client so we bypass RLS and reach auth.admin.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: invite, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    return jsonResponse({ error: inviteError.message }, 400);
  }
  if (!invite.user) {
    return jsonResponse({ error: "Invite returned no user" }, 500);
  }

  const { error: insertError } = await adminClient
    .from("staff")
    .insert({
      user_id: invite.user.id,
      role,
      display_name: displayName,
    });

  if (insertError) {
    // Best-effort cleanup: if the staff insert fails (e.g. unique
    // violation because they already had a staff row), don't leave an
    // orphan invited user.
    if (insertError.code !== "23505") {
      await adminClient.auth.admin.deleteUser(invite.user.id);
    }
    return jsonResponse({ error: insertError.message }, 500);
  }

  return jsonResponse({
    ok: true,
    user_id: invite.user.id,
    email: invite.user.email,
  });
});
