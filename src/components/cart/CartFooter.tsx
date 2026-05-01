import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { formatPrice } from "@/utils";

interface CartFooterProps {
  total: number;
  itemCount: number;
}

export function CartFooter({ total, itemCount }: CartFooterProps) {
  const navigate = useNavigate();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="mx-auto max-w-md sm:max-w-2xl lg:max-w-3xl border-t border-border bg-background p-4 pointer-events-auto">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-base font-medium text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
          <span className="text-xl font-bold text-foreground">{formatPrice(total)}</span>
        </div>
        <button
          onClick={() => navigate("/checkout")}
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 font-semibold text-background transition-transform duration-200 hover:scale-[1.01] active:scale-[0.98]"
        >
          Proceed to Checkout
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
