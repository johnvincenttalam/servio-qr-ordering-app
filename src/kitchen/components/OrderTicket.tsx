import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_ICONS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_PILL,
} from "@/constants";
import type { OrderStatus } from "@/types";
import type { KitchenOrder } from "../useKitchenOrders";

interface OrderTicketProps {
  order: KitchenOrder;
  onAdvance: (id: string, current: OrderStatus) => void;
}

const ADVANCE_LABEL: Record<OrderStatus, string> = {
  pending: "Start preparing",
  preparing: "Mark ready",
  ready: "Mark served",
};

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const URGENT_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

/** Above this count, the items list collapses to first 3 + an "+N more" toggle. */
const COMPACT_ITEMS_THRESHOLD = 4;

function formatAge(createdAt: number, now: number): string {
  const seconds = Math.floor((now - createdAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr`;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function OrderTicket({ order, onAdvance }: OrderTicketProps) {
  const now = useNow(15000);
  const Icon = ORDER_STATUS_ICONS[order.status];
  const isReady = order.status === "ready";

  const ageMs = now - order.createdAt;
  const isUrgent = !isReady && ageMs >= URGENT_THRESHOLD_MS;
  const isStale = !isReady && !isUrgent && ageMs >= STALE_THRESHOLD_MS;

  const [expanded, setExpanded] = useState(false);
  const totalItems = order.items.length;
  const collapsible = totalItems > COMPACT_ITEMS_THRESHOLD;
  const visibleItems =
    collapsible && !expanded ? order.items.slice(0, 3) : order.items;
  const hiddenCount = totalItems - visibleItems.length;

  return (
    <article
      // Unique view-transition-name per card so the browser smoothly
      // morphs the ticket between columns when its status changes.
      style={{ viewTransitionName: `kitchen-order-${order.id}` }}
      className={cn(
        "relative flex flex-col rounded-3xl border border-border bg-card p-5 transition-all animate-fade-up",
        // Ready: tinted green background + dark text. The tint signals
        // "done / passive" without crushing readability for body copy.
        isReady && "border-success/40 bg-success/10",
        // Active cards age in via a thin coloured strip on the left edge
        // (a "thermometer") instead of a full destructive border.
        !isReady && isStale && "border-l-4 border-l-warning",
        !isReady && isUrgent && "border-l-4 border-l-destructive"
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Table
          </p>
          <h2 className="text-4xl font-extrabold leading-none tracking-tight">
            {order.tableId}
          </h2>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
              ORDER_STATUS_PILL[order.status]
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={2.4} />
            {ORDER_STATUS_LABELS[order.status]}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 text-[11px] font-semibold tabular-nums",
              isUrgent ? "text-destructive" : "text-muted-foreground"
            )}
          >
            <Clock className="h-3 w-3" strokeWidth={2.2} />
            {formatAge(order.createdAt, now)}
          </span>
        </div>
      </header>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono font-semibold">{order.id}</span>
        {order.customerName && (
          <>
            <span aria-hidden>·</span>
            <span>{order.customerName}</span>
          </>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {visibleItems.map((item) => {
          const selectionLabel =
            item.selections.length > 0
              ? item.selections.map((s) => s.choiceName).join(" · ")
              : null;
          return (
            <li
              key={item.lineId}
              className="flex items-baseline justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">
                  {item.name}
                </p>
                {selectionLabel && (
                  <p className="truncate text-sm text-muted-foreground">
                    {selectionLabel}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-sm font-bold">
                ×{item.quantity}
              </span>
            </li>
          );
        })}
      </ul>

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 self-start rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" strokeWidth={2.4} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" strokeWidth={2.4} />
              +{hiddenCount} more item{hiddenCount === 1 ? "" : "s"}
            </>
          )}
        </button>
      )}

      {order.notes && (
        // Sticky-note treatment: solid yellow tint, bold body, soft
        // shadow so it reads as something *pasted* on top of the ticket.
        <div className="mt-4 rounded-2xl border border-warning/60 bg-warning/20 p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">
            Note
          </p>
          <p className="mt-1 text-base font-bold leading-snug text-foreground">
            {order.notes}
          </p>
        </div>
      )}

      <button
        onClick={() => onAdvance(order.id, order.status)}
        className="mt-5 group flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.01] active:scale-[0.98]"
      >
        {ADVANCE_LABEL[order.status]}
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </article>
  );
}
