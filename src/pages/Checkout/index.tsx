import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, User, MessageSquare, Receipt, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CartSummary } from "@/components/cart/CartSummary";
import { OrderSuccessModal } from "@/components/checkout/OrderSuccessModal";
import { useAppStore } from "@/store/useAppStore";
import { submitOrder } from "@/services/orders";
import { getLastCustomerName, recordOrder } from "@/lib/orderHistory";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";
import { formatPrice } from "@/utils";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const tableId = useAppStore((s) => s.tableId);
  const cart = useAppStore((s) => s.cart);
  const getCartTotal = useAppStore((s) => s.getCartTotal);
  const clearCart = useAppStore((s) => s.clearCart);
  const setCurrentOrderId = useAppStore((s) => s.setCurrentOrderId);

  const { settings } = useRestaurantSettings();

  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  const nameRequired = settings.requireCustomerName;
  const closed = !settings.openForOrders;
  const nameMissing = nameRequired && customerName.trim().length === 0;
  const canSubmit = !isSubmitting && !closed && !nameMissing;

  // Pre-fill the name from the most recent past order on this device.
  // Returning customers don't have to retype it on every visit.
  useEffect(() => {
    const last = getLastCustomerName();
    if (last) setCustomerName(last);
  }, []);

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
    if (closed) {
      toast.error("We're not taking orders right now.");
      return;
    }
    if (nameMissing) {
      toast.error("Please enter your name to continue.");
      return;
    }
    setIsSubmitting(true);
    try {
      const order = await submitOrder({
        tableId,
        items: cart,
        total,
        customerName: customerName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      // Record on this device so the customer can see / reorder it
      // later from /history. Failures are swallowed inside the helper —
      // recording is best-effort and shouldn't block checkout.
      recordOrder({
        id: order.id,
        total: order.total,
        createdAt: order.createdAt,
        customerName: order.customerName,
        tableId: order.tableId,
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
            Name{" "}
            <span className="font-medium text-muted-foreground">
              {nameRequired ? "(required)" : "(optional)"}
            </span>
          </label>
          <Input
            id="name"
            placeholder="Enter your name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required={nameRequired}
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
        <div className="mx-auto max-w-md sm:max-w-2xl lg:max-w-3xl border-t border-border bg-background p-4 pointer-events-auto">
          {closed && (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-3 py-1.5 text-xs font-semibold text-foreground">
              <Lock className="h-3 w-3" strokeWidth={2.4} />
              We&apos;re not taking orders right now
            </p>
          )}
          <button
            onClick={handlePlaceOrder}
            disabled={!canSubmit}
            className="group flex w-full items-center justify-between rounded-full bg-foreground px-5 py-4 text-background transition-transform duration-200 hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            <span className="text-sm font-semibold">
              {closed
                ? "Closed"
                : nameMissing
                ? "Add your name to continue"
                : isSubmitting
                ? "Placing Order..."
                : "Place Order"}
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
