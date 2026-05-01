import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  History as HistoryIcon,
  ShoppingCart,
  Utensils,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { getOrderHistory } from "@/lib/orderHistory";
import { WaiterCallSheet } from "@/components/common/WaiterCallSheet";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const tableId = useAppStore((s) => s.tableId);
  const currentOrderId = useAppStore((s) => s.currentOrderId);
  const itemCount = useAppStore((s) => s.getCartItemCount());
  const [waiterOpen, setWaiterOpen] = useState(false);

  // History button only renders when there's at least one past order
  // on this device — keeps the header uncluttered for first-time
  // visitors who'd just see an empty page if they tapped it. The
  // re-check on pathname covers the moment right after checkout, when
  // the user navigates from /checkout to /order-status and the order
  // was just recorded.
  const [hasHistory, setHasHistory] = useState(false);
  useEffect(() => {
    setHasHistory(getOrderHistory().length > 0);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card text-foreground">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3 sm:max-w-2xl lg:max-w-3xl">
        <Link to="/menu" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background">
            <Utensils className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-none tracking-tight">
              SERVIO
            </p>
            {tableId && (
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Table {tableId}
              </p>
            )}
          </div>
        </Link>

        <div className="flex shrink-0 items-center -mr-1">
          {/* Bell only shows once we have a tableId — without one, the
              call request would have nothing to associate with. The
              "Request bill" choice surfaces only when an active order
              exists; otherwise it's a service-only call. */}
          {tableId && (
            <button
              onClick={() => setWaiterOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
              aria-label="Call waiter"
              title="Call waiter"
            >
              <Bell className="h-5 w-5" strokeWidth={2.2} />
            </button>
          )}
          {hasHistory && (
            <button
              onClick={() => navigate("/history")}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
              aria-label="Past orders"
              title="Past orders"
            >
              <HistoryIcon className="h-5 w-5" strokeWidth={2.2} />
            </button>
          )}
          <button
            onClick={() => navigate("/cart")}
            data-fly-target="cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
            aria-label={`Cart with ${itemCount} items`}
          >
            <ShoppingCart className="h-5 w-5" strokeWidth={2.2} />
            {itemCount > 0 && (
              <span
                key={itemCount}
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-bold text-background animate-pop-in"
              >
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <WaiterCallSheet
        open={waiterOpen}
        onClose={() => setWaiterOpen(false)}
        tableId={tableId}
        orderId={currentOrderId}
        showBill={Boolean(currentOrderId)}
      />
    </header>
  );
}
