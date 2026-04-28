import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useMenu } from "@/hooks/useMenu";
import { useAppStore } from "@/store/useAppStore";
import { CategoryTabs } from "@/components/menu/CategoryTabs";
import { MenuGrid } from "@/components/menu/MenuGrid";
import { MenuItemModal } from "@/components/menu/MenuItemModal";
import { MenuSkeleton } from "@/components/menu/MenuSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { UtensilsCrossed } from "lucide-react";
import { formatPrice } from "@/utils";
import type { MenuItem, MenuCategory } from "@/types";

export default function MenuPage() {
  const navigate = useNavigate();
  const tableId = useAppStore((s) => s.tableId);
  const addToCart = useAppStore((s) => s.addToCart);
  const getCartTotal = useAppStore((s) => s.getCartTotal);
  const getCartItemCount = useAppStore((s) => s.getCartItemCount);

  const { items, categories, isLoading } = useMenu();
  const [activeCategory, setActiveCategory] = useState<MenuCategory | "all">(
    "all"
  );
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const filteredItems = useMemo(() => {
    if (activeCategory === "all") return items;
    return items.filter((item) => item.category === activeCategory);
  }, [items, activeCategory]);

  // Redirect if no table ID
  if (!tableId) {
    navigate("/", { replace: true });
    return null;
  }

  const handleAddToCart = (item: MenuItem, quantity: number = 1) => {
    addToCart(
      {
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
      },
      quantity
    );
    toast.success(`${item.name} added to cart`);
  };

  if (isLoading) {
    return <MenuSkeleton />;
  }

  const cartTotal = getCartTotal();
  const cartCount = getCartItemCount();

  return (
    <div className="space-y-4">
      <CategoryTabs
        categories={categories}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
      />

      {filteredItems.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No items found"
          description="No items available in this category."
        />
      ) : (
        <MenuGrid
          items={filteredItems}
          onSelect={setSelectedItem}
          onAdd={(item) => handleAddToCart(item)}
        />
      )}

      <MenuItemModal
        item={selectedItem}
        open={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="mx-auto max-w-md sm:max-w-lg lg:max-w-xl p-4">
            <button
              onClick={() => navigate("/cart")}
              className="flex w-full items-center justify-between rounded-xl bg-emerald px-5 py-4 text-white shadow-lg transition-colors hover:bg-emerald/90"
            >
              <span className="flex items-center gap-2 font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm">
                  {cartCount}
                </span>
                View Cart
              </span>
              <span className="font-bold">{formatPrice(cartTotal)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
