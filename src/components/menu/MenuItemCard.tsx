import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/utils";
import type { MenuItem } from "@/types";

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}

export function MenuItemCard({ item, onSelect, onAdd }: MenuItemCardProps) {
  return (
    <Card
      className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
      onClick={() => onSelect(item)}
    >
      <div className="aspect-[4/3] overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform hover:scale-105"
        />
      </div>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{item.name}</h3>
            <p className="mt-0.5 text-sm font-bold text-primary">
              {formatPrice(item.price)}
            </p>
          </div>
          <Button
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full bg-emerald hover:bg-emerald/90"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(item);
            }}
            aria-label={`Add ${item.name} to cart`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
