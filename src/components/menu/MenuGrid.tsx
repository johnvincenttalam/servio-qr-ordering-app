import { MenuItemCard } from "./MenuItemCard";
import type { MenuItem } from "@/types";

interface MenuGridProps {
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}

export function MenuGrid({ items, onSelect, onAdd }: MenuGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <MenuItemCard
          key={item.id}
          item={item}
          onSelect={onSelect}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}
