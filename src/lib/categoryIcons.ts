import {
  Apple,
  Beef,
  Beer,
  Cake,
  Carrot,
  ChefHat,
  Cherry,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Donut,
  Drumstick,
  Egg,
  Fish,
  Flame,
  GlassWater,
  IceCream,
  IceCreamCone,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
  Sparkles,
  Star,
  Tag,
  Utensils,
  UtensilsCrossed,
  Wheat,
  Wine,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated icon set for menu categories. We expose ~30 hand-picked
 * lucide glyphs that make sense for a restaurant context, instead of
 * the entire ~1500-icon library. Order matters — it's the order
 * shown in the picker grid.
 */
export const CATEGORY_ICONS: { name: string; icon: LucideIcon }[] = [
  // Generic
  { name: "Tag", icon: Tag },
  { name: "Utensils", icon: Utensils },
  { name: "UtensilsCrossed", icon: UtensilsCrossed },
  { name: "ChefHat", icon: ChefHat },
  { name: "Sparkles", icon: Sparkles },
  { name: "Star", icon: Star },
  { name: "Flame", icon: Flame },
  // Mains
  { name: "Pizza", icon: Pizza },
  { name: "Sandwich", icon: Sandwich },
  { name: "Salad", icon: Salad },
  { name: "Soup", icon: Soup },
  { name: "Beef", icon: Beef },
  { name: "Drumstick", icon: Drumstick },
  { name: "Fish", icon: Fish },
  { name: "Egg", icon: Egg },
  { name: "Wheat", icon: Wheat },
  { name: "Croissant", icon: Croissant },
  // Sweets / snacks
  { name: "IceCream", icon: IceCream },
  { name: "IceCreamCone", icon: IceCreamCone },
  { name: "Cake", icon: Cake },
  { name: "Cookie", icon: Cookie },
  { name: "Donut", icon: Donut },
  { name: "Popcorn", icon: Popcorn },
  // Drinks
  { name: "CupSoda", icon: CupSoda },
  { name: "Coffee", icon: Coffee },
  { name: "Beer", icon: Beer },
  { name: "Wine", icon: Wine },
  { name: "GlassWater", icon: GlassWater },
  // Produce
  { name: "Apple", icon: Apple },
  { name: "Cherry", icon: Cherry },
  { name: "Citrus", icon: Citrus },
  { name: "Carrot", icon: Carrot },
];

const ICONS_BY_NAME = new Map(CATEGORY_ICONS.map((entry) => [entry.name, entry.icon]));

/**
 * Resolve a stored icon name to a lucide component. Falls back to Tag
 * for null/unknown values so categories without an icon stay rendered
 * (and a removed icon doesn't crash the menu).
 */
export function resolveCategoryIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Tag;
  return ICONS_BY_NAME.get(name) ?? Tag;
}
