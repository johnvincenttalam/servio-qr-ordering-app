import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Clock,
  History as HistoryIcon,
  Package,
  RefreshCw,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/useAppStore";
import { fetchOrderStatus } from "@/services/orders";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import {
  getOrderHistory,
  type OrderHistoryEntry,
} from "@/lib/orderHistory";
import { formatPrice, formatRelative } from "@/utils";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

type LiveStatus = Order["status"] | "served" | "cancelled";

interface HistoryRow {
  entry: OrderHistoryEntry;
  /** Live order from Supabase. null = not found (deleted), undefined = loading. */
  order: Order | null | undefined;
}

const STATUS_LABEL: Record<LiveStatus, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

const STATUS_ICON: Record<LiveStatus, LucideIcon> = {
  pending: Clock,
  preparing: ChefHat,
  ready: CheckCircle2,
  served: Package,
  cancelled: Trash2,
};

const STATUS_PILL: Record<LiveStatus, string> = {
  pending: "bg-warning text-foreground",
  preparing: "bg-info text-white",
  ready: "bg-success text-white",
  served: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive text-white",
};

const ACTIVE_STATUSES = new Set<LiveStatus>(["pending", "preparing", "ready"]);

export default function HistoryPage() {
  const navigate = useNavigate();
  const tableId = useAppStore((s) => s.tableId);
  const cart = useAppStore((s) => s.cart);
  const addToCart = useAppStore((s) => s.addToCart);
  const setCurrentOrderId = useAppStore((s) => s.setCurrentOrderId);

  const [now, setNow] = useState(() => Date.now());
  const [rows, setRows] = useState<HistoryRow[]>(() =>
    getOrderHistory().map((entry) => ({ entry, order: undefined }))
  );

  // Tick "5 min ago" labels every 30s while the page is open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Set of order ids we care about — used by the realtime handler to
  // ignore changes for orders that aren't in this device's history.
  const historyIds = useMemo(
    () => new Set(rows.map((r) => r.entry.id)),
    [rows]
  );

  const cancelledRef = useRef(false);

  /**
   * Re-fetch all history orders in parallel. We could refetch only the
   * row that just changed, but the list is capped at 20 entries so the
   * extra reads are cheap and the code stays simple.
   */
  const refetchAll = useCallback(async () => {
    const entries = getOrderHistory();
    if (entries.length === 0) {
      if (!cancelledRef.current) setRows([]);
      return;
    }
    const fresh = await Promise.all(
      entries.map(async (entry) => {
        try {
          const order = await fetchOrderStatus(entry.id);
          return { entry, order: order ?? null };
        } catch {
          return { entry, order: null };
        }
      })
    );
    if (!cancelledRef.current) setRows(fresh);
  }, []);

  // Initial load: render skeleton rows from the localStorage index, then
  // fetch live state in parallel.
  useEffect(() => {
    cancelledRef.current = false;
    const entries = getOrderHistory();
    setRows(entries.map((entry) => ({ entry, order: undefined })));
    if (entries.length > 0) refetchAll();
    return () => {
      cancelledRef.current = true;
    };
  }, [refetchAll]);

  // Realtime: any change on the orders table triggers a refetch IF the
  // changed row is one of ours. Filtering client-side is fine — the
  // payload's `new` and `old` records carry the id.
  useRealtimeTables({
    channel: "customer-history",
    tables: ["orders"],
    onChange: (_table, payload) => {
      const row = (payload.new ?? payload.old) as { id?: string } | null;
      if (row?.id && historyIds.has(row.id)) {
        refetchAll();
      }
    },
  });

  const handleReorder = (order: Order) => {
    // Drop archived / unavailable items rather than blocking the whole
    // reorder. The customer sees a toast counting how many lines we
    // skipped and ends up at /cart with the rest.
    let added = 0;
    let skipped = 0;
    for (const line of order.items) {
      if (!line.itemId) {
        skipped++;
        continue;
      }
      addToCart(
        {
          id: line.itemId,
          name: line.name,
          price: line.basePrice,
          image: line.image,
        },
        line.selections,
        line.quantity
      );
      added++;
    }
    if (added === 0) {
      toast.error("None of these items are available anymore.");
      return;
    }
    if (skipped > 0) {
      toast.message(
        `Added ${added} item${added === 1 ? "" : "s"} — ${skipped} no longer available`
      );
    } else {
      toast.success(`Added ${added} item${added === 1 ? "" : "s"} to cart`);
    }
    navigate("/cart");
  };

  const handleView = (order: Order) => {
    if (ACTIVE_STATUSES.has(order.status as LiveStatus)) {
      // Active orders open the live tracking page.
      setCurrentOrderId(order.id);
      navigate("/order-status");
    } else {
      // Terminal states already render inline in the row's expanded
      // detail; no separate page navigation needed.
    }
  };

  const totalEntries = rows.length;
  const cartCount = useMemo(
    () => cart.reduce((sum, c) => sum + c.quantity, 0),
    [cart]
  );

  if (!tableId) {
    navigate("/", { replace: true });
    return null;
  }

  return (
    <div className="space-y-4 pb-24">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Past orders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your last {totalEntries === 0 ? "" : totalEntries} order
          {totalEntries === 1 ? "" : "s"} on this device. Tap{" "}
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">
            <RefreshCw className="h-3 w-3" strokeWidth={2.4} />
            Reorder
          </span>{" "}
          to add the same items to your cart.
        </p>
      </header>

      {totalEntries === 0 ? (
        <Empty onBrowse={() => navigate("/menu")} />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <HistoryRowView
              key={row.entry.id}
              row={row}
              now={now}
              onReorder={handleReorder}
              onView={handleView}
            />
          ))}
        </ul>
      )}

      {/* Sticky cart footer mirrors what the menu page shows so a
          reorder doesn't strand the customer without a way back. */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
          <div className="mx-auto max-w-md sm:max-w-2xl lg:max-w-3xl p-4">
            <button
              onClick={() => navigate("/cart")}
              className="pointer-events-auto group flex w-full items-center justify-between rounded-full bg-foreground px-5 py-4 text-background transition-transform hover:scale-[1.01] active:scale-[0.98] animate-fade-up"
            >
              <span className="flex items-center gap-3 font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/20 text-sm font-bold">
                  {cartCount}
                </span>
                <span className="text-sm">View Cart</span>
              </span>
              <ShoppingBag className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryRowView({
  row,
  now,
  onReorder,
  onView,
}: {
  row: HistoryRow;
  now: number;
  onReorder: (o: Order) => void;
  onView: (o: Order) => void;
}) {
  const { entry, order } = row;
  const loading = order === undefined;
  const missing = order === null;
  const status = order?.status as LiveStatus | undefined;
  const Icon = status ? STATUS_ICON[status] : Clock;
  const isActive = status ? ACTIVE_STATUSES.has(status) : false;
  const isCancelled = status === "cancelled";

  // Item summary: first 2 names + "and N more" if more
  const itemSummary = useMemo(() => {
    if (!order) return null;
    const names = order.items.map((it) => `${it.quantity}× ${it.name}`);
    if (names.length <= 2) return names.join(" · ");
    return `${names.slice(0, 2).join(" · ")} +${names.length - 2} more`;
  }, [order]);

  return (
    <li
      className={cn(
        "rounded-3xl border border-border bg-card p-4 transition-colors",
        isCancelled && "opacity-65"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-mono font-semibold text-muted-foreground">
            <span>{entry.id}</span>
            {entry.tableId && (
              <>
                <span aria-hidden>·</span>
                <span>Table {entry.tableId}</span>
              </>
            )}
          </p>
          <p className="mt-1 text-base font-bold leading-tight">
            {formatPrice(entry.total)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatRelative(entry.createdAt, now)}
          </p>
        </div>

        {loading ? (
          <Skeleton className="h-6 w-20 rounded-full" />
        ) : missing ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <AlertCircle className="h-3 w-3" strokeWidth={2.4} />
            Removed
          </span>
        ) : status ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
              STATUS_PILL[status]
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={2.4} />
            {STATUS_LABEL[status]}
          </span>
        ) : null}
      </div>

      {itemSummary && (
        <p className="mt-3 truncate text-xs text-foreground/80">
          {itemSummary}
        </p>
      )}

      {!loading && !missing && order && (
        <div className="mt-3 flex items-center gap-2">
          {isActive && (
            <button
              type="button"
              onClick={() => onView(order)}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Clock className="h-3.5 w-3.5" strokeWidth={2.4} />
              Track order
            </button>
          )}
          <button
            type="button"
            onClick={() => onReorder(order)}
            disabled={isCancelled}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
              !isActive && "bg-foreground text-background hover:bg-foreground/95 hover:text-background border-transparent"
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.4} />
            Reorder
          </button>
        </div>
      )}
    </li>
  );
}

function Empty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <HistoryIcon className="h-6 w-6 text-muted-foreground" strokeWidth={1.8} />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-bold">No past orders</h3>
        <p className="text-sm text-muted-foreground">
          Your previous orders will show up here so you can quickly reorder.
        </p>
      </div>
      <button
        type="button"
        onClick={onBrowse}
        className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
      >
        <UtensilsCrossed className="h-4 w-4" strokeWidth={2.4} />
        Browse menu
      </button>
    </div>
  );
}
