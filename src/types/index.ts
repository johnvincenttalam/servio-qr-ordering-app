export interface MenuOptionChoice {
  id: string;
  name: string;
  priceDelta?: number;
}

export interface MenuOption {
  id: string;
  name: string;
  type: "single" | "multi";
  required?: boolean;
  choices: MenuOptionChoice[];
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  image: string;
  category: MenuCategory;
  description: string;
  topPick?: boolean;
  inStock?: boolean;
  options?: MenuOption[];
}

export interface CartItemSelection {
  optionId: string;
  optionName: string;
  choiceId: string;
  choiceName: string;
  priceDelta: number;
}

export interface CartItem {
  lineId: string;
  itemId: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  image: string;
  selections: CartItemSelection[];
}

export type OrderStatus = "pending" | "preparing" | "ready";

export interface Order {
  id: string;
  tableId: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  customerName?: string;
  notes?: string;
  createdAt: number;
}

/**
 * Category id. Now a string (the row's primary key) instead of a fixed
 * enum, since admins can add their own categories at runtime. Kept as
 * a named alias so callsite intent stays clear.
 */
export type MenuCategory = string;

export interface Category {
  id: string;
  label: string;
  position: number;
  archivedAt?: number | null;
}

export interface PromoBanner {
  id: string;
  image: string;
  title?: string;
  subtitle?: string;
}

export type WaiterCallKind = "service" | "bill";

export interface WaiterCall {
  id: string;
  tableId: string;
  orderId: string | null;
  kind: WaiterCallKind;
  note: string | null;
  createdAt: number;
  resolvedAt: number | null;
  resolvedBy: string | null;
}
