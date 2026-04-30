import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { User, MessageSquare, Receipt, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CartSummary } from "@/components/cart/CartSummary";
import { OrderSuccessModal } from "@/components/checkout/OrderSuccessModal";
import { useAppStore } from "@/store/useAppStore";
import { submitOrder } from "@/services/order-service";
import { formatPrice } from "@/utils";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const tableId = useAppStore((s) => s.tableId);
  const cart = useAppStore((s) => s.cart);
  const getCartTotal = useAppStore((s) => s.getCartTotal);
  const clearCart = useAppStore((s) => s.clearCart);
  const setCurrentOrderId = useAppStore((s) => s.setCurrentOrderId);

  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  if (!tableId) {
    navigate("/", { replace: true });
    return null;
  }

  if (cart.length === 0 && !placedOrderId) {
    navigate("/menu", { replace: true });
    return null;
  }

  const total = getCartTotal();

  const handlePlaceOrder = async () => {
    setIsSubmitting(true);
    try {
      const order = await submitOrder({
        tableId,
        items: cart,
        total,
        customerName: customerName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setPlacedOrderId(order.id);
    } catch {
      toast.error("Failed to place order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewOrder = () => {
    if (placedOrderId) {
      setCurrentOrderId(placedOrderId);
      clearCart();
    }
    navigate("/order-status", { replace: true });
  };

  return (
    <div className="space-y-3 pb-24">
      <h2 className="text-2xl font-bold">Checkout</h2>

      <section className="space-y-4 rounded-3xl border border-border bg-card p-4 animate-fade-up">
        <div className="space-y-2">
          <label
            htmlFor="name"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <User className="h-4 w-4 text-muted-foreground" />
            Name <span className="font-medium text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="name"
            placeholder="Enter your name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="notes"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Special Instructions{" "}
            <span className="font-medium text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="notes"
            placeholder='e.g., "No onions", "Extra spicy"'
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-xl"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 animate-fade-up">
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Order Summary</h3>
        </div>
        <CartSummary items={cart} total={total} />
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="mx-auto max-w-md sm:max-w-lg lg:max-w-xl border-t border-border bg-background p-4 pointer-events-auto">
          <button
            onClick={handlePlaceOrder}
            disabled={isSubmitting}
            className="group flex w-full items-center justify-between rounded-full bg-foreground px-5 py-4 text-background transition-transform duration-200 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-70"
          >
            <span className="text-sm font-semibold">
              {isSubmitting ? "Placing Order..." : "Place Order"}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-base font-bold">{formatPrice(total)}</span>
              {!isSubmitting && (
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </span>
          </button>
        </div>
      </div>

      <OrderSuccessModal
        open={placedOrderId !== null}
        orderId={placedOrderId}
        onView={handleViewOrder}
      />
    </div>
  );
}
