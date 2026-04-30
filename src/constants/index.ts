import { CheckCircle2, ChefHat, Clock, type LucideIcon } from "lucide-react";
import type { MenuCategory, OrderStatus } from "@/types";

export const VALID_TABLE_IDS = [
  "T1",
  "T2",
  "T3",
  "T4",
  "T5",
  "T6",
  "T7",
  "T8",
  "T9",
  "T10",
] as const;

export const CURRENCY_SYMBOL = "₱";

export const CATEGORY_LABELS: Record<MenuCategory, string> = {
  meals: "Meals",
  drinks: "Drinks",
  desserts: "Desserts",
  sides: "Sides",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
};

export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  pending: "Your order has been received and is waiting to be prepared.",
  preparing: "The kitchen is working on your order right now.",
  ready: "Your order is ready! Please pick it up at the counter.",
};

export const ORDER_STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  pending: Clock,
  preparing: ChefHat,
  ready: CheckCircle2,
};

export const ORDER_STATUS_PILL: Record<OrderStatus, string> = {
  pending: "bg-warning text-foreground",
  preparing: "bg-info text-white",
  ready: "bg-success text-white",
};
