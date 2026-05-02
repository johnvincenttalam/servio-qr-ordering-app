import { useEffect, useState } from "react";
import { Bell, BellOff, Check, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  pushPermission,
  pushSupported,
  subscribeToOrderPush,
} from "@/lib/push";
import { useUndoWindow } from "@/hooks/useUndoWindow";

interface OrderSuccessModalProps {
  open: boolean;
  orderId: string | null;
  /** ms timestamp the order was placed; anchors the 30s undo window. */
  placedAt: number | null;
  onView: () => void;
  /** Called after the customer successfully cancels inside the window. */
  onCancelled: () => void;
}

type NotifyState =
  | "idle" // hasn't asked
  | "subscribing" // permission/save in flight
  | "subscribed" // success
  | "denied" // user blocked
  | "unavailable"; // browser doesn't support OR vapid key missing

export function OrderSuccessModal({
  open,
  orderId,
  placedAt,
  onView,
  onCancelled,
}: OrderSuccessModalProps) {
  const [notify, setNotify] = useState<NotifyState>("idle");
  const undo = useUndoWindow(open ? orderId : null, open ? placedAt : null);

  // Initialise the notify state when the modal opens
  useEffect(() => {
    if (!open) return;
    if (!pushSupported()) {
      setNotify("unavailable");
      return;
    }
    if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) {
      setNotify("unavailable");
      return;
    }
    const perm = pushPermission();
    if (perm === "denied") setNotify("denied");
    else setNotify("idle");
  }, [open]);

  const handleSubscribe = async () => {
    if (!orderId) return;
    setNotify("subscribing");
    const result = await subscribeToOrderPush(orderId);
    if (result.ok) {
      setNotify("subscribed");
    } else if (result.reason === "permission-denied") {
      setNotify("denied");
    } else if (result.reason === "unsupported" || result.reason === "missing-vapid") {
      setNotify("unavailable");
    } else {
      setNotify("idle");
      console.error("[push] subscribe failed:", result.message);
    }
  };

  const cancelled = undo.state === "cancelled";
  const canCancel = undo.state === "idle" && undo.secondsLeft > 0;
  const cancelling = undo.state === "cancelling";

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) return;
        // After a successful cancel, route through onCancelled instead of onView
        // so the parent can clear the cart + navigate back to the menu.
        if (cancelled) onCancelled();
        else onView();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-sm rounded-3xl p-8"
      >
        <div className="flex flex-col items-center text-center">
          {cancelled ? (
            <CancelledIcon />
          ) : (
            <div className="animate-check-pulse">
              <svg
                className="h-20 w-20 text-success"
                viewBox="0 0 52 52"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="26"
                  cy="26"
                  r="24"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="animate-check-circle"
                />
                <path
                  d="M14 27 L22 35 L38 19"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-check-mark"
                />
              </svg>
            </div>
          )}

          <h2
            className="mt-6 text-2xl font-bold animate-fade-up"
            style={{ animationDelay: "750ms" }}
          >
            {cancelled ? "Order Cancelled" : "Order Placed"}
          </h2>
          <p
            className="mt-2 text-sm text-muted-foreground animate-fade-up"
            style={{ animationDelay: "880ms" }}
          >
            {cancelled ? (
              "We caught it before the kitchen — nothing was sent."
            ) : orderId ? (
              <>
                Order{" "}
                <span className="font-semibold text-foreground">
                  #{orderId}
                </span>{" "}
                is on its way to the kitchen.
              </>
            ) : (
              "Your order is on its way to the kitchen."
            )}
          </p>

          {cancelled ? (
            <button
              onClick={onCancelled}
              className="group mt-6 flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground py-3.5 font-semibold text-background transition-transform duration-200 hover:scale-[1.01] active:scale-[0.98] animate-fade-up"
              style={{ animationDelay: "1020ms" }}
            >
              Back to Menu
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <button
              onClick={onView}
              className="group mt-6 flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground py-3.5 font-semibold text-background transition-transform duration-200 hover:scale-[1.01] active:scale-[0.98] animate-fade-up"
              style={{ animationDelay: "1020ms" }}
            >
              Track Order
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}

          {!cancelled && canCancel && (
            <button
              type="button"
              onClick={undo.cancel}
              disabled={cancelling}
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors active:scale-95 animate-fade-up",
                "text-foreground/70 hover:bg-muted hover:text-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              style={{ animationDelay: "1150ms" }}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.4} />
              {cancelling
                ? "Cancelling…"
                : `Cancel order · ${undo.secondsLeft}s`}
            </button>
          )}

          {!cancelled && !canCancel && (
            <NotifyOption
              state={notify}
              onSubscribe={handleSubscribe}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CancelledIcon() {
  return (
    <div className="animate-check-pulse">
      <svg
        className="h-20 w-20 text-muted-foreground"
        viewBox="0 0 52 52"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="26"
          cy="26"
          r="24"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M18 18 L34 34 M34 18 L18 34"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function NotifyOption({
  state,
  onSubscribe,
}: {
  state: NotifyState;
  onSubscribe: () => void;
}) {
  if (state === "unavailable") return null;

  if (state === "subscribed") {
    return (
      <p
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-success animate-fade-up"
        style={{ animationDelay: "1150ms" }}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
        We&apos;ll notify you when it&apos;s ready
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground animate-fade-up"
        style={{ animationDelay: "1150ms" }}
      >
        <BellOff className="h-3.5 w-3.5" strokeWidth={2.2} />
        Notifications blocked — enable in browser settings to opt in
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={onSubscribe}
      disabled={state === "subscribing"}
      className={cn(
        "mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors active:scale-95 animate-fade-up",
        "text-foreground/70 hover:bg-muted hover:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
      style={{ animationDelay: "1150ms" }}
    >
      <Bell className="h-3.5 w-3.5" strokeWidth={2.2} />
      {state === "subscribing" ? "Setting up…" : "Notify me when ready"}
    </button>
  );
}
