import {
  Activity,
  Receipt,
  Wallet,
  Timer,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useDashboardStats, type RecentOrder } from "../useDashboardStats";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils";

export default function DashboardPage() {
  const { user, role } = useAuth();
  const { stats, recent, isLoading } = useDashboardStats();

  return (
    <div className="space-y-8">
      <Header email={user?.email} role={role} />

      <Stats
        isLoading={isLoading}
        active={stats.activeCount}
        todayCount={stats.todayCount}
        todayRevenue={stats.todayRevenue}
        avgPrepMinutes={stats.avgPrepMinutes}
      />

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
  active,
  todayCount,
  todayRevenue,
  avgPrepMinutes,
}: {
  isLoading: boolean;
  active: number;
  todayCount: number;
  todayRevenue: number;
  avgPrepMinutes: number | null;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Activity}
        label="Active orders"
        value={isLoading ? "—" : String(active)}
        subtext={
          active === 0 ? "All caught up" : "In the kitchen right now"
        }
        emphasis={active > 0}
      />
      <StatCard
        icon={Receipt}
        label="Today's orders"
        value={isLoading ? "—" : String(todayCount)}
        subtext="Since midnight"
      />
      <StatCard
        icon={Wallet}
        label="Today's revenue"
        value={isLoading ? "—" : formatPrice(todayRevenue)}
        subtext="Gross sales"
      />
      <StatCard
        icon={Timer}
        label="Avg prep time"
        value={
          isLoading
            ? "—"
            : avgPrepMinutes === null
            ? "—"
            : `${avgPrepMinutes.toFixed(1)} min`
        }
        subtext={avgPrepMinutes === null ? "No completed orders" : "Order to ready"}
      />
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  emphasis = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  subtext: string;
  emphasis?: boolean;
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
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>
    </div>
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

const STATUS_LABEL: Record<RecentOrder["status"], string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

const STATUS_PILL: Record<RecentOrder["status"], string> = {
  pending: "bg-warning text-foreground",
  preparing: "bg-info text-white",
  ready: "bg-success text-white",
  served: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive text-white",
};

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
          {formatRelative(order.createdAt)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold tabular-nums">
          {formatPrice(order.total)}
        </p>
        <span
          className={cn(
            "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            STATUS_PILL[order.status]
          )}
        >
          {STATUS_LABEL[order.status]}
        </span>
      </div>
    </div>
  );
}

function formatRelative(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
