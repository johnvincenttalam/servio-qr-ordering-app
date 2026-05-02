import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cancelMyOrder } from "@/services/orders";
import { getDeviceId } from "@/lib/deviceId";

/**
 * 30-second undo window for a freshly placed order. Drives the cancel
 * banner on OrderSuccessModal: counts down to zero, exposes a cancel()
 * action that calls the cancel_my_order RPC, and clamps state so the
 * UI doesn't flicker when the modal is reopened.
 *
 * The 30s number is enforced server-side too (see cancel_my_order in
 * 0017_anti_abuse_phase1.sql) — the hook just keeps the UI in sync.
 */

export type UndoState = "idle" | "cancelling" | "cancelled" | "expired";

interface UseUndoWindowReturn {
  /** Seconds left in the window. 0 once expired. */
  secondsLeft: number;
  /** Lifecycle state. */
  state: UndoState;
  /** Fire the cancel RPC. No-op outside the window. Returns true on success. */
  cancel: () => Promise<boolean>;
}

const WINDOW_MS = 30_000;

export function useUndoWindow(
  orderId: string | null,
  /** Anchor timestamp (Date.now()) when the order was placed. */
  placedAt: number | null
): UseUndoWindowReturn {
  const [state, setState] = useState<UndoState>("idle");
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (placedAt === null) return 0;
    return Math.max(0, Math.ceil((WINDOW_MS - (Date.now() - placedAt)) / 1000));
  });

  // Keep the latest state in a ref so the cancel() callback sees fresh
  // values without participating in its dependency array. (The callback
  // is read by parent components inside event handlers, not effects, so
  // a stable identity matters less than a fresh closure.)
  const stateRef = useRef(state);
  stateRef.current = state;

  // Reset on each new order id. The same modal instance is reused across
  // submits in some flows (e.g. closed modal → place again), so we have
  // to actively rehydrate when the anchor changes.
  useEffect(() => {
    if (orderId === null || placedAt === null) {
      setState("idle");
      setSecondsLeft(0);
      return;
    }
    const remaining = Math.max(
      0,
      Math.ceil((WINDOW_MS - (Date.now() - placedAt)) / 1000)
    );
    setSecondsLeft(remaining);
    setState(remaining > 0 ? "idle" : "expired");
  }, [orderId, placedAt]);

  // Tick once a second while the window is open. We only run the
  // interval when there's something to count down — no zombie timers
  // when the modal is closed or already cancelled.
  useEffect(() => {
    if (orderId === null || placedAt === null) return;
    if (state !== "idle") return;
    if (secondsLeft <= 0) {
      setState("expired");
      return;
    }
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        const next = Math.max(
          0,
          Math.ceil((WINDOW_MS - (Date.now() - placedAt)) / 1000)
        );
        if (next <= 0) {
          setState((s) => (s === "idle" ? "expired" : s));
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [orderId, placedAt, state, secondsLeft]);

  const cancel = useCallback(async (): Promise<boolean> => {
    if (orderId === null) return false;
    if (stateRef.current !== "idle") return false;
    setState("cancelling");
    const ok = await cancelMyOrder(orderId, getDeviceId());
    if (ok) {
      setState("cancelled");
      return true;
    }
    // RPC returned false — out of window, wrong device, already advanced.
    // Refresh local state in case the timer races with the server.
    toast.error("Too late to cancel — kitchen has the order.");
    setState("expired");
    return false;
  }, [orderId]);

  return { secondsLeft, state, cancel };
}
