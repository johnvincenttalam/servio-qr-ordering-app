// Supabase Edge Function: send-order-push
//
// Sends a Web Push notification to every subscription tied to an order.
// Invoked by the kitchen when an order's status flips to 'ready'.
//
// Body:
//   { order_id: string; title?: string; body?: string; url?: string }
//
// Required secrets (set in Supabase dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   — same value as the client's VITE_VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY  — private half of the VAPID keypair
//   VAPID_SUBJECT      — mailto: address (e.g. mailto:hello@servio.app)
//
// Auth:
//   The function uses the calling user's JWT to read push_subscriptions
//   (RLS allows is_staff()), so you must invoke it from an authenticated
//   admin/kitchen client. Anonymous customer clients can't trigger this.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "https://esm.sh/web-push@3.6.7";

interface RequestBody {
  order_id: string;
  title?: string;
  body?: string;
  url?: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(
      JSON.stringify({
        error:
          "Missing VAPID secrets. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in Edge Function secrets.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let payload: RequestBody;
  try {
    payload = (await req.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload.order_id) {
    return new Response(JSON.stringify({ error: "order_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use the SERVICE_ROLE_KEY so we can read all subscriptions for the order
  // (push_subscriptions is RLS'd to staff-only; service role bypasses RLS).
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const { data: subs, error: queryError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("order_id", payload.order_id);

  if (queryError) {
    return new Response(
      JSON.stringify({ error: queryError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!subs || subs.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, message: "No subscriptions for this order" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Include the order id in the URL so a fresh tab (one without the original
  // session's storage) can still hydrate and render the right order.
  const defaultUrl = `/order-status?order=${encodeURIComponent(payload.order_id)}`;
  const notification = JSON.stringify({
    title: payload.title ?? "Your order is ready",
    body:
      payload.body ?? `Order ${payload.order_id} is ready — pick it up at the counter.`,
    url: payload.url ?? defaultUrl,
    tag: `order-${payload.order_id}`,
  });

  const results = await Promise.allSettled(
    (subs as SubscriptionRow[]).map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        notification
      )
    )
  );

  // Clean up subscriptions that the push service has rejected (410 Gone).
  const expiredIds: string[] = [];
  results.forEach((r, i) => {
    if (
      r.status === "rejected" &&
      typeof r.reason === "object" &&
      r.reason &&
      "statusCode" in r.reason &&
      ((r.reason as { statusCode: number }).statusCode === 404 ||
        (r.reason as { statusCode: number }).statusCode === 410)
    ) {
      expiredIds.push((subs as SubscriptionRow[])[i].id);
    }
  });
  if (expiredIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", expiredIds);
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  return new Response(
    JSON.stringify({ sent, failed, expired: expiredIds.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
