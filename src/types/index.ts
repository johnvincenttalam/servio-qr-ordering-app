export interface MenuItem {
  id: string;
  name: string;
  price: number;
  image: string;
  category: MenuCategory;
  description: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
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
