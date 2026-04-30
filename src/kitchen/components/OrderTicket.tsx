import { useEffect, useState } from "react";
import { ChevronRight, Clock } from "lucide-react";
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

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-3xl border bg-card p-5 transition-all animate-fade-up",
        isReady && "border-foreground bg-foreground text-background",
        !isReady && isUrgent && "border-destructive border-2",
        !isReady && isStale && "border-foreground"
      )}
    >
      {(isUrgent || isStale) && !isReady && (
        <div
          className={cn(
            "absolute -top-2 right-4 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            isUrgent
              ? "bg-destructive text-background"
              : "bg-foreground text-background"
          )}
        >
          {isUrgent ? "Urgent" : "Waiting"}
        </div>
      )}

      <header className="flex items-start justify-between gap-3">
        <div>
          <p
            className={cn(
              "text-[11px] font-bold uppercase tracking-wider",
              isReady ? "text-background/70" : "text-muted-foreground"
            )}
          >
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
              isReady ? "bg-background/15" : ORDER_STATUS_PILL[order.status]
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={2.4} />
            {ORDER_STATUS_LABELS[order.status]}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 text-[11px] font-semibold tabular-nums",
              isReady
                ? "text-background/75"
                : isUrgent
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          >
            <Clock className="h-3 w-3" strokeWidth={2.2} />
            {formatAge(order.createdAt, now)}
          </span>
        </div>
      </header>

      <div
        className={cn(
          "mt-4 flex items-center gap-2 text-xs",
          isReady ? "text-background/75" : "text-muted-foreground"
        )}
      >
        <span className="font-mono font-semibold">{order.id}</span>
        {order.customerName && (
          <>
            <span aria-hidden>·</span>
            <span>{order.customerName}</span>
          </>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {order.items.map((item) => {
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
                  <p
                    className={cn(
                      "truncate text-sm",
                      isReady ? "text-background/75" : "text-muted-foreground"
                    )}
                  >
                    {selectionLabel}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold",
                  isReady ? "bg-background/15" : "bg-muted"
                )}
              >
                ×{item.quantity}
              </span>
            </li>
          );
        })}
      </ul>

      {order.notes && (
        <div
          className={cn(
            "mt-4 rounded-2xl border-2 border-dashed p-3 text-sm",
            isReady
              ? "border-background/30 text-background"
              : "border-border text-foreground"
          )}
        >
          <p
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              isReady ? "text-background/75" : "text-muted-foreground"
            )}
          >
            Special instructions
          </p>
          <p className="mt-1 font-medium">{order.notes}</p>
        </div>
      )}

      <button
        onClick={() => onAdvance(order.id, order.status)}
        className={cn(
          "mt-5 group flex w-full items-center justify-center gap-1.5 rounded-full py-3.5 text-sm font-semibold transition-transform active:scale-[0.98]",
          isReady
            ? "bg-background text-foreground hover:scale-[1.01]"
            : "bg-foreground text-background hover:scale-[1.01]"
        )}
      >
        {ADVANCE_LABEL[order.status]}
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </article>
  );
}
