import { useRef } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils";
import { useFlyToCart } from "./FlyToCart";
import type { MenuItem } from "@/types";

interface TopPicksStripProps {
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}

export function TopPicksStrip({
  items,
  onSelect,
  onAdd,
}: TopPicksStripProps) {
  if (items.length === 0) return null;

  return (
    <section className="-mx-4 animate-fade-up">
      <h3 className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Top Picks
      </h3>
      <div className="mt-2 flex gap-3 overflow-x-auto scrollbar-none px-4 pb-1">
        {items.map((item) => (
          <TopPickCard
            key={item.id}
            item={item}
            onSelect={onSelect}
            onAdd={onAdd}
          />
        ))}
        <div className="w-1 shrink-0" aria-hidden />
      </div>
    </section>
  );
}

function TopPickCard({
  item,
  onSelect,
  onAdd,
}: {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}) {
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

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-label={
        outOfStock ? `${item.name} (sold out)` : `View ${item.name}`
      }
      className="group/pick w-36 shrink-0 text-left transition-transform active:scale-[0.97]"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
        <img
          ref={imgRef}
          src={item.image}
          alt={item.name}
          loading="lazy"
          className={cn(
            "h-full w-full object-cover transition-transform duration-500",
            outOfStock
              ? "grayscale opacity-70"
              : "group-hover/pick:scale-105"
          )}
        />
        {outOfStock ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
            Sold out
          </span>
        ) : (
          <span
            role="button"
            aria-label={`Add ${item.name} to cart`}
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleAdd();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                handleAdd();
              }
            }}
            className="absolute bottom-2 right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-110 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
        )}
      </div>
      <div className={cn("mt-2 px-1", outOfStock && "opacity-60")}>
        <h4 className="truncate text-sm font-semibold leading-tight">
          {item.name}
        </h4>
        <p className="text-sm font-bold text-foreground">
          {formatPrice(item.price)}
        </p>
      </div>
    </button>
  );
}
