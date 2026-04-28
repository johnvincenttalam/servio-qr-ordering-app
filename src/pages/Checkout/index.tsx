import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CartSummary } from "@/components/cart/CartSummary";
import { useAppStore } from "@/store/useAppStore";
import { submitOrder } from "@/services/order-service";

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

  if (!tableId) {
    navigate("/", { replace: true });
    return null;
  }

  if (cart.length === 0) {
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
      setCurrentOrderId(order.id);
      clearCart();
      toast.success("Order placed successfully!");
      navigate("/order-status", { replace: true });
    } catch {
      toast.error("Failed to place order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Checkout</h2>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name (optional)
            </label>
            <Input
              id="name"
              placeholder="Enter your name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Special Instructions (optional)
            </label>
            <Textarea
              id="notes"
              placeholder='e.g., "No onions", "Extra spicy"'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold">Order Summary</h3>
          <CartSummary items={cart} total={total} />
        </CardContent>
      </Card>

      <Button
        className="w-full bg-emerald py-6 text-base font-semibold hover:bg-emerald/90"
        onClick={handlePlaceOrder}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Placing Order..." : "Place Order"}
      </Button>
    </div>
  );
}
