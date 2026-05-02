/**
 * Orders data layer — owns every Supabase query that touches orders
 * or order_items. Customer-facing functions (submit, fetch one by
 * id) live alongside admin-facing ones (paginated list, status
 * mutation, push trigger) so the schema lives in one file.
 */
import { supabase } from "@/lib/supabase";
import type {
  CartItem,
  CartItemSelection,
  Order,
  OrderStatus,
} from "@/types";

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
// Reads — customer
// ──────────────────────────────────────────────────────────────────

interface PublicOrderRow {
  id: string;
  table_id: string;
  status: OrderStatus;
  total: number | string;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
}

interface PublicOrderItemRow {
  line_id: string;
  item_id: string | null;
  name: string;
  base_price: number | string;
  unit_price: number | string;
  quantity: number;
  image: string;
  selections: CartItemSelection[] | null;
}

function rowToPublicOrder(
  order: PublicOrderRow,
  items: PublicOrderItemRow[]
): Order {
  return {
    id: order.id,
    tableId: order.table_id,
    items: items.map((it) => ({
      lineId: it.line_id,
      itemId: it.item_id ?? "",
      name: it.name,
      basePrice: Number(it.base_price),
      unitPrice: Number(it.unit_price),
      quantity: it.quantity,
      image: it.image,
      selections: it.selections ?? [],
    })),
    total: Number(order.total),
    status: order.status,
    customerName: order.customer_name ?? undefined,
    notes: order.notes ?? undefined,
    createdAt: new Date(order.created_at).getTime(),
  };
}

/**
 * Fetch a single order + its items for the customer order-status
 * page. Throws on error; returns undefined when the id doesn't
 * exist (e.g. the operator typed the wrong ?order=).
 */
export async function fetchOrderStatus(
  orderId: string
): Promise<Order | undefined> {
  const [orderResult, itemsResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, table_id, status, total, customer_name, notes, created_at")
      .eq("id", orderId)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select(
        "line_id, item_id, name, base_price, unit_price, quantity, image, selections"
      )
      .eq("order_id", orderId),
  ]);

  if (orderResult.error) throw orderResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (!orderResult.data) return undefined;

  return rowToPublicOrder(
    orderResult.data as PublicOrderRow,
    (itemsResult.data ?? []) as PublicOrderItemRow[]
  );
}

// ──────────────────────────────────────────────────────────────────
// Mutations — customer
// ──────────────────────────────────────────────────────────────────

function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

/**
 * Customer-side order submission. Inserts the order header + items
 * in two writes; if the items insert fails, the orphan header is
 * rolled back so we don't leave a hollow row. Throws on either
 * failure path.
 */
export async function submitOrder(params: {
  tableId: string;
  items: CartItem[];
  total: number;
  customerName?: string;
  notes?: string;
}): Promise<Order> {
  const orderId = generateOrderId();

  const { error: orderError } = await supabase.from("orders").insert({
    id: orderId,
    table_id: params.tableId,
    status: "pending",
    total: params.total,
    customer_name: params.customerName ?? null,
    notes: params.notes ?? null,
  });
  if (orderError) throw orderError;

  const itemRows = params.items.map((item) => ({
    order_id: orderId,
    line_id: item.lineId,
    item_id: item.itemId || null,
    name: item.name,
    base_price: item.basePrice,
    unit_price: item.unitPrice,
    quantity: item.quantity,
    image: item.image,
    selections: item.selections.length > 0 ? item.selections : null,
  }));
  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemRows);
  if (itemsError) {
    // Best-effort cleanup so we don't leave a hollow order
    await supabase.from("orders").delete().eq("id", orderId);
    throw itemsError;
  }

  return {
    id: orderId,
    tableId: params.tableId,
    items: params.items,
    total: params.total,
    status: "pending",
    customerName: params.customerName,
    notes: params.notes,
    createdAt: Date.now(),
  };
}

// ──────────────────────────────────────────────────────────────────
// Mutations — admin
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
