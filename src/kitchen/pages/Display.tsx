import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChefHat,
  LogOut,
  Utensils,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { useKitchenOrders } from "../useKitchenOrders";
import { OrderTicket } from "../components/OrderTicket";

export default function DisplayPage() {
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const { orders, isLoading, error, realtimeStatus, refetch, advance } =
    useKitchenOrders();
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
  const activeCount = orders.length;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to admin"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
            </Link>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-foreground text-background">
                <Utensils className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-sm font-bold leading-none tracking-tight">
                  Kitchen
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      realtimeOK ? "bg-foreground" : "bg-muted-foreground"
                    )}
                    aria-hidden
                    title={`Realtime: ${realtimeStatus}`}
                  />
                  {activeCount} active{" "}
                  {activeCount === 1 ? "order" : "orders"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted active:scale-95 disabled:opacity-50"
              aria-label="Refresh orders"
              title="Refresh"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  refreshing && "animate-spin"
                )}
                strokeWidth={2.2}
              />
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold leading-none">
                {user?.email}
              </p>
              {role && (
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {role}
                </p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-muted active:scale-95 disabled:opacity-50"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
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
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-3xl border border-border bg-card"
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-muted">
              <ChefHat
                className="h-9 w-9 text-muted-foreground"
                strokeWidth={1.6}
              />
            </div>
            <h2 className="text-xl font-bold">All caught up</h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              No active orders right now. New orders appear here the moment
              they&apos;re placed.
            </p>
            {!realtimeOK && (
              <p className="mt-2 max-w-sm text-xs text-muted-foreground">
                Realtime status:{" "}
                <span className="font-mono">{realtimeStatus}</span>. Use the
                refresh button if new orders don&apos;t appear automatically.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {orders.map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                onAdvance={advance}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
