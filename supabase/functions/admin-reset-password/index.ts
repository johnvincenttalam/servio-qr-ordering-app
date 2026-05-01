// Supabase Edge Function: admin-reset-password
//
// Lets an admin reset another staff member's password. The function
// generates a new random password, sets it via auth.admin.updateUserById,
// flips staff.password_temporary back to true so the user is forced
// through /admin/reset-password on next login, and returns the new
// password ONCE so the admin can hand it off securely.
//
// Body:
//   { user_id: string }
//
// Auth:
//   The caller's JWT must belong to a staff row with role='admin'.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface RequestBody {
  user_id: string;
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generatePassword(): string {
  const chars =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
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

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Invalid session" }, 401);
  }

  const { data: callerRow, error: callerError } = await userClient
    .from("staff")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (callerError) return jsonResponse({ error: callerError.message }, 500);
  if (!callerRow || callerRow.role !== "admin") {
    return jsonResponse({ error: "Admins only" }, 403);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.user_id || typeof body.user_id !== "string") {
    return jsonResponse({ error: "user_id is required" }, 400);
  }

  const password = generatePassword();

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
    body.user_id,
    { password }
  );
  if (updateAuthError) {
    return jsonResponse({ error: updateAuthError.message }, 400);
  }

  const { error: flagError } = await adminClient
    .from("staff")
    .update({ password_temporary: true })
    .eq("user_id", body.user_id);
  if (flagError) {
    return jsonResponse({ error: flagError.message }, 500);
  }

  return jsonResponse({
    ok: true,
    user_id: body.user_id,
    password, // shown ONCE; never stored elsewhere
  });
});
