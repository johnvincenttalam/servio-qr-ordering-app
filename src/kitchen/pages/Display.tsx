import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChefHat,
  LogOut,
  Utensils,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { useKitchenOrders, type KitchenOrder } from "../useKitchenOrders";
import { OrderTicket } from "../components/OrderTicket";
import type { OrderStatus } from "@/types";

const STATUS_COLUMNS: {
  id: OrderStatus;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "pending", label: "Pending", icon: Clock },
  { id: "preparing", label: "Preparing", icon: ChefHat },
  { id: "ready", label: "Ready", icon: CheckCircle2 },
];

export default function DisplayPage() {
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const { orders, isLoading, error, realtimeStatus, refetch, advance } =
    useKitchenOrders();
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const grouped = useMemo(() => {
    const groups: Record<OrderStatus, KitchenOrder[]> = {
      pending: [],
      preparing: [],
      ready: [],
    };
    for (const order of orders) {
      groups[order.status].push(order);
    }
    return groups;
  }, [orders]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate("/admin/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const realtimeOK = realtimeStatus === "SUBSCRIBED";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to admin"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
            </Link>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-foreground text-background">
                <Utensils className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-sm font-bold leading-none tracking-tight">
                  Kitchen
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span
                    className={cn(
                      "relative flex h-2 w-2 items-center justify-center"
                    )}
                    title={`Realtime: ${realtimeStatus}`}
                  >
                    {realtimeOK && (
                      <span className="absolute h-full w-full animate-ping rounded-full bg-foreground/40" />
                    )}
                    <span
                      className={cn(
                        "relative h-1.5 w-1.5 rounded-full",
                        realtimeOK ? "bg-foreground" : "bg-muted-foreground"
                      )}
                    />
                  </span>
                  {realtimeOK ? "Live" : realtimeStatus.toLowerCase()}
                </p>
              </div>
            </div>
          </div>

          <Tally
            pending={grouped.pending.length}
            preparing={grouped.preparing.length}
            ready={grouped.ready.length}
          />

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted active:scale-95 disabled:opacity-50"
              aria-label="Refresh orders"
              title="Refresh"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
                strokeWidth={2.2}
              />
            </button>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background"
              title={`${user?.email ?? "Signed in"}${role ? ` · ${role}` : ""}`}
              aria-label={`Signed in as ${user?.email}`}
            >
              {(user?.email?.[0] ?? "?").toUpperCase()}
            </span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted active:scale-95 disabled:opacity-50"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Couldn&apos;t load orders</p>
              <p className="text-xs">{error}</p>
            </div>
          </div>
        )}

        {isLoading && orders.length === 0 ? (
          <KitchenSkeleton />
        ) : orders.length === 0 ? (
          <EmptyKitchen />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {STATUS_COLUMNS.map((col) => (
              <Column
                key={col.id}
                label={col.label}
                icon={col.icon}
                orders={grouped[col.id]}
                onAdvance={advance}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Tally({
  pending,
  preparing,
  ready,
}: {
  pending: number;
  preparing: number;
  ready: number;
}) {
  return (
    <div className="hidden items-center gap-1.5 md:flex">
      <TallyPill label="Pending" count={pending} tone="warning" />
      <TallyPill label="Preparing" count={preparing} tone="info" />
      <TallyPill label="Ready" count={ready} tone="success" />
    </div>
  );
}

function TallyPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "warning" | "info" | "success";
}) {
  const toneClasses = {
    warning: "bg-warning text-foreground",
    info: "bg-info text-white",
    success: "bg-success text-white",
  } as const;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5",
        toneClasses[tone]
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider">
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums">{count}</span>
    </div>
  );
}

function Column({
  label,
  icon: Icon,
  orders,
  onAdvance,
}: {
  label: string;
  icon: LucideIcon;
  orders: KitchenOrder[];
  onAdvance: (id: string, current: OrderStatus) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Icon className="h-4 w-4" strokeWidth={2.2} />
          {label}
        </h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/70">
          {orders.length}
        </span>
      </header>
      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border px-4 py-12 text-center text-xs text-muted-foreground">
            None
          </div>
        ) : (
          orders.map((order) => (
            <OrderTicket
              key={order.id}
              order={order}
              onAdvance={onAdvance}
            />
          ))
        )}
      </div>
    </section>
  );
}

function KitchenSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, c) => (
        <div key={c} className="space-y-3">
          <div className="h-5 w-24 rounded bg-muted" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-3xl border border-border bg-card"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyKitchen() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-muted">
        <ChefHat
          className="h-9 w-9 text-muted-foreground"
          strokeWidth={1.6}
        />
      </div>
      <h2 className="text-xl font-bold">All caught up</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        No active orders right now. New orders appear here the moment they&apos;re
        placed.
      </p>
    </div>
  );
}
