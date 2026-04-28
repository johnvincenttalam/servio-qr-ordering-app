import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/utils";

interface CartFooterProps {
  total: number;
  itemCount: number;
}

export function CartFooter({ total, itemCount }: CartFooterProps) {
  const navigate = useNavigate();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-md sm:max-w-lg lg:max-w-xl border-t bg-background p-4">
        <Button
          className="w-full bg-emerald py-6 text-base font-semibold hover:bg-emerald/90"
          onClick={() => navigate("/checkout")}
        >
          Proceed to Checkout - {formatPrice(total)}
        </Button>
      </div>
    </div>
  );
}
