import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
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

  const itemCount = getCartItemCount();

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-extrabold">Your Cart</h2>
        <span className="text-sm font-medium text-muted-foreground">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="space-y-2">
        {cart.map((item) => (
          <CartItemRow
            key={item.lineId}
            item={item}
            onUpdateQuantity={updateQuantity}
            onRemove={removeFromCart}
          />
        ))}
      </div>
      <CartFooter total={getCartTotal()} itemCount={itemCount} />
    </div>
  );
}
