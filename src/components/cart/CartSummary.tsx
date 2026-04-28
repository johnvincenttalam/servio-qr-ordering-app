import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/utils";
import type { CartItem } from "@/types";

interface CartSummaryProps {
  items: CartItem[];
  total: number;
}

export function CartSummary({ items, total }: CartSummaryProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {item.name} x{item.quantity}
          </span>
          <span className="font-medium">
            {formatPrice(item.price * item.quantity)}
          </span>
        </div>
      ))}
      <Separator className="my-2" />
      <div className="flex justify-between text-base font-bold">
        <span>Total</span>
        <span className="text-primary">{formatPrice(total)}</span>
      </div>
    </div>
  );
}
