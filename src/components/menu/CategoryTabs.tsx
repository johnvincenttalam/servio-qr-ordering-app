import { useRef } from "react";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveCategoryIcon } from "@/lib/categoryIcons";
import type { MenuCategory } from "@/types";

interface CategoryTabsProps {
  categories: { id: MenuCategory; label: string; icon: string | null }[];
  activeCategory: MenuCategory | "all";
  onSelect: (category: MenuCategory | "all") => void;
}

export function CategoryTabs({
  categories,
  activeCategory,
  onSelect,
}: CategoryTabsProps) {
  const lastTappedRef = useRef<MenuCategory | "all" | null>(null);

  const tabs: { id: MenuCategory | "all"; label: string; icon: string | null }[] = [
    { id: "all", label: "All", icon: null },
    ...categories,
  ];

  const handleSelect = (id: MenuCategory | "all") => {
    lastTappedRef.current = id;
    onSelect(id);
  };

  return (
    <div className="sticky top-[64px] z-40 -mx-4 border-b border-border bg-background py-3">
      <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 py-0.5">
        {tabs.map((cat) => {
          const isActive = activeCategory === cat.id;
          const wasJustTapped = lastTappedRef.current === cat.id;
          // "All" stays on LayoutGrid; every other tab resolves its
          // admin-picked icon (Tag fallback if unset).
          const Icon =
            cat.id === "all" ? LayoutGrid : resolveCategoryIcon(cat.icon);
          return (
            <button
              key={cat.id}
              onClick={() => handleSelect(cat.id)}
              aria-label={cat.label}
              aria-pressed={isActive}
              title={cat.label}
              className={cn(
                "shrink-0 flex h-10 items-center justify-center rounded-full px-3 transition-all duration-300 active:scale-95",
                isActive
                  ? "bg-foreground text-background"
                  : "bg-card text-foreground/70 border border-border hover:border-foreground/30 hover:text-foreground"
              )}
            >
              <Icon
                key={isActive && wasJustTapped ? `${cat.id}-pop` : cat.id}
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive && wasJustTapped && "animate-tab-pop"
                )}
                strokeWidth={2.2}
              />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300",
                  isActive
                    ? "max-w-[120px] opacity-100 ml-1.5"
                    : "max-w-0 opacity-0"
                )}
              >
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
