import { Trash2, Minus, Plus } from "lucide-react";
import { formatPrice } from "@/utils";
import type { CartItem } from "@/types";

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
}

export function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: CartItemRowProps) {
  const lineTotal = item.unitPrice * item.quantity;
  const isLast = item.quantity <= 1;

  const handleDecrement = () => {
    if (isLast) {
      onRemove(item.lineId);
    } else {
      onUpdateQuantity(item.lineId, item.quantity - 1);
    }
  };

  const selectionLabel =
    item.selections.length > 0
      ? item.selections.map((s) => s.choiceName).join(" · ")
      : null;

  return (
    <div className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3 animate-fade-up">
      <img
        src={item.image}
        alt={item.name}
        className="h-16 w-16 shrink-0 rounded-2xl border border-border object-cover"
      />
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-semibold leading-tight">
          {item.name}
        </h4>
        {selectionLabel && (
          <p className="truncate text-xs text-muted-foreground">
            {selectionLabel}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {formatPrice(item.unitPrice)} each
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted p-0.5">
            <button
              onClick={handleDecrement}
              className={
                "flex h-7 w-7 items-center justify-center rounded-full border bg-card transition-all active:scale-90 " +
                (isLast
                  ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                  : "border-border text-foreground hover:bg-muted")
              }
              aria-label={isLast ? `Remove ${item.name}` : "Decrease quantity"}
            >
              {isLast ? (
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                <Minus aria-hidden="true" className="h-3.5 w-3.5" />
              )}
            </button>
            <span
              className="w-6 text-center text-sm font-semibold"
              aria-live="polite"
              aria-label={`Quantity ${item.quantity}`}
            >
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.lineId, item.quantity + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background transition-all hover:scale-110 active:scale-90"
              aria-label="Increase quantity"
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
          <span className="text-sm font-bold text-foreground">
            {formatPrice(lineTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
