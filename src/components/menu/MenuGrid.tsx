import { MenuItemCard } from "./MenuItemCard";
import type { MenuItem } from "@/types";

interface MenuGridProps {
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}

const STAGGER_MS = 40;
const MAX_DELAY_MS = 360;

export function MenuGrid({ items, onSelect, onAdd }: MenuGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 pt-1">
      {items.map((item, i) => (
        <MenuItemCard
          key={item.id}
          item={item}
          onSelect={onSelect}
          onAdd={onAdd}
          style={{ animationDelay: `${Math.min(i * STAGGER_MS, MAX_DELAY_MS)}ms` }}
        />
      ))}
    </div>
  );
}
