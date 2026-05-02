/**
 * Orders data layer (admin side) — wraps the orders + order_items
 * select used by Orders / Dashboard / OrderDetail surfaces and the
 * status-update mutation. The send-order-push edge invocation is
 * also exposed here so the hook doesn't have to know about edge
 * functions.
 */
import { supabase } from "@/lib/supabase";
import type { CartItemSelection, OrderStatus } from "@/types";

export type AdminOrderStatus = OrderStatus | "served" | "cancelled";

export interface AdminOrderItem {
  lineId: string;
  itemId: string | null;
  name: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  image: string;
  selections: CartItemSelection[];
}

export interface AdminOrder {
  id: string;
  tableId: string;
  status: AdminOrderStatus;
  total: number;
  customerName: string | null;
  notes: string | null;
  createdAt: number;
  readyAt: number | null;
  items: AdminOrderItem[];
}

interface OrderRow {
  id: string;
  table_id: string;
  status: AdminOrderStatus;
  total: number | string;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
  ready_at: string | null;
  items: {
    line_id: string;
    item_id: string | null;
    name: string;
    base_price: number | string;
    unit_price: number | string;
    quantity: number;
    image: string;
    selections: CartItemSelection[] | null;
  }[];
}

function rowToOrder(row: OrderRow): AdminOrder {
  return {
    id: row.id,
    tableId: row.table_id,
    status: row.status,
    total: Number(row.total),
    customerName: row.customer_name,
    notes: row.notes,
    createdAt: new Date(row.created_at).getTime(),
    readyAt: row.ready_at ? new Date(row.ready_at).getTime() : null,
    items: row.items.map((it) => ({
      lineId: it.line_id,
      itemId: it.item_id,
      name: it.name,
      basePrice: Number(it.base_price),
      unitPrice: Number(it.unit_price),
      quantity: it.quantity,
      image: it.image,
      selections: it.selections ?? [],
    })),
  };
}

const ORDERS_SELECT = `
  id, table_id, status, total, customer_name, notes, created_at, ready_at,
  items:order_items(line_id, item_id, name, base_price, unit_price, quantity, image, selections)
`;

const QUERY_LIMIT = 200;

// ──────────────────────────────────────────────────────────────────
// Reads
// ──────────────────────────────────────────────────────────────────

export interface OrdersFetchResult {
  orders: AdminOrder[];
  error: string | null;
}

export async function fetchAdminOrders(): Promise<OrdersFetchResult> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDERS_SELECT)
    .order("created_at", { ascending: false })
    .limit(QUERY_LIMIT);

  if (error) {
    console.error("[services/orders] fetch failed:", error);
    return { orders: [], error: error.message };
  }

  return {
    orders: ((data ?? []) as OrderRow[]).map(rowToOrder),
    error: null,
  };
}

// ──────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────

export function setOrderStatus(id: string, status: AdminOrderStatus) {
  return supabase.from("orders").update({ status }).eq("id", id);
}

/**
 * Fire-and-forget push notification when an order moves to ready.
 * The customer's subscription is keyed on order_id so the edge
 * function looks up + signs the right payloads.
 */
export function sendReadyPush(orderId: string): void {
  supabase.functions
    .invoke("send-order-push", { body: { order_id: orderId } })
    .then(({ error }) => {
      if (error) {
        console.warn("[services/orders] push send failed:", error);
      }
    });
}
