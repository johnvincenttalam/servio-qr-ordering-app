import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined;

/**
 * Whether the current browser supports Web Push.
 * Notification permission state is queried on demand.
 */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Best-effort permission state read. Returns "default" if the browser
 * doesn't support the API at all.
 */
export function pushPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "default";
  }
  return Notification.permission;
}

export interface SubscribeResult {
  ok: boolean;
  reason?:
    | "unsupported"
    | "missing-vapid"
    | "permission-denied"
    | "subscribe-failed"
    | "save-failed";
  message?: string;
}

/**
 * Subscribe the current device to push notifications for a specific order.
 * Asks for permission if not already granted. Stores the subscription in
 * Supabase so the send-order-push Edge Function can fan out to it later.
 */
export async function subscribeToOrderPush(
  orderId: string
): Promise<SubscribeResult> {
  if (!pushSupported()) {
    return { ok: false, reason: "unsupported" };
  }
  if (!VAPID_PUBLIC_KEY) {
    return {
      ok: false,
      reason: "missing-vapid",
      message: "VITE_VAPID_PUBLIC_KEY is not set in .env.local",
    };
  }

  // Ask permission if not yet decided
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { ok: false, reason: "permission-denied" };
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch (err) {
    return {
      ok: false,
      reason: "subscribe-failed",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // Re-use existing subscription if one already lives on this device
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      // Modern Push API accepts the URL-safe base64 string directly.
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });
    } catch (err) {
      return {
        ok: false,
        reason: "subscribe-failed",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint ?? subscription.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return {
      ok: false,
      reason: "subscribe-failed",
      message: "Subscription is missing keys",
    };
  }

  const { error } = await supabase.from("push_subscriptions").insert({
    order_id: orderId,
    endpoint,
    p256dh,
    auth,
  });

  // Ignore unique-violation: the subscription already exists for this
  // device + order pairing, which is a successful "already subscribed" state.
  if (error && error.code !== "23505") {
    return {
      ok: false,
      reason: "save-failed",
      message: error.message,
    };
  }

  return { ok: true };
}
