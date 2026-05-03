import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Heart,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useOrderStatus } from "@/hooks/useOrderStatus";
import { useOrderEta } from "@/hooks/useOrderEta";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_DESCRIPTIONS,
  ORDER_STATUS_PILL,
} from "@/constants";
import { AnimatedStatusIcon } from "@/components/order/AnimatedStatusIcon";
import { OrderStatusSkeleton } from "@/components/order/OrderStatusSkeleton";
import { WaiterCallSheet } from "@/components/common/WaiterCallSheet";
import { NotifyPill } from "@/components/common/NotifyPill";
import type { OrderStatus } from "@/types";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils";

const STEPS: OrderStatus[] = ["pending", "preparing", "ready"];

/**
 * Linear gradient for the hero card. Each status uses its brand colour
 * at varying opacity stops — saturated top-left, fading toward
 * bottom-right — for a subtle "lit-from-the-corner" feel that adds
 * depth without being a flat tint.
 */
const STATUS_TINT: Record<OrderStatus, string> = {
  pending:
    "bg-gradient-to-br from-warning/40 via-warning/25 to-warning/10",
  preparing:
    "bg-gradient-to-br from-info/35 via-info/20 to-info/10",
  ready:
    "bg-gradient-to-br from-success/35 via-success/20 to-success/10",
};

/**
 * Wrap the single-number ETA into a small honest range. ±2 minutes is
 * tight enough to feel accurate but wide enough that a few seconds of
 * kitchen drift don't blow the prediction.
 */
