import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/useAppStore";

export function Header() {
  const navigate = useNavigate();
  const tableId = useAppStore((s) => s.tableId);
  const getCartItemCount = useAppStore((s) => s.getCartItemCount);
  const itemCount = getCartItemCount();

  return (
    <header className="sticky top-0 z-50 border-b bg-primary px-4 py-3 text-primary-foreground">
      <div className="flex items-center justify-between">
        <Link to="/menu" className="text-xl font-bold tracking-tight">
          SERVIO
        </Link>

        <div className="flex items-center gap-3">
          {tableId && (
            <span className="rounded-md bg-primary-foreground/15 px-2 py-0.5 text-sm font-medium">
              Table {tableId}
            </span>
          )}
          <button
            onClick={() => navigate("/cart")}
            className="relative p-1"
            aria-label={`Cart with ${itemCount} items`}
          >
            <ShoppingCart className="h-6 w-6" />
            {itemCount > 0 && (
              <Badge className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald p-0 text-xs text-white">
                {itemCount}
              </Badge>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
