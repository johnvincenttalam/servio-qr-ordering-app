import { Package, Trash2, type LucideIcon } from "lucide-react";
import {
  ORDER_STATUS_ICONS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_PILL,
} from "@/constants";
import type { AdminOrderStatus } from "./useAdminOrders";

export const ADMIN_STATUS_LABEL: Record<AdminOrderStatus, string> = {
  ...ORDER_STATUS_LABELS,
  served: "Served",
  cancelled: "Cancelled",
};

export const ADMIN_STATUS_ICON: Record<AdminOrderStatus, LucideIcon> = {
  ...ORDER_STATUS_ICONS,
  served: Package,
  cancelled: Trash2,
};

export const ADMIN_STATUS_PILL: Record<AdminOrderStatus, string> = {
  ...ORDER_STATUS_PILL,
  served: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive text-white",
};

export const ADMIN_STATUS_PROGRESSION: AdminOrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "served",
];

export const ADMIN_STATUS_ACTIVE: AdminOrderStatus[] = [
  "pending",
  "preparing",
  "ready",
];
