import { formatPrice } from "@/utils";
import type { CartItem } from "@/types";

interface CartSummaryProps {
  items: CartItem[];
  total: number;
}

export function CartSummary({ items, total }: CartSummaryProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const selectionLabel =
          item.selections.length > 0
            ? item.selections.map((s) => s.choiceName).join(", ")
            : null;
        return (
          <div key={item.lineId} className="flex justify-between gap-2 text-sm">
            <span className="min-w-0 flex-1 text-muted-foreground">
              <span className="block truncate text-foreground">
                {item.name}
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  ×{item.quantity}
                </span>
              </span>
              {selectionLabel && (
                <span className="block truncate text-xs">
                  {selectionLabel}
                </span>
              )}
            </span>
            <span className="font-medium text-foreground">
              {formatPrice(item.unitPrice * item.quantity)}
            </span>
          </div>
        );
      })}
      <div className="my-3 border-t border-dashed border-border" />
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">Total</span>
        <span className="text-lg font-bold text-foreground">
          {formatPrice(total)}
        </span>
      </div>
    </div>
  );
}
