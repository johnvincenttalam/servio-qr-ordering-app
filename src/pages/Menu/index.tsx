import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, UtensilsCrossed, Search } from "lucide-react";
import { useMenu } from "@/hooks/useMenu";
import { useAppStore } from "@/store/useAppStore";
import { CategoryTabs } from "@/components/menu/CategoryTabs";
import { MenuGrid } from "@/components/menu/MenuGrid";
import { MenuItemModal } from "@/components/menu/MenuItemModal";
import { MenuSkeleton } from "@/components/menu/MenuSkeleton";
import { PromoCarousel } from "@/components/menu/PromoCarousel";
import { Greeting } from "@/components/menu/Greeting";
import { TopPicksStrip } from "@/components/menu/TopPicksStrip";
import { MenuSearchBar } from "@/components/menu/MenuSearchBar";
import { EmptyState } from "@/components/common/EmptyState";
import { WaiterCallSheet } from "@/components/common/WaiterCallSheet";
import { StickyCartBar } from "@/components/cart/StickyCartBar";
import { cn } from "@/lib/utils";
import type { MenuItem, MenuCategory, CartItemSelection } from "@/types";

export default function MenuPage() {
  const navigate = useNavigate();
  const tableId = useAppStore((s) => s.tableId);
  const addToCart = useAppStore((s) => s.addToCart);
  const cartCount = useAppStore((s) => s.getCartItemCount());

  const { items, categories, banners, isLoading } = useMenu();
  const [activeCategory, setActiveCategory] = useState<MenuCategory | "all">(
    "all"
  );
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [callSheetOpen, setCallSheetOpen] = useState(false);

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
      {showHero && <Greeting />}
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

      <button
        type="button"
        onClick={() => setCallSheetOpen(true)}
        aria-label="Call waiter"
        className={cn(
          "fixed right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md shadow-black/5 transition-all hover:scale-105 active:scale-95",
          cartCount > 0 ? "bottom-24" : "bottom-4"
        )}
      >
        <Bell className="h-5 w-5" strokeWidth={2.2} />
      </button>

      <WaiterCallSheet
        open={callSheetOpen}
        onClose={() => setCallSheetOpen(false)}
        tableId={tableId}
        showBill={false}
      />

      <StickyCartBar onClick={() => navigate("/cart")} />
    </div>
  );
}
