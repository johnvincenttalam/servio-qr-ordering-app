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

export type MenuCategory = "meals" | "drinks" | "desserts" | "sides";
