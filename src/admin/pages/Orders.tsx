import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ListOrdered, MessageSquare, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice, formatRelative } from "@/utils";
import { WaiterCallsBanner } from "@/components/common/WaiterCallsBanner";
import {
  useAdminOrders,
  type AdminOrder,
  type AdminOrderStatus,
} from "../useAdminOrders";
import { HeldOrdersBanner } from "../components/HeldOrdersBanner";
import {
  ADMIN_STATUS_ACTIVE,
  ADMIN_STATUS_ICON,
  ADMIN_STATUS_LABEL,
  ADMIN_STATUS_PILL,
} from "../orderStatus";
import { AdminEmptyState } from "../components/AdminEmptyState";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { OrderDetail } from "./OrderDetail";

type StatusFilter = "all" | "active" | AdminOrderStatus;
type DateRange = "today" | "7d" | "30d" | "all";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resolve a DateRange to a "show orders newer than this timestamp" cutoff.
 * "today" snaps to local-midnight so the boundary doesn't shift mid-day;
 * the rolling ranges are exact ms windows from now; "all" disables the
 * filter entirely (returns 0 → no order is older than the epoch).
 */
function rangeStartTimestamp(range: DateRange, now: number): number {
  if (range === "all") return 0;
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (range === "7d") return now - 7 * DAY_MS;
  if (range === "30d") return now - 30 * DAY_MS;
  return 0;
}

export default function OrdersPage() {
  const {
    orders,
    heldOrders,
    isLoading,
    error,
    setStatus,
    approveHeld,
    rejectHeld,
    blockDeviceById,
    compItem,
    uncompItem,
    removeItem,
  } = useAdminOrders();
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // "/" to focus the in-page search. ⌘K is reserved for the global
  // command palette. Skipped while the user is already typing in an
  // input/textarea so it doesn't hijack a literal slash.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Tick "X min ago" labels every 30s
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  // Counts respect the date range so the status chips read accurately —
  // tapping "Active 3" should land you on three orders, not three minus
  // however many fall outside the selected window.
  const counts = useMemo(() => {
    const cutoff = rangeStartTimestamp(dateRange, now);
    const out: Record<StatusFilter, number> = {
      all: 0,
      active: 0,
      pending: 0,
      preparing: 0,
      ready: 0,
      served: 0,
      cancelled: 0,
    };
    for (const o of orders) {
      if (o.createdAt < cutoff) continue;
      out.all++;
      out[o.status]++;
      if (ADMIN_STATUS_ACTIVE.includes(o.status as AdminOrderStatus)) {
        out.active++;
      }
    }
    return out;
  }, [orders, dateRange, now]);

  const rangeStart = useMemo(
    () => rangeStartTimestamp(dateRange, now),
    [dateRange, now]
  );

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (o.createdAt < rangeStart) return false;
      if (filter === "active" && !ADMIN_STATUS_ACTIVE.includes(o.status)) {
        return false;
      }
      if (
        filter !== "all" &&
        filter !== "active" &&
        o.status !== filter
      ) {
        return false;
      }
      if (query) {
        return (
          o.id.toLowerCase().includes(query) ||
          o.tableId.toLowerCase().includes(query) ||
          (o.customerName ?? "").toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [orders, filter, rangeStart, searchQuery]);

  const isFiltering =
    filter !== "active" ||
    dateRange !== "today" ||
    searchQuery.trim().length > 0;

  const clearFilters = () => {
    setFilter("active");
    setDateRange("today");
    setSearchQuery("");
  };

  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Orders
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.all} {counts.all === 1 ? "order" : "orders"}
            {counts.active > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-foreground">
                  {counts.active}
                </span>{" "}
                active
              </>
            )}
          </p>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <HeldOrdersBanner
        orders={heldOrders}
        onApprove={approveHeld}
        onReject={rejectHeld}
        onBlockDevice={blockDeviceById}
      />

      <WaiterCallsBanner emphasize="bill" />

      <SearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
      />

      {/* Filters row: status chips scroll horizontally inside the left
          flex slot while the date-range toggle stays anchored right.
          Mirrors the MenuManager pattern so the toggle never scrolls
          off the viewport on mobile. */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 pr-3 [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)]">
          <StatusFilters filter={filter} onChange={setFilter} counts={counts} />
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyMessage isFiltering={isFiltering} onClear={clearFilters} />
      ) : (
        <>
          {/* Desktop: dense scannable table — operators sort/compare across orders */}
          <div className="hidden md:block">
            <OrdersTable
              orders={filtered}
              now={now}
              onSelect={setSelectedId}
            />
          </div>

          {/* Mobile: card list — touch-friendly, easier to read on narrow screens */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                now={now}
                onClick={() => setSelectedId(order.id)}
              />
            ))}
          </ul>
        </>
      )}

      <OrderDetail
        open={selected !== null}
        order={selected}
        onClose={() => setSelectedId(null)}
        onSetStatus={setStatus}
        onApproveHeld={approveHeld}
        onBlockDevice={blockDeviceById}
        onCompItem={compItem}
        onUncompItem={uncompItem}
        onRemoveItem={removeItem}
      />
    </div>
  );
}

