import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { History as HistoryIcon, ShoppingCart, Utensils } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { getOrderHistory } from "@/lib/orderHistory";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const tableId = useAppStore((s) => s.tableId);
  const itemCount = useAppStore((s) => s.getCartItemCount());

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
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3 sm:max-w-lg lg:max-w-xl">
        <Link to="/menu" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-foreground text-background">
            <Utensils className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="text-lg font-bold tracking-tight">SERVIO</span>
        </Link>

        <div className="flex items-center gap-1">
          {tableId && (
            <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">
              Table {tableId}
            </span>
          )}
          {hasHistory && (
            <button
              onClick={() => navigate("/history")}
              className="flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
              aria-label="Past orders"
              title="Past orders"
            >
              <HistoryIcon className="h-5 w-5" strokeWidth={2.2} />
            </button>
          )}
          <button
            onClick={() => navigate("/cart")}
            data-fly-target="cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
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
    </header>
  );
}
