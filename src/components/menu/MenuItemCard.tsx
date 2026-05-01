import { useRef, type CSSProperties } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils";
import { useFlyToCart } from "./FlyToCart";
import type { MenuItem } from "@/types";

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
  style?: CSSProperties;
}

export function MenuItemCard({ item, onSelect, onAdd, style }: MenuItemCardProps) {
  const outOfStock = item.inStock === false;
  const imgRef = useRef<HTMLImageElement>(null);
  const { flyToCart } = useFlyToCart();

  const hasOptions = (item.options?.length ?? 0) > 0;

  const handleAdd = () => {
    if (imgRef.current && !hasOptions) {
      flyToCart(imgRef.current, item.image);
    }
    onAdd(item);
  };

  // Outer wrapper is a div, not a button, so the inner "+" can be a
  // proper <button> without illegal nesting. Tapping the "+" no longer
  // focuses the parent — which, before this refactor, was triggering
  // the browser's "scroll-to-focused-element" behaviour and yanking
  // the page upward whenever an Add hit a card mid-scroll.
  const handleSelect = () => onSelect(item);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      }}
      aria-label={
        outOfStock ? `${item.name} (sold out)` : `View ${item.name}`
      }
      style={style}
      className="group/card relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-border bg-card text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/40 focus-visible:outline-offset-2 animate-fade-up"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          ref={imgRef}
          src={item.image}
          alt={item.name}
          loading="lazy"
          className={cn(
            "h-full w-full object-cover transition-transform duration-500",
            outOfStock
              ? "grayscale opacity-70"
              : "group-hover/card:scale-110"
          )}
        />
        {outOfStock ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-background">
            Sold out
          </span>
        ) : (
          <span className="absolute bottom-2 left-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-bold text-foreground">
            {formatPrice(item.price)}
          </span>
        )}
      </div>
      <div
        className={cn(
          "flex flex-1 items-start justify-between gap-2 p-3",
          outOfStock && "opacity-60"
        )}
      >
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight">
            {item.name}
          </h3>
          {item.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>
        {!outOfStock && (
          <button
            type="button"
            aria-label={`Add ${item.name} to cart`}
            onClick={(e) => {
              e.stopPropagation();
              handleAdd();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all duration-200 hover:scale-110 active:scale-95"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </article>
  );
}
