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

/**
 * Per-order "this device subscribed" flag. The push_subscriptions row
 * + the browser's pushManager subscription both persist across browser
 * restarts, but the NotifyPill's local component state doesn't — so
 * without this flag, a refresh would render the "Notify me" button
 * again as if the customer had never subscribed. Writing the flag on
 * every successful subscribe and reading it on mount keeps the UI in
 * sync with the actual subscription.
 *
 * Per-order key (servio.pushed.<orderId>) so a customer who subscribes
 * to ORD-A then places ORD-B sees the right state for each.
 */
const PUSH_FLAG_PREFIX = "servio.pushed.";

export function markOrderPushed(orderId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PUSH_FLAG_PREFIX + orderId, "1");
  } catch {
    // Quota / private mode — drop silently. Customer will see the
    // "Notify me" button on next mount and re-clicking is a safe no-op
    // because subscribeToOrderPush upserts on conflict.
  }
}

export function isOrderPushed(orderId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PUSH_FLAG_PREFIX + orderId) === "1";
  } catch {
    return false;
  }
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

  // upsert with ignoreDuplicates so a second click on "Notify me"
  // (after closing + reopening the browser, or otherwise re-running
  // through this path with the same endpoint) generates
  // INSERT ... ON CONFLICT DO NOTHING server-side — no 409 lands in
  // the network log, and no UPDATE policy is needed since the
  // duplicate row never causes a write attempt. The "already
  // subscribed" state is just a silent no-op success.
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { order_id: orderId, endpoint, p256dh, auth },
      { onConflict: "order_id,endpoint", ignoreDuplicates: true }
    );

  if (error) {
    return {
      ok: false,
      reason: "save-failed",
      message: error.message,
    };
  }

  markOrderPushed(orderId);
  return { ok: true };
}