function formatEtaRange(minutes: number): string {
  const low = Math.max(1, minutes - 2);
  const high = minutes + 2;
  return `${low}–${high} min`;
}

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
  const { settings } = useRestaurantSettings();
  const [callSheetOpen, setCallSheetOpen] = useState(false);
  // Show ETA only while the kitchen still has work to do — once the
  // order is ready or served, the wait-time hint is misleading.
  const isActive =
    order?.status === "pending" || order?.status === "preparing";
  const { minutes: etaMinutes } = useOrderEta(isActive);

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
          <UtensilsCrossed aria-hidden="true" className="h-9 w-9 text-muted-foreground" />
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
    return <OrderStatusSkeleton />;
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Order not found.</p>
      </div>
    );
  }

  // The kitchen marks an order "served" once the customer receives it.
  // Order.status is typed pending|preparing|ready in the customer-side
  // types (the staff side widens that), but at runtime the served value
  // can absolutely arrive via realtime — so we string-compare here and
  // render a dedicated "thanks for ordering" surface instead of the
  // tracking card, which stops making sense once it's complete.
  const isServed = (order.status as string) === "served";
  const currentIndex = STEPS.indexOf(order.status);
  const isReady = order.status === "ready";

  if (isServed) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Order Status</h2>

        <section className="rounded-3xl bg-card p-7 text-center text-foreground animate-fade-up">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-success text-white">
            <CheckCircle2 aria-hidden="true" className="h-10 w-10" strokeWidth={2.2} />
          </div>
          <span className="mt-4 inline-block rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Order #{order.id}
          </span>
          <h3 className="mt-2 text-3xl font-bold leading-tight">
            Enjoy your meal
          </h3>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Your order has been served. Thanks for ordering with {settings.name}!
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-semibold text-foreground">
            <Heart aria-hidden="true" className="h-3 w-3 text-destructive" strokeWidth={2.4} />
            We hope to see you again
          </p>
        </section>

        <button
          type="button"
          onClick={() => setCallSheetOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/30 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Bell aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Need help?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Call a waiter or request the bill
              </p>
            </div>
          </div>
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2.2}
          />
        </button>

        <button
          onClick={() => navigate("/menu")}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground py-4 text-base font-semibold text-background transition-transform hover:scale-[1.01] active:scale-[0.98]"
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
          Order something else
        </button>

        <WaiterCallSheet
          open={callSheetOpen}
          onClose={() => setCallSheetOpen(false)}
          tableId={order.tableId}
          orderId={order.id}
          showBill={true}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Order Status</h2>

      <section
        className={cn(
          "relative overflow-hidden rounded-3xl p-6 text-foreground animate-fade-up",
          STATUS_TINT[order.status]
        )}
      >
        {/* Soft decorative circle in the upper-right corner — gives the
            gradient hero a "lit-from-the-corner" depth like the
            inspiration. Pure decoration, no semantics. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-card/40 blur-2xl"
        />

        <div className="relative flex flex-col items-center gap-4 text-center">
          <div
            key={order.status}
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-3xl",
              ORDER_STATUS_PILL[order.status]
            )}
          >
            <AnimatedStatusIcon status={order.status} />
          </div>
          <div>
            <span className="inline-block rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Order #{order.id}
            </span>
            <h3 className="mt-2 text-3xl font-bold leading-tight tracking-tight">
              {ORDER_STATUS_LABELS[order.status]}.
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
              {ORDER_STATUS_DESCRIPTIONS[order.status]}
            </p>
            {isActive && etaMinutes !== null && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
                <Clock aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
                Usually ready in {formatEtaRange(etaMinutes)}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Notify pill — second-chance opt-in for customers who tapped
          Track Order before the modal's notify option appeared. Stretched
          to the section width here (vs the modal's compact pill) so it
          reads as a banner-CTA between the hero and the progress steps.
          Hides automatically once the order moves past preparing. */}
      <NotifyPill
        orderId={order.id}
        hidden={!isActive}
        className="w-full justify-center py-2.5 text-sm"
      />

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
                      // Each active step adopts its own status colour;
                      // completed steps share the success green so the
                      // chain reads as "this part is done".
                      isCurrent
                        ? ORDER_STATUS_PILL[step]
                        : isComplete
                        ? "bg-success text-white"
                        : "bg-muted text-muted-foreground border border-border"
                    )}
                  >
                    {isComplete ? (
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
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
                        "h-full bg-success transition-all duration-500",
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

      {/* Items recap. Lets the customer double-check what they ordered
          while they wait — names, quantities, picked options, line
          totals — without bouncing back to history. Mirrors the
          inspiration's "your order" panel but uses our card styling. */}
      <section className="rounded-3xl border border-border bg-card p-5 animate-fade-up">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your order
          </h4>
          <span className="text-xs font-semibold text-muted-foreground">
            {order.items.length}{" "}
            {order.items.length === 1 ? "item" : "items"}
          </span>
        </div>
        <ul className="space-y-3">
          {order.items.map((item) => {
            const selectionSummary = item.selections
              .map((s) => s.choiceName)
              .join(" · ");
            return (
              <li key={item.lineId} className="flex items-start gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {item.image && (
                    <img
                      src={item.image}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  {item.quantity > 1 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-bold text-background">
                      ×{item.quantity}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight">
                    {item.name}
                    {item.quantity > 1 && (
                      <span className="ml-1 text-muted-foreground">
                        · ×{item.quantity}
                      </span>
                    )}
                  </p>
                  {selectionSummary && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {selectionSummary}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatPrice(item.unitPrice * item.quantity)}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-semibold text-muted-foreground">
            Total
          </span>
          <span className="text-base font-bold tabular-nums">
            {formatPrice(order.total)}
          </span>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setCallSheetOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/30 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Bell className="h-4 w-4" strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Need help?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Call a waiter or request the bill
            </p>
          </div>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
          strokeWidth={2.2}
        />
      </button>

      {/* Always-on upsell. While the kitchen is still working, this lets
          guests add to their tab; once Ready, it's a "round 2" prompt. The
          unified label avoids the awkward "Order Again" wording while the
          first order isn't even out yet. */}
      <button
        onClick={() => navigate("/menu")}
        className="flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground py-4 text-base font-semibold text-background transition-transform hover:scale-[1.01] active:scale-[0.98]"
      >
        <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
        {isReady ? "Order something else" : "Add to your tab"}
      </button>

      <WaiterCallSheet
        open={callSheetOpen}
        onClose={() => setCallSheetOpen(false)}
        tableId={order.tableId}
        orderId={order.id}
        showBill={true}
      />
    </div>
  );
}
