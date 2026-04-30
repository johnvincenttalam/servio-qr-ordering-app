import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/useAppStore";
import { useOrderStatus } from "@/hooks/useOrderStatus";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_DESCRIPTIONS,
} from "@/constants";
import { AnimatedStatusIcon } from "@/components/order/AnimatedStatusIcon";
import type { OrderStatus } from "@/types";
import { cn } from "@/lib/utils";

const STEPS: OrderStatus[] = ["pending", "preparing", "ready"];

export default function OrderStatusPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableId = useAppStore((s) => s.tableId);
  const currentOrderId = useAppStore((s) => s.currentOrderId);
  const setTableId = useAppStore((s) => s.setTableId);
  const setCurrentOrderId = useAppStore((s) => s.setCurrentOrderId);

  // A push-notification click opens the page with ?order=ORD-XYZ. If the new
  // tab has empty sessionStorage (the original ordering tab was closed), we
  // hydrate the store from the query param so the page can render the order.
  const queryOrderId = searchParams.get("order");
  const effectiveOrderId = queryOrderId ?? currentOrderId;

  const { order, isLoading } = useOrderStatus(effectiveOrderId);

  useEffect(() => {
    if (queryOrderId && queryOrderId !== currentOrderId) {
      setCurrentOrderId(queryOrderId);
    }
  }, [queryOrderId, currentOrderId, setCurrentOrderId]);

  // Once the order is fetched, mirror its table id into the store so the rest
  // of the app (header table chip, "Order Again" → menu) stays consistent.
  useEffect(() => {
    if (order && !tableId) {
      setTableId(order.tableId);
    }
  }, [order, tableId, setTableId]);

  // Only redirect home if we have nothing to render — no table, no order id,
  // no query hint. Otherwise let the loading/empty states handle it.
  useEffect(() => {
    if (!tableId && !effectiveOrderId) {
      navigate("/", { replace: true });
    }
  }, [tableId, effectiveOrderId, navigate]);

  if (!tableId && !effectiveOrderId) return null;

  if (!effectiveOrderId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-muted">
          <UtensilsCrossed className="h-9 w-9 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">No Active Order</h2>
        <p className="text-sm text-muted-foreground">
          You haven&apos;t placed any orders yet.
        </p>
        <button
          onClick={() => navigate("/menu")}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  if (isLoading && !order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-56 w-full rounded-3xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Order not found.</p>
      </div>
    );
  }

  const currentIndex = STEPS.indexOf(order.status);
  const isReady = order.status === "ready";

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Order Status</h2>

      <section
        className={cn(
          "rounded-3xl p-6 animate-fade-up",
          isReady
            ? "bg-foreground text-background"
            : "border border-border bg-card text-foreground"
        )}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            key={order.status}
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-3xl",
              isReady ? "bg-background/10" : "bg-muted"
            )}
          >
            <AnimatedStatusIcon status={order.status} />
          </div>
          <div>
            <span
              className={cn(
                "inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
                isReady ? "bg-background/15" : "bg-muted text-muted-foreground"
              )}
            >
              Order #{order.id}
            </span>
            <h3 className="mt-2 text-3xl font-bold leading-tight">
              {ORDER_STATUS_LABELS[order.status]}
            </h3>
            <p
              className={cn(
                "mx-auto mt-2 max-w-xs text-sm",
                isReady ? "text-background/75" : "text-muted-foreground"
              )}
            >
              {ORDER_STATUS_DESCRIPTIONS[order.status]}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 animate-fade-up">
        <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Progress
        </h4>
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const isComplete = i < currentIndex;
            const isCurrent = i === currentIndex;
            const isActive = isComplete || isCurrent;
            return (
              <div key={step} className="flex flex-1 items-center last:flex-initial">
                <div className="relative flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all",
                      isActive
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground border border-border"
                    )}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "absolute top-11 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {ORDER_STATUS_LABELS[step]}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="mx-1 h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full bg-foreground transition-all duration-500",
                        isComplete ? "w-full" : "w-0"
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="h-6" />
      </section>

      {isReady && (
        <button
          onClick={() => navigate("/menu")}
          className="w-full rounded-full bg-foreground py-4 text-base font-semibold text-background transition-transform hover:scale-[1.01] active:scale-[0.98]"
        >
          Order Again
        </button>
      )}
    </div>
  );
}
