import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  Minus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUndoWindow } from "@/hooks/useUndoWindow";
import { getDeviceId } from "@/lib/deviceId";
import {
  modifyMyOrderItem,
  MODIFY_ORDER_ERROR_COPY,
} from "@/services/orders";
import { formatPrice } from "@/utils";
import { NotifyPill } from "@/components/common/NotifyPill";
import type { CartItem } from "@/types";

interface OrderSuccessModalProps {
  open: boolean;
  orderId: string | null;
  /** ms timestamp the order was placed; anchors both the cancel + edit windows. */
  placedAt: number | null;
  /** Snapshot of items at submit time. Modal mirrors this internally so edits can mutate. */
  items: CartItem[];
  onView: () => void;
  /** Called after the customer successfully cancels (or edits down to 0 lines). */
  onCancelled: () => void;
}

type Mode = "placed" | "editing";

/** Edit window mirrors modify_my_order_item server-side: 60 seconds. */
const EDIT_WINDOW_MS = 60_000;
/** Server-side cap — must match modify_my_order_item. */
const MAX_EDITS = 3;

export function OrderSuccessModal({
  open,
  orderId,
  placedAt,
  items: initialItems,
  onView,
  onCancelled,
}: OrderSuccessModalProps) {
  const undo = useUndoWindow(open ? orderId : null, open ? placedAt : null);

  // Modal pivot state — placed = the success view, editing = inline
  // line editor with - buttons.
  const [mode, setMode] = useState<Mode>("placed");

  // Local mirror of order lines so a successful edit visibly mutates
  // the list without a refetch. Reset on each fresh open.
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [editsUsed, setEditsUsed] = useState(0);
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);

  // Tick the edit-window countdown locally — separate from useUndoWindow
  // because the windows are different (60s edit vs 30s cancel) but anchored
  // on the same placedAt.
  const [editSecondsLeft, setEditSecondsLeft] = useState<number>(() =>
    placedAt ? secondsLeftFor(placedAt, EDIT_WINDOW_MS) : 0
  );

  // Reset transient state when the modal opens for a new order.
  useEffect(() => {
    if (!open) return;
    setMode("placed");
    setItems(initialItems);
    setEditsUsed(0);
    setPendingLineId(null);
  }, [open, orderId, initialItems]);

  // Edit-window ticker. Same 250ms cadence as useUndoWindow for parity.
  useEffect(() => {
    if (!open || placedAt === null) return;
    const tick = () => {
      const next = secondsLeftFor(placedAt, EDIT_WINDOW_MS);
      setEditSecondsLeft(next);
      // Auto-exit edit mode the moment the window closes — leaving
      // the inline editor up after the buttons are dead is misleading.
      if (next <= 0) {
        setMode((m) => (m === "editing" ? "placed" : m));
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [open, placedAt]);

  const handleDecrement = async (line: CartItem) => {
    if (!orderId) return;
    const newQty = line.quantity - 1;
    setPendingLineId(line.lineId);
    const result = await modifyMyOrderItem(
      orderId,
      getDeviceId(),
      line.lineId,
      newQty
    );
    setPendingLineId(null);

    if (!result.ok) {
      toast.error(MODIFY_ORDER_ERROR_COPY[result.error]);
      return;
    }

    // Optimistically reflect the server's truth in our local mirror.
    setItems((prev) =>
      newQty === 0
        ? prev.filter((it) => it.lineId !== line.lineId)
        : prev.map((it) =>
            it.lineId === line.lineId ? { ...it, quantity: newQty } : it
          )
    );
    setEditsUsed(MAX_EDITS - result.modificationsLeft);

    // The server auto-cancels when items hit 0 — pivot the modal to
    // reflect that.
    if (newQty === 0 && items.length === 1) {
      // Routed through the same exit path the cancel pill uses so
      // Checkout clears the cart + bounces to /menu.
      toast.success("Order cancelled — last item removed");
      onCancelled();
    }
  };

  const cancelled = undo.state === "cancelled";
  const canCancel = undo.state === "idle" && undo.secondsLeft > 0;
  const cancelling = undo.state === "cancelling";
  const canEdit =
    mode === "placed" &&
    !cancelled &&
    editSecondsLeft > 0 &&
    editsUsed < MAX_EDITS &&
    items.length > 0;
  const editsLeft = MAX_EDITS - editsUsed;

  // ── Editing view ──────────────────────────────────────────────────
  if (mode === "editing" && !cancelled) {
    return (
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) onView();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-sm rounded-3xl p-6"
        >
          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold">Editing order</h2>
              <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                {editSecondsLeft}s · {editsLeft} edit
                {editsLeft === 1 ? "" : "s"} left
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Tap − to lower a quantity. Removing the last item cancels the
              order.
            </p>

            <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
              {items.map((line) => (
                <li
                  key={line.lineId}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5"
                >
                  <img
                    src={line.image}
                    alt=""
                    aria-hidden="true"
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">
                      {line.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      ×{line.quantity} · {formatPrice(line.unitPrice)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDecrement(line)}
                    disabled={pendingLineId === line.lineId || editsUsed >= MAX_EDITS}
                    aria-label={
                      line.quantity === 1
                        ? `Remove ${line.name}`
                        : `Decrease ${line.name}`
                    }
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
                      line.quantity === 1
                        ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
                        : "border-border text-foreground/80 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {line.quantity === 1 ? (
                      <Trash2
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        strokeWidth={2.4}
                      />
                    ) : (
                      <Minus
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        strokeWidth={2.4}
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setMode("placed")}
                className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Placed / Cancelled view ───────────────────────────────────────
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) return;
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

          {!cancelled && (canCancel || canEdit) && (
            <div
              className="mt-3 flex flex-wrap items-center justify-center gap-2 animate-fade-up"
              style={{ animationDelay: "1150ms" }}
            >
              {canCancel && (
                <button
                  type="button"
                  onClick={undo.cancel}
                  disabled={cancelling}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors active:scale-95",
                    "text-foreground/70 hover:bg-muted hover:text-foreground",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                  {cancelling
                    ? "Cancelling…"
                    : `Cancel · ${undo.secondsLeft}s`}
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setMode("editing")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors active:scale-95",
                    "text-foreground/70 hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Edit · {editSecondsLeft}s
                </button>
              )}
            </div>
          )}

          {!cancelled && !canCancel && !canEdit && (
            <NotifyPill
              orderId={orderId}
              className="mt-3 animate-fade-up"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function secondsLeftFor(placedAt: number, windowMs: number): number {
  return Math.max(0, Math.ceil((windowMs - (Date.now() - placedAt)) / 1000));
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

