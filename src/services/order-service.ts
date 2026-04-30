import { supabase } from "@/lib/supabase";
import type {
  CartItem,
  CartItemSelection,
  Order,
  OrderStatus,
} from "@/types";

interface OrderRow {
  id: string;
  table_id: string;
  status: OrderStatus;
  total: number | string;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
}

interface OrderItemRow {
  line_id: string;
  item_id: string | null;
  name: string;
  base_price: number | string;
  unit_price: number | string;
  quantity: number;
  image: string;
  selections: CartItemSelection[] | null;
}

function rowToOrder(order: OrderRow, items: OrderItemRow[]): Order {
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

function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

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

  return rowToOrder(orderResult.data, itemsResult.data ?? []);
}
