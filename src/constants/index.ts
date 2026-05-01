import { CheckCircle2, ChefHat, Clock, type LucideIcon } from "lucide-react";
import type { OrderStatus } from "@/types";

export const CURRENCY_SYMBOL = "₱";

// Category labels used to live here as a fixed map. They're now sourced
// from the public.categories table — see useMenu / useAdminCategories.

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
