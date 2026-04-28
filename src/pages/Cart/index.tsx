import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/useAppStore";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { CartFooter } from "@/components/cart/CartFooter";
import { EmptyState } from "@/components/common/EmptyState";

export default function CartPage() {
  const navigate = useNavigate();
  const tableId = useAppStore((s) => s.tableId);
  const cart = useAppStore((s) => s.cart);
  const updateQuantity = useAppStore((s) => s.updateQuantity);
  const removeFromCart = useAppStore((s) => s.removeFromCart);
  const getCartTotal = useAppStore((s) => s.getCartTotal);
  const getCartItemCount = useAppStore((s) => s.getCartItemCount);

  if (!tableId) {
    navigate("/", { replace: true });
    return null;
  }

  if (cart.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Your cart is empty"
        description="Browse the menu and add some items to get started."
        actionLabel="Browse Menu"
        onAction={() => navigate("/menu")}
      />
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-bold">Your Cart</h2>
      <div className="divide-y">
        {cart.map((item) => (
          <CartItemRow
            key={item.id}
            item={item}
            onUpdateQuantity={updateQuantity}
            onRemove={removeFromCart}
          />
        ))}
      </div>
      <Separator />
      <CartFooter total={getCartTotal()} itemCount={getCartItemCount()} />
    </div>
  );
}
