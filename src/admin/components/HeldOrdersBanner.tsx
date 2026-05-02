import { useEffect, useState } from "react";
import { AlertTriangle, Check, Shield, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice, formatRelative } from "@/utils";
import { ConfirmFooterRow } from "./ConfirmFooterRow";
import type { AdminOrder } from "../useAdminOrders";

/**
 * Surfaces orders the anti-abuse trigger flagged for staff review (rate-limit
 * spike, burst pattern, suspicious device). Renders the same way as
 * WaiterCallsBanner so operators don't have to learn a second visual
 * vocabulary. Each row offers approve / reject / block-device.
 */

interface HeldOrdersBannerProps {
  orders: AdminOrder[];
  onApprove: (id: string) => Promise<void> | void;
  onReject: (id: string) => Promise<void> | void;
  /** Block by device id; we only call this when the order has one. */
  onBlockDevice: (deviceId: string, reason?: string) => Promise<void> | void;
}

export function HeldOrdersBanner({
  orders,
  onApprove,
  onReject,
  onBlockDevice,
}: HeldOrdersBannerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (orders.length === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [orders.length]);

  if (orders.length === 0) return null;

  return (
    <section className="mb-4 space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-warning">
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />
          {orders.length} held order{orders.length === 1 ? "" : "s"} — review
          before sending to kitchen
        </h2>
      </div>
      <ul className="space-y-2">
        {orders.map((order) => (
          <HeldRow
            key={order.id}
            order={order}
            now={now}
            onApprove={() => onApprove(order.id)}
            onReject={() => onReject(order.id)}
            onBlockDevice={(reason) =>
              order.deviceId
                ? onBlockDevice(order.deviceId, reason)
                : undefined
            }
          />
        ))}
      </ul>
    </section>
  );
}

interface HeldRowProps {
  order: AdminOrder;
  now: number;
  onApprove: () => Promise<void> | void;
  onReject: () => Promise<void> | void;
  onBlockDevice: (reason?: string) => Promise<void> | void;
}

function HeldRow({
  order,
  now,
  onApprove,
  onReject,
  onBlockDevice,
}: HeldRowProps) {
  // Confirm prompt for the destructive actions. We don't gate Approve since
  // it's the friendly path — if staff misclick they can always cancel later.
  const [confirming, setConfirming] = useState<"reject" | "block" | null>(null);
  const [pending, setPending] = useState(false);

  const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);

  const guard = async (action: () => Promise<void> | void) => {
    if (pending) return;
    setPending(true);
    try {
      await action();
    } finally {
      setPending(false);
      setConfirming(null);
    }
  };

  return (
    <li className="rounded-2xl border border-warning/40 bg-warning/5 p-3 animate-fade-up">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-foreground">
          <span className="text-sm font-extrabold tracking-tight">
            {order.tableId}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="flex items-baseline gap-2 truncate text-sm font-semibold leading-tight">
              <span className="truncate">
                {order.customerName ?? "Guest"}
              </span>
              <span className="shrink-0 font-mono text-[10px] font-medium text-muted-foreground">
                {order.id}
              </span>
            </h3>
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {formatPrice(order.total)}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span aria-hidden>·</span>
            <span>{formatRelative(order.createdAt, now)}</span>
            {order.riskScore > 0 && (
              <>
                <span aria-hidden>·</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    order.riskScore >= 60
                      ? "bg-destructive/15 text-destructive"
                      : "bg-warning/20 text-foreground"
                  )}
                >
                  Risk {order.riskScore}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {confirming === "reject" ? (
        <ConfirmFooterRow
          question={
            <>
              Reject order <span className="font-bold">{order.id}</span>?
            </>
          }
          cancelLabel="Keep"
          confirmLabel="Reject"
          pendingLabel="Rejecting…"
          pending={pending}
          onCancel={() => setConfirming(null)}
          onConfirm={() => guard(onReject)}
        />
      ) : confirming === "block" ? (
        <ConfirmFooterRow
          question={
            <>
              Block this device from future orders? They&apos;ll have to ask
              staff to be unblocked.
            </>
          }
          cancelLabel="Cancel"
          confirmLabel="Block + Reject"
          pendingLabel="Blocking…"
          pending={pending}
          onCancel={() => setConfirming(null)}
          onConfirm={() =>
            guard(async () => {
              await onBlockDevice(`held order ${order.id}`);
              await onReject();
            })
          }
        />
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {order.deviceId && (
            <button
              type="button"
              onClick={() => setConfirming("block")}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/15 active:scale-95 disabled:opacity-50"
            >
              <Shield className="h-3 w-3" strokeWidth={2.4} />
              Block device
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirming("reject")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground active:scale-95 disabled:opacity-50"
          >
            <X className="h-3 w-3" strokeWidth={2.4} />
            Reject
          </button>
          <button
            type="button"
            onClick={() => guard(onApprove)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-[11px] font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            <Check className="h-3 w-3" strokeWidth={2.4} />
            Approve
          </button>
        </div>
      )}
    </li>
  );
}
