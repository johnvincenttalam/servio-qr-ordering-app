// Supabase Edge Function: admin-create-staff
//
// Replaces the email-magic-link invite flow with an admin-driven account
// creation flow. The admin enters email and/or username + role; the
// function creates the auth user with a random password (or one supplied
// by the admin), inserts the staff row with password_temporary = true,
// and returns the password ONCE so the admin can hand it off securely.
//
// Body:
//   {
//     email?: string;            // optional if username is provided
//     username?: string;         // optional if email is provided
//     displayName?: string;
//     role: "admin" | "kitchen" | "waiter";
//     password?: string;         // server generates if omitted
//   }
//
// Auth:
//   The caller's JWT is verified to belong to a staff row with
//   role = 'admin'. Anything else returns 403.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface RequestBody {
  email?: string;
  username?: string;
  displayName?: string;
  role: "admin" | "kitchen" | "waiter";
  password?: string;
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
const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
const RESERVED_USERNAMES = new Set([
  "admin",
  "root",
  "system",
  "support",
  "help",
]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Generate a 12-char alphanumeric password. Skips 0/o/1/l/I so the
 * value can be read off a screen and typed without ambiguity.
 * 56-char alphabet × 12 chars ≈ 70 bits of entropy — fine for a
 * password the user changes on first login anyway.
 */
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

  // Step 1 — verify caller is an admin
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

  // Step 2 — parse + validate
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!VALID_ROLES.has(body.role)) {
    return jsonResponse(
      { error: "role must be admin, kitchen, or waiter" },
      400
    );
  }

  const email = body.email?.trim().toLowerCase() || null;
  const username = body.username?.trim().toLowerCase() || null;

  if (!email && !username) {
    return jsonResponse(
      { error: "Provide an email or a username" },
      400
    );
  }

  if (username) {
    if (!USERNAME_RE.test(username)) {
      return jsonResponse(
        { error: "Username must be 3-30 chars (a-z, 0-9, dot, underscore)" },
        400
      );
    }
    if (RESERVED_USERNAMES.has(username)) {
      return jsonResponse({ error: `Username "${username}" is reserved` }, 400);
    }
  }

  if (email && !email.includes("@")) {
    return jsonResponse({ error: "Invalid email" }, 400);
  }

  const displayName = body.displayName?.trim() || null;
  const password = body.password?.trim() || generatePassword();

  // Synthesise an internal email when only a username is provided.
  // Supabase Auth requires email; the .servio.local domain is never
  // actually used for mail delivery.
  const authEmail = email ?? `${username}@servio.local`;

  // Step 3 — create the auth user + staff row
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: createData, error: createError } =
    await adminClient.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true, // admin distributes creds manually; no confirm email
    });

  if (createError || !createData.user) {
    return jsonResponse(
      { error: createError?.message ?? "Failed to create user" },
      400
    );
  }

  const { error: insertError } = await adminClient.from("staff").insert({
    user_id: createData.user.id,
    role: body.role,
    display_name: displayName,
    username,
    password_temporary: true,
  });

  if (insertError) {
    // Roll back the auth user so we don't leak orphans on a unique-
    // constraint failure (e.g. duplicate username after a race).
    await adminClient.auth.admin.deleteUser(createData.user.id);
    return jsonResponse({ error: insertError.message }, 400);
  }

  return jsonResponse({
    ok: true,
    user_id: createData.user.id,
    email: authEmail,
    username,
    password, // shown ONCE to the admin; not stored anywhere else
  });
});
