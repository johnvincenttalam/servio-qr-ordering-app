import {
  Activity,
  Receipt,
  Wallet,
  Timer,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  CreditCard,
  Star,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useDashboardStats, type RecentOrder } from "../useDashboardStats";
import { ADMIN_STATUS_LABEL, ADMIN_STATUS_PILL } from "../orderStatus";
import { cn } from "@/lib/utils";
import { formatPrice, formatRelative } from "@/utils";

export default function DashboardPage() {
  const { user, role } = useAuth();
  const { stats, recent, isLoading } = useDashboardStats();

  return (
    <div className="space-y-8">
      <Header email={user?.email} role={role} />

      <Stats isLoading={isLoading} stats={stats} />

      <RecentActivity orders={recent} isLoading={isLoading} />
    </div>
  );
}

function Header({
  email,
  role,
}: {
  email: string | undefined;
  role: string | null;
}) {
  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Dashboard
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {email}{" "}
        {role && (
          <>
            · <span className="font-semibold text-foreground">{role}</span>
          </>
        )}
      </p>
    </header>
  );
}

function Stats({
  isLoading,
  stats,
}: {
  isLoading: boolean;
  stats: ReturnType<typeof useDashboardStats>["stats"];
}) {
  const ordersDelta = computeDelta(stats.todayCount, stats.yesterdayCount);
  const revenueDelta = computeDelta(stats.todayRevenue, stats.yesterdayRevenue);

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        icon={Activity}
        label="Active orders"
        value={isLoading ? "—" : String(stats.activeCount)}
        subtext={
          stats.activeCount === 0
            ? "All caught up"
            : "In the kitchen right now"
        }
        emphasis={stats.activeCount > 0}
      />
      <StatCard
        icon={Receipt}
        label="Today's orders"
        value={isLoading ? "—" : String(stats.todayCount)}
        delta={isLoading ? undefined : ordersDelta}
        subtext="vs yesterday"
      />
      <StatCard
        icon={Wallet}
        label="Today's revenue"
        value={isLoading ? "—" : formatPrice(stats.todayRevenue)}
        delta={isLoading ? undefined : revenueDelta}
        subtext="vs yesterday"
      />
      <StatCard
        icon={CreditCard}
        label="Avg ticket"
        value={
          isLoading
            ? "—"
            : stats.avgTicket === null
            ? "—"
            : formatPrice(stats.avgTicket)
        }
        subtext={stats.avgTicket === null ? "No orders yet" : "Per order today"}
      />
      <StatCard
        icon={Star}
        label="Top seller"
        value={
          isLoading || !stats.topItem
            ? "—"
            : stats.topItem.name
        }
        subtext={
          isLoading || !stats.topItem
            ? "No items sold yet"
            : `${stats.topItem.quantity} sold today`
        }
        compact
      />
      <StatCard
        icon={Timer}
        label="Avg prep time"
        value={
          isLoading
            ? "—"
            : stats.avgPrepMinutes === null
            ? "—"
            : `${stats.avgPrepMinutes.toFixed(1)} min`
        }
        subtext={
          stats.avgPrepMinutes === null
            ? "No completed orders"
            : "Order to ready"
        }
      />
    </section>
  );
}

interface Delta {
  /** percentage change vs previous period; null when previous was zero. */
  pct: number | null;
  direction: "up" | "down" | "flat";
}

function computeDelta(current: number, previous: number): Delta {
  if (previous === 0) {
    return { pct: null, direction: current > 0 ? "up" : "flat" };
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return { pct: 0, direction: "flat" };
  return { pct, direction: pct > 0 ? "up" : "down" };
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  emphasis = false,
  compact = false,
  delta,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  subtext: string;
  emphasis?: boolean;
  compact?: boolean;
  delta?: Delta;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border bg-card p-4",
        emphasis ? "border-foreground" : "border-border"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-xl",
            emphasis ? "bg-foreground text-background" : "bg-muted text-foreground/80"
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      </div>
      <p
        className={cn(
          "mt-3 truncate font-bold tracking-tight",
          compact ? "text-xl" : "text-3xl"
        )}
        title={compact ? value : undefined}
      >
        {value}
      </p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {delta && <DeltaPill delta={delta} />}
        <p className="truncate text-xs text-muted-foreground">{subtext}</p>
      </div>
    </div>
  );
}

function DeltaPill({ delta }: { delta: Delta }) {
  const Icon =
    delta.direction === "up"
      ? TrendingUp
      : delta.direction === "down"
      ? TrendingDown
      : Minus;
  const tone =
    delta.direction === "up"
      ? "text-success"
      : delta.direction === "down"
      ? "text-destructive"
      : "text-muted-foreground";
  const text =
    delta.pct === null
      ? "new"
      : delta.pct === 0
      ? "—"
      : `${delta.pct > 0 ? "+" : ""}${delta.pct.toFixed(0)}%`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold tabular-nums", tone)}>
      <Icon className="h-3 w-3" strokeWidth={2.4} />
      {text}
    </span>
  );
}

function RecentActivity({
  orders,
  isLoading,
}: {
  orders: RecentOrder[];
  isLoading: boolean;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Recent orders</h2>
        <span className="text-xs text-muted-foreground">Last 5</span>
      </header>
      <div className="mt-3 divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="h-8 w-12 rounded-md bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </div>
            </div>
          ))
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No orders yet today.
          </p>
        ) : (
          orders.map((order) => <RecentOrderRow key={order.id} order={order} />)
        )}
      </div>
    </section>
  );
}

function RecentOrderRow({ order }: { order: RecentOrder }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-9 min-w-[3rem] items-center justify-center rounded-xl border border-border bg-muted px-2">
        <span className="text-sm font-extrabold tracking-tight">
          {order.tableId}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="truncate">
            {order.customerName ?? "Guest"}
          </span>
          <span className="font-mono text-[10px] font-medium text-muted-foreground">
            {order.id}
          </span>
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" strokeWidth={2.2} />
          {formatRelative(order.createdAt, Date.now())}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold tabular-nums">
          {formatPrice(order.total)}
        </p>
        <span
          className={cn(
            "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            ADMIN_STATUS_PILL[order.status]
          )}
        >
          {ADMIN_STATUS_LABEL[order.status]}
        </span>
      </div>
    </div>
  );
}

