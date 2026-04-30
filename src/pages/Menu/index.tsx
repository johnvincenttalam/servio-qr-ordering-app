import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, UtensilsCrossed, Search } from "lucide-react";
import { useMenu } from "@/hooks/useMenu";
import { useAppStore } from "@/store/useAppStore";
import { CategoryTabs } from "@/components/menu/CategoryTabs";
import { MenuGrid } from "@/components/menu/MenuGrid";
import { MenuItemModal } from "@/components/menu/MenuItemModal";
import { MenuSkeleton } from "@/components/menu/MenuSkeleton";
import { PromoCarousel } from "@/components/menu/PromoCarousel";
import { TopPicksStrip } from "@/components/menu/TopPicksStrip";
import { MenuSearchBar } from "@/components/menu/MenuSearchBar";
import { EmptyState } from "@/components/common/EmptyState";
import { formatPrice } from "@/utils";
import type { MenuItem, MenuCategory, CartItemSelection } from "@/types";

export default function MenuPage() {
  const navigate = useNavigate();
  const tableId = useAppStore((s) => s.tableId);
  const addToCart = useAppStore((s) => s.addToCart);
  const cartTotal = useAppStore((s) => s.getCartTotal());
  const cartCount = useAppStore((s) => s.getCartItemCount());

  const { items, categories, banners, isLoading } = useMenu();
  const [activeCategory, setActiveCategory] = useState<MenuCategory | "all">(
    "all"
  );
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const topPicks = useMemo(
    () => items.filter((item) => item.topPick),
    [items]
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) {
        return false;
      }
      if (query) {
        return (
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [items, activeCategory, searchQuery]);

  if (!tableId) {
    navigate("/", { replace: true });
    return null;
  }

  const handleAddToCart = (
    item: MenuItem,
    quantity: number = 1,
    selections: CartItemSelection[] = []
  ) => {
    addToCart(
      {
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
      },
      selections,
      quantity
    );
  };

  const handleQuickAdd = (item: MenuItem) => {
    const hasOptions = (item.options?.length ?? 0) > 0;
    if (hasOptions) {
      setSelectedItem(item);
    } else {
      handleAddToCart(item);
    }
  };

  if (isLoading) {
    return <MenuSkeleton />;
  }

  const isSearching = searchQuery.trim().length > 0;
  const showHero = !isSearching;
  const showTopPicks = topPicks.length > 0 && !isSearching;

  return (
    <div className="space-y-3">
      {showHero && banners.length > 0 && <PromoCarousel banners={banners} />}

      {showTopPicks && (
        <TopPicksStrip
          items={topPicks}
          onSelect={setSelectedItem}
          onAdd={handleQuickAdd}
        />
      )}

      <MenuSearchBar value={searchQuery} onChange={setSearchQuery} />

      {!isSearching && (
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />
      )}

      {filteredItems.length === 0 ? (
        <EmptyState
          icon={isSearching ? Search : UtensilsCrossed}
          title={isSearching ? "No matches" : "No items found"}
          description={
            isSearching
              ? `Nothing matches "${searchQuery.trim()}". Try a different word.`
              : "No items available in this category."
          }
        />
      ) : (
        <MenuGrid
          items={filteredItems}
          onSelect={setSelectedItem}
          onAdd={handleQuickAdd}
        />
      )}

      <MenuItemModal
        item={selectedItem}
        open={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        onAddToCart={handleAddToCart}
      />

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
          <div className="mx-auto max-w-md sm:max-w-lg lg:max-w-xl p-4">
            <button
              onClick={() => navigate("/cart")}
              className="pointer-events-auto group flex w-full items-center justify-between rounded-full bg-foreground px-5 py-4 text-background transition-transform duration-200 hover:scale-[1.01] active:scale-[0.98] animate-fade-up"
            >
              <span className="flex items-center gap-3 font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/20 text-sm font-bold">
                  {cartCount}
                </span>
                <span className="text-sm">View Cart</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-base font-bold">
                  {formatPrice(cartTotal)}
                </span>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
