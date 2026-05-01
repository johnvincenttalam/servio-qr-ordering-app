import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, UtensilsCrossed, Search } from "lucide-react";
import { useMenu } from "@/hooks/useMenu";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";
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
import { StickyCartBar } from "@/components/cart/StickyCartBar";
import type { MenuItem, MenuCategory, CartItemSelection } from "@/types";

export default function MenuPage() {
  const navigate = useNavigate();
  const tableId = useAppStore((s) => s.tableId);
  const addToCart = useAppStore((s) => s.addToCart);

  const { items, categories, banners, isLoading } = useMenu();
  const { settings } = useRestaurantSettings();
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
      {!settings.openForOrders && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-warning/40 bg-warning/15 p-3 animate-fade-up">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/40">
            <Lock className="h-3.5 w-3.5 text-foreground" strokeWidth={2.4} />
          </span>
          <div className="text-sm">
            <p className="font-bold leading-tight">We&apos;re not taking orders right now</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Browse the menu — checkout will reopen when the kitchen does.
            </p>
          </div>
        </div>
      )}
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

      <StickyCartBar onClick={() => navigate("/cart")} />
    </div>
  );
}
