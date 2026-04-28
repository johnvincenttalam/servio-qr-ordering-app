import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/common/QuantitySelector";
import { formatPrice } from "@/utils";
import type { CartItem } from "@/types";

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

export function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: CartItemRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <img
        src={item.image}
        alt={item.name}
        className="h-16 w-16 rounded-lg object-cover"
      />
      <div className="flex-1 min-w-0">
        <h4 className="truncate text-sm font-semibold">{item.name}</h4>
        <p className="text-sm font-bold text-primary">
          {formatPrice(item.price * item.quantity)}
        </p>
        <div className="mt-1">
          <QuantitySelector
            quantity={item.quantity}
            onChange={(q) => onUpdateQuantity(item.id, q)}
          />
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove ${item.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
