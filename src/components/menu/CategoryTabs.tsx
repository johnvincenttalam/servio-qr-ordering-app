import { cn } from "@/lib/utils";
import type { MenuCategory } from "@/types";

interface CategoryTabsProps {
  categories: { id: MenuCategory; label: string }[];
  activeCategory: MenuCategory | "all";
  onSelect: (category: MenuCategory | "all") => void;
}

export function CategoryTabs({
  categories,
  activeCategory,
  onSelect,
}: CategoryTabsProps) {
  return (
    <div className="sticky top-[57px] z-40 -mx-4 bg-background px-4 pb-2 pt-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => onSelect("all")}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            activeCategory === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
