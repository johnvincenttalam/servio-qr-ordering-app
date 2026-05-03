import { useEffect, useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isOrderPushed,
  pushPermission,
  pushSupported,
  subscribeToOrderPush,
} from "@/lib/push";

/**
 * Customer "notify me when the order is ready" pill. Shared between
 * OrderSuccessModal (post-window) and OrderStatus page (anytime
 * before the order is served), so a customer who taps Track Order
 * early — before the modal's notify option appears — still has a
 * path to opt into push notifications.
 *
 * Renders nothing when push isn't supported or the venue's VAPID
 * key isn't set, since there's no actionable subscription path
 * either way. Self-hides once successfully subscribed (with a brief
 * confirmation) so it doesn't loiter on screen.
 */
type NotifyState =
  | "idle"
  | "subscribing"
  | "subscribed"
  | "denied"
  | "unavailable";

interface NotifyPillProps {
  orderId: string | null;
  /** Hide the pill entirely once the order has reached one of these terminal states. */
  hidden?: boolean;
  /** Optional className for the wrapping element so callers can position it. */
  className?: string;
}

export function NotifyPill({ orderId, hidden, className }: NotifyPillProps) {
  const [state, setState] = useState<NotifyState>("idle");

  useEffect(() => {
    if (!pushSupported() || !import.meta.env.VITE_VAPID_PUBLIC_KEY) {
      setState("unavailable");
      return;
    }
    if (pushPermission() === "denied") {
      setState("denied");
      return;
    }
    // Restore the "subscribed" state across refreshes — without this
    // flag, the pill renders the click-me button again on every mount
    // even though the underlying push subscription is still active.
    if (orderId && isOrderPushed(orderId)) {
      setState("subscribed");
      return;
    }
    setState("idle");
  }, [orderId]);

  if (hidden) return null;
  if (state === "unavailable") return null;

  const handleSubscribe = async () => {
    if (!orderId) return;
    setState("subscribing");
    const result = await subscribeToOrderPush(orderId);
    if (result.ok) setState("subscribed");
    else if (result.reason === "permission-denied") setState("denied");
    else if (result.reason === "unsupported" || result.reason === "missing-vapid")
      setState("unavailable");
    else {
      setState("idle");
      console.error("[push] subscribe failed:", result.message);
    }
  };

  if (state === "subscribed") {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-xs font-semibold text-success",
          className
        )}
      >
        <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
        We&apos;ll notify you when it&apos;s ready
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className
        )}
      >
        <BellOff aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
        Notifications blocked — enable in browser settings to opt in
      </p>
    );
  }

  const isSubscribing = state === "subscribing";

  return (
    <button
      type="button"
      onClick={handleSubscribe}
      disabled={isSubscribing}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {/* Periodic ring animation while idle — pauses on hover so the
          customer's pointer doesn't land on a moving target. Stops
          entirely while the subscribe call is in flight. */}
      <Bell
        aria-hidden="true"
        className={cn(
          "h-3.5 w-3.5",
          !isSubscribing && "animate-bell-ring group-hover:animate-none"
        )}
        strokeWidth={2.2}
      />
      {isSubscribing ? "Setting up…" : "Notify me when ready"}
    </button>
  );
}
