import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChefHat,
  Utensils,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WaiterCallsBanner } from "@/components/common/WaiterCallsBanner";
import { playChime, primeChime } from "@/lib/chime";
import { useKitchenOrders, type KitchenOrder } from "../useKitchenOrders";
import { OrderTicket } from "../components/OrderTicket";
import type { OrderStatus } from "@/types";

const SOUND_PREF_KEY = "servio.kitchen.sound";

/** Status-coloured chip class for the column count badge. */
const COUNT_PILL: Record<OrderStatus, string> = {
  pending: "bg-warning text-foreground",
  preparing: "bg-info text-white",
  ready: "bg-success text-white",
};

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
  const { orders, isLoading, error, refetch, advance } = useKitchenOrders();
  const [refreshing, setRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem(SOUND_PREF_KEY) === "on";
    } catch {
      return false;
    }
  });

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

  // Chime when the Pending count strictly rises — that's a new customer
  // order arriving via realtime, not a staff-initiated transition. The
  // ref starts at the current count so we don't fire on initial mount.
  const pendingCount = grouped.pending.length;
  const prevPendingCount = useRef(pendingCount);
  useEffect(() => {
    if (pendingCount > prevPendingCount.current && soundEnabled) {
      playChime();
    }
    prevPendingCount.current = pendingCount;
  }, [pendingCount, soundEnabled]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem(SOUND_PREF_KEY, next ? "on" : "off");
    } catch {
      // private mode / disabled storage — pref still works for the session
    }
    if (next) {
      // The click gesture unlocks the audio context; play a confirmation
      // chime so the user knows it's working.
      primeChime();
      playChime();
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

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto grid max-w-[1600px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
          <Link
            to="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Back to admin"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          </Link>

          <div className="flex items-center justify-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background">
              <Utensils className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <h1 className="text-2xl font-extrabold leading-none tracking-tight">
              Kitchen
            </h1>
          </div>

          <div className="flex items-center justify-end gap-2">
            <HeaderClock />
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundEnabled}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border transition-colors active:scale-95",
                soundEnabled
                  ? "border-success/40 bg-success/10 text-foreground hover:bg-success/15"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={
                soundEnabled
                  ? "Sound on — click to mute new-order chime"
                  : "Sound off — click to enable new-order chime"
              }
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5" strokeWidth={2.2} />
              ) : (
                <VolumeX className="h-3.5 w-3.5" strokeWidth={2.2} />
              )}
            </button>
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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <WaiterCallsBanner emphasize="service" />

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
                status={col.id}
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

function HeaderClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    // Snap to the next minute boundary so the clock ticks at :00 exactly,
    // then keep updating once per minute. Saves a render every second
    // we'd otherwise spend on idle.
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    const initial = window.setTimeout(() => {
      setTime(new Date());
      const interval = window.setInterval(() => setTime(new Date()), 60_000);
      // Cleanup chain: when the component unmounts the closure clears
      // the interval; the initial timeout has already fired by then.
      return () => window.clearInterval(interval);
    }, msToNextMinute);
    return () => window.clearTimeout(initial);
  }, []);

  const formatted = time.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <span className="text-lg font-bold tabular-nums leading-none">
      {formatted}
    </span>
  );
}

function Column({
  status,
  label,
  icon: Icon,
  orders,
  onAdvance,
}: {
  status: OrderStatus;
  label: string;
  icon: LucideIcon;
  orders: KitchenOrder[];
  onAdvance: (id: string, current: OrderStatus) => void;
}) {
  const count = orders.length;
  const prevCount = useRef(count);
  // `bumpKey` increments whenever the count strictly *rises*. Using it as
  // a React key on the count node forces a remount, which restarts the
  // CSS animation on every new arrival — even back-to-back ones.
  const [bumpKey, setBumpKey] = useState(0);

  useEffect(() => {
    if (count > prevCount.current) {
      setBumpKey((k) => k + 1);
    }
    prevCount.current = count;
  }, [count]);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-4 w-4" strokeWidth={2.2} />
          {label}
        </h2>
        <span
          key={bumpKey}
          aria-label={`${count} ${label.toLowerCase()} order${count === 1 ? "" : "s"}`}
          className={cn(
            "inline-flex h-7 min-w-[2rem] items-center justify-center rounded-full px-2 text-sm font-extrabold tabular-nums shadow-sm",
            COUNT_PILL[status],
            bumpKey > 0 && "animate-count-bump"
          )}
        >
          {count}
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