function SearchBar({
  searchQuery,
  onSearchChange,
  searchInputRef,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2.2}
      />
      <input
        ref={searchInputRef}
        type="search"
        inputMode="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by order id, table, or customer…"
        aria-label="Search orders"
        className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-10 text-sm font-medium text-foreground placeholder:text-muted-foreground transition-colors focus:border-foreground/40 focus:outline-none"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

function StatusFilters({
  filter,
  onChange,
  counts,
}: {
  filter: StatusFilter;
  onChange: (filter: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}) {
  const tabs: { id: StatusFilter; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "preparing", label: "Preparing" },
    { id: "ready", label: "Ready" },
    { id: "served", label: "Served" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const count = counts[tab.id];
        const isActive = filter === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={isActive}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors active:scale-95",
              isActive
                ? "bg-foreground text-background"
                : "bg-card text-foreground/70 border border-border hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums",
                isActive ? "bg-background/15" : "bg-muted"
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const DATE_RANGE_OPTIONS: readonly { id: DateRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "all", label: "All" },
];

function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      options={DATE_RANGE_OPTIONS}
      ariaLabel="Date range"
    />
  );
}

function OrderRow({
  order,
  now,
  onClick,
}: {
  order: AdminOrder;
  now: number;
  onClick: () => void;
}) {
  const Icon = ADMIN_STATUS_ICON[order.status];
  const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);
  const isTerminal =
    order.status === "served" || order.status === "cancelled";

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-3xl border border-border bg-card p-3 text-left transition-colors hover:border-foreground/20 active:scale-[0.998] focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2",
          isTerminal && "opacity-70"
        )}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
          <span className="text-base font-extrabold tracking-tight">
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
            <span className="w-20 shrink-0 text-right text-base font-semibold tabular-nums">
              {formatPrice(order.total)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span aria-hidden>·</span>
            <span className="truncate">{formatRelative(order.createdAt, now)}</span>
            {order.notes && (
              <>
                <span aria-hidden>·</span>
                <span
                  className="truncate font-medium text-foreground/70"
                  title={order.notes}
                >
                  Note: {order.notes}
                </span>
              </>
            )}
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
            ADMIN_STATUS_PILL[order.status]
          )}
        >
          <Icon className="h-3 w-3" strokeWidth={2.4} />
          {ADMIN_STATUS_LABEL[order.status]}
        </span>
      </button>
    </li>
  );
}

function OrdersTable({
  orders,
  now,
  onSelect,
}: {
  orders: AdminOrder[];
  now: number;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5 w-[64px]">Table</th>
            <th className="px-4 py-2.5">Order</th>
            <th className="px-4 py-2.5 text-right w-[72px]">Items</th>
            <th className="px-4 py-2.5 w-[100px]">Age</th>
            <th className="px-4 py-2.5 text-right w-[110px]">Total</th>
            <th className="px-4 py-2.5 w-[140px]">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <OrderTableRow
              key={order.id}
              order={order}
              now={now}
              onSelect={() => onSelect(order.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderTableRow({
  order,
  now,
  onSelect,
}: {
  order: AdminOrder;
  now: number;
  onSelect: () => void;
}) {
  const Icon = ADMIN_STATUS_ICON[order.status];
  const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);
  const isTerminal =
    order.status === "served" || order.status === "cancelled";

  return (
    <tr
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/40 focus:bg-muted/40 focus:outline-none",
        isTerminal && "opacity-65"
      )}
    >
      <td className="px-4 py-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-sm font-extrabold tracking-tight">
          {order.tableId}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 truncate font-semibold leading-tight">
            <span className="truncate">{order.customerName ?? "Guest"}</span>
            {order.notes && (
              <span title={order.notes} aria-label={`Note: ${order.notes}`}>
                <MessageSquare
                  className="h-3 w-3 shrink-0 text-muted-foreground"
                  strokeWidth={2.4}
                />
              </span>
            )}
          </span>
          <span className="font-mono text-[10px] font-medium text-muted-foreground">
            {order.id}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-foreground/80">
        {itemCount}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {formatRelative(order.createdAt, now)}
      </td>
      <td className="px-4 py-3 text-right text-base font-bold tabular-nums">
        {formatPrice(order.total)}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
            ADMIN_STATUS_PILL[order.status]
          )}
        >
          <Icon className="h-3 w-3" strokeWidth={2.4} />
          {ADMIN_STATUS_LABEL[order.status]}
        </span>
      </td>
    </tr>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3"
        >
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
          <div className="h-6 w-20 rounded-full bg-muted" />
        </li>
      ))}
    </ul>
  );
}

function EmptyMessage({
  isFiltering,
  onClear,
}: {
  isFiltering: boolean;
  onClear: () => void;
}) {
  if (isFiltering) {
    return (
      <AdminEmptyState
        icon={Search}
        title="No matches"
        description="Nothing matches your current filters. Clear them to see everything."
        secondaryActionLabel="Clear filters"
        onSecondaryAction={onClear}
        tone="neutral"
        compact
      />
    );
  }
  return (
    <AdminEmptyState
      icon={ListOrdered}
      title="No orders yet"
      description="When customers place orders, they'll appear here in real time."
    />
  );
}

