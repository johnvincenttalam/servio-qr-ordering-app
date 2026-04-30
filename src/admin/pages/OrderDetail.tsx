import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatPrice, formatRelative } from "@/utils";
import {
  ADMIN_STATUS_ICON,
  ADMIN_STATUS_LABEL,
  ADMIN_STATUS_PILL,
  ADMIN_STATUS_PROGRESSION,
} from "../orderStatus";
import type {
  AdminOrder,
  AdminOrderStatus,
} from "../useAdminOrders";

interface OrderDetailProps {
  open: boolean;
  order: AdminOrder | null;
  onClose: () => void;
  onSetStatus: (id: string, status: AdminOrderStatus) => Promise<void>;
}

export function OrderDetail({
  open,
  order,
  onClose,
  onSetStatus,
}: OrderDetailProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) {
      setConfirmingCancel(false);
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [open]);

  if (!order) return null;

  const isTerminal = order.status === "served" || order.status === "cancelled";
  const Icon = ADMIN_STATUS_ICON[order.status];

  const handleStatus = async (next: AdminOrderStatus) => {
    if (next === order.status || pending) return;
    setPending(true);
    try {
      await onSetStatus(order.id, next);
      toast.success(`Order ${order.id} set to ${ADMIN_STATUS_LABEL[next]}`);
    } finally {
      setPending(false);
    }
  };

  const handleCancel = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onSetStatus(order.id, "cancelled");
      toast.success(`Order ${order.id} cancelled`);
      onClose();
    } finally {
      setPending(false);
      setConfirmingCancel(false);
    }
  };

  const subtotal = order.items.reduce(
    (sum, it) => sum + it.unitPrice * it.quantity,
    0
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[92dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:w-full sm:max-w-2xl"
      >
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogDescription className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {order.id}
              </DialogDescription>
              <DialogTitle className="text-xl font-bold leading-tight">
                Table {order.tableId}
              </DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {order.customerName ? (
                  <>
                    <span className="text-foreground">
                      {order.customerName}
                    </span>{" "}
                    ·{" "}
                  </>
                ) : (
                  "Guest · "
                )}
                {formatRelative(order.createdAt, now)}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                ADMIN_STATUS_PILL[order.status]
              )}
            >
              <Icon className="h-3 w-3" strokeWidth={2.4} />
              {ADMIN_STATUS_LABEL[order.status]}
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Items */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Items ({order.items.reduce((sum, it) => sum + it.quantity, 0)})
            </h3>
            <ul className="mt-2 space-y-2">
              {order.items.map((item) => {
                const lineTotal = item.unitPrice * item.quantity;
                const selectionLabel =
                  item.selections.length > 0
                    ? item.selections.map((s) => s.choiceName).join(" · ")
                    : null;
                return (
                  <li
                    key={item.lineId}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-12 w-12 shrink-0 rounded-xl border border-border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {item.name}
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums">
                          {formatPrice(lineTotal)}
                        </span>
                      </p>
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>×{item.quantity}</span>
                        {selectionLabel && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="truncate">{selectionLabel}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Special instructions */}
          {order.notes && (
            <section className="rounded-2xl border-2 border-dashed border-border bg-muted/40 p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Special instructions
              </h3>
              <p className="mt-1 text-sm font-medium">{order.notes}</p>
            </section>
          )}

          {/* Totals */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">
                {formatPrice(subtotal)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-dashed border-border pt-2">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold tabular-nums">
                {formatPrice(order.total)}
              </span>
            </div>
          </section>

          {/* Status control */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ADMIN_STATUS_PROGRESSION.map((s) => {
                const isActive = order.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleStatus(s)}
                    aria-pressed={isActive}
                    disabled={pending || isActive}
                    className={cn(
                      "rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors active:scale-95 disabled:cursor-not-allowed",
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground/70 hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
                    )}
                  >
                    {ADMIN_STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
            {order.status === "cancelled" && (
              <p className="mt-2 text-xs text-muted-foreground">
                This order is cancelled. Set it to a different status to
                reactivate.
              </p>
            )}
          </section>
        </div>

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          {confirmingCancel ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium">
                Cancel order{" "}
                <span className="font-bold">{order.id}</span>?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  disabled={pending}
                  className="rounded-full px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
                >
                  Keep order
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                  {pending ? "Cancelling…" : "Cancel order"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              {!isTerminal && order.status !== "cancelled" ? (
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15 active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                  Cancel order
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
              >
                Close
              </button>
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
