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
  /** Set when admin comped the line. unit_price is also 0 in that case. */
  compedAt: number | null;
  /** Operator's reason captured at comp time. */
  compReason: string | null;
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
  /** Anti-abuse: row was soft-held by the trigger; staff must approve. */
  requiresReview: boolean;
  /** 0–100. Audit value, not enforced — set by check_order_abuse(). */
  riskScore: number;
  /** Per-browser device id captured at submit. Null on legacy orders. */
  deviceId: string | null;
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
  requires_review: boolean | null;
  risk_score: number | null;
  device_id: string | null;
  items: {
    line_id: string;
    item_id: string | null;
    name: string;
    base_price: number | string;
    unit_price: number | string;
    quantity: number;
    image: string;
    selections: CartItemSelection[] | null;
    comped_at: string | null;
    comp_reason: string | null;
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
    requiresReview: row.requires_review === true,
    riskScore: row.risk_score ?? 0,
    deviceId: row.device_id,
    items: row.items.map((it) => ({
      lineId: it.line_id,
      itemId: it.item_id,
      name: it.name,
      basePrice: Number(it.base_price),
      unitPrice: Number(it.unit_price),
      quantity: it.quantity,
      image: it.image,
      selections: it.selections ?? [],
      compedAt: it.comped_at ? new Date(it.comped_at).getTime() : null,
      compReason: it.comp_reason,
    })),
  };
}

const ORDERS_SELECT = `
  id, table_id, status, total, customer_name, notes, created_at, ready_at,
  requires_review, risk_score, device_id,
  items:order_items(line_id, item_id, name, base_price, unit_price, quantity, image, selections, comped_at, comp_reason)
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
  comped_at: string | null;
  comp_reason: string | null;
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
      compedAt: it.comped_at ? new Date(it.comped_at).getTime() : undefined,
      compReason: it.comp_reason ?? undefined,
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
        "line_id, item_id, name, base_price, unit_price, quantity, image, selections, comped_at, comp_reason"
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
  /**
   * Per-browser device id. Forwarded so the 0017 anti-abuse trigger can
   * blocklist + rate-limit by device, and so cancel_my_order() can verify
   * ownership during the 30-second undo window.
   */
  deviceId?: string;
  /**
   * Customer session id from start_customer_session (Phase 2 / 0021).
   * Required for new clients; legacy submissions without one are still
   * accepted by the trigger for backward-compat.
   */
  sessionId?: string;
}): Promise<Order> {
  const orderId = generateOrderId();

  const { error: orderError } = await supabase.from("orders").insert({
    id: orderId,
    table_id: params.tableId,
    status: "pending",
    total: params.total,
    customer_name: params.customerName ?? null,
    notes: params.notes ?? null,
    device_id: params.deviceId ?? null,
    session_id: params.sessionId ?? null,
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

/**
 * Customer-side single-line edit inside the 60-second window. Calls
 * modify_my_order_item which validates ownership, window, status,
 * and the per-order edit cap server-side. New quantity must be 0
 * (which removes the line) or strictly less than current — adds are
 * not allowed by this RPC.
 */
export type ModifyOrderError =
  | "ORDER_NOT_FOUND"
  | "WRONG_DEVICE"
  | "WINDOW_EXPIRED"
  | "STATUS_LOCKED"
  | "CAP_REACHED"
  | "LINE_NOT_FOUND"
  | "QTY_INVALID"
  | "UNKNOWN";

export type ModifyOrderResult =
  | { ok: true; modificationsLeft: number }
  | { ok: false; error: ModifyOrderError };

const KNOWN_MODIFY_ERRORS: ReadonlySet<ModifyOrderError> = new Set([
  "ORDER_NOT_FOUND",
  "WRONG_DEVICE",
  "WINDOW_EXPIRED",
  "STATUS_LOCKED",
  "CAP_REACHED",
  "LINE_NOT_FOUND",
  "QTY_INVALID",
  "UNKNOWN",
]);

export async function modifyMyOrderItem(
  orderId: string,
  deviceId: string,
  lineId: string,
  newQuantity: number
): Promise<ModifyOrderResult> {
  const { data, error } = await supabase.rpc("modify_my_order_item", {
    p_order_id: orderId,
    p_device_id: deviceId,
    p_line_id: lineId,
    p_new_quantity: newQuantity,
  });
  if (error) {
    console.warn("[services/orders] modify_my_order_item failed:", error);
    return { ok: false, error: "UNKNOWN" };
  }
  const payload = data as
    | { ok: boolean; error?: string; modifications_left?: number }
    | null;
  if (!payload || payload.ok !== true) {
    const code =
      payload?.error && KNOWN_MODIFY_ERRORS.has(payload.error as ModifyOrderError)
        ? (payload.error as ModifyOrderError)
        : "UNKNOWN";
    return { ok: false, error: code };
  }
  return {
    ok: true,
    modificationsLeft: payload.modifications_left ?? 0,
  };
}

/**
 * Customer-friendly copy for each modify-order error. Centralised so
 * inline banners and toasts read the same.
 */
export const MODIFY_ORDER_ERROR_COPY: Record<ModifyOrderError, string> = {
  ORDER_NOT_FOUND: "Order not found.",
  WRONG_DEVICE: "Only the device that placed this order can edit it.",
  WINDOW_EXPIRED: "The edit window has closed — kitchen has the order.",
  STATUS_LOCKED: "Kitchen is already preparing this — too late to edit.",
  CAP_REACHED: "You've used up your edits on this order.",
  LINE_NOT_FOUND: "That item isn't on the order.",
  QTY_INVALID: "Can only decrease quantities.",
  UNKNOWN: "Couldn't apply the change. Please try again.",
};

/**
 * Customer-side cancel inside the 30-second undo window. Calls the
 * cancel_my_order RPC which verifies device ownership + status='pending'
 * + within 30s of submitted_at server-side. Returns true if the cancel
 * actually flipped the row, false otherwise (out of window, wrong device,
 * already advanced). Never throws — surface a user-friendly toast on false.
 */
export async function cancelMyOrder(
  orderId: string,
  deviceId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("cancel_my_order", {
    p_order_id: orderId,
    p_device_id: deviceId,
  });
  if (error) {
    console.warn("[services/orders] cancel_my_order failed:", error);
    return false;
  }
  return data === true;
}

// ──────────────────────────────────────────────────────────────────
// Mutations — admin
// ──────────────────────────────────────────────────────────────────

export function setOrderStatus(id: string, status: AdminOrderStatus) {
  return supabase.from("orders").update({ status }).eq("id", id);
}

/**
 * Phase C.1 — admin per-item operations (comp / remove). Both wrap
 * security-definer RPCs that check is_admin(), gate on order status,
 * append audit_log + order_modifications entries, and recompute the
 * order total.
 */
export type AdminItemModError =
  | "ORDER_NOT_FOUND"
  | "LINE_NOT_FOUND"
  | "STATUS_LOCKED"
  | "REASON_REQUIRED"
  | "UNKNOWN";

export type AdminItemModResult =
  | { ok: true; newTotal: number; orderCancelled?: boolean }
  | { ok: false; error: AdminItemModError };

const KNOWN_MOD_ERRORS: ReadonlySet<AdminItemModError> = new Set([
  "ORDER_NOT_FOUND",
  "LINE_NOT_FOUND",
  "STATUS_LOCKED",
  "REASON_REQUIRED",
  "UNKNOWN",
]);

function parseModResult(data: unknown): AdminItemModResult {
  const payload = data as
    | { ok: boolean; error?: string; new_total?: number; order_cancelled?: boolean }
    | null;
  if (!payload) return { ok: false, error: "UNKNOWN" };
  if (payload.ok !== true) {
    const code =
      payload.error && KNOWN_MOD_ERRORS.has(payload.error as AdminItemModError)
        ? (payload.error as AdminItemModError)
        : "UNKNOWN";
    return { ok: false, error: code };
  }
  return {
    ok: true,
    newTotal: Number(payload.new_total ?? 0),
    orderCancelled: payload.order_cancelled === true,
  };
}

export async function compOrderItem(
  orderId: string,
  lineId: string,
  reason: string
): Promise<AdminItemModResult> {
  const { data, error } = await supabase.rpc("admin_comp_order_item", {
    p_order_id: orderId,
    p_line_id: lineId,
    p_reason: reason,
  });
  if (error) {
    console.error("[services/orders] admin_comp_order_item failed:", error);
    return { ok: false, error: "UNKNOWN" };
  }
  return parseModResult(data);
}

export async function removeOrderItem(
  orderId: string,
  lineId: string,
  reason: string
): Promise<AdminItemModResult> {
  const { data, error } = await supabase.rpc("admin_remove_order_item", {
    p_order_id: orderId,
    p_line_id: lineId,
    p_reason: reason,
  });
  if (error) {
    console.error("[services/orders] admin_remove_order_item failed:", error);
    return { ok: false, error: "UNKNOWN" };
  }
  return parseModResult(data);
}

/**
 * Reverse a comp on a single line. Restores unit_price from base_price
 * (plus the per-selection priceDelta sum captured on the line) and
 * clears comped_at + comp_reason. Server-side audited the same way
 * as comp/remove. No-op success when the line wasn't comped to begin
 * with.
 */
export async function uncompOrderItem(
  orderId: string,
  lineId: string,
  reason: string
): Promise<AdminItemModResult> {
  const { data, error } = await supabase.rpc("admin_uncomp_order_item", {
    p_order_id: orderId,
    p_line_id: lineId,
    p_reason: reason,
  });
  if (error) {
    console.error("[services/orders] admin_uncomp_order_item failed:", error);
    return { ok: false, error: "UNKNOWN" };
  }
  return parseModResult(data);
}

export const ADMIN_ITEM_MOD_ERROR_COPY: Record<AdminItemModError, string> = {
  ORDER_NOT_FOUND: "Order not found.",
  LINE_NOT_FOUND: "That item isn't on the order anymore.",
  STATUS_LOCKED:
    "Order is already served or cancelled — can't modify items.",
  REASON_REQUIRED: "A reason is required.",
  UNKNOWN: "Couldn't apply the change. Please try again.",
};

/**
 * Release a held order so the kitchen sees it. Bumps submitted_at to now()
 * so the kitchen-side 30s gate doesn't accidentally hide a freshly-approved
 * row that was originally placed minutes ago.
 */
export function approveHeldOrder(id: string) {
  return supabase
    .from("orders")
    .update({ requires_review: false, submitted_at: new Date().toISOString() })
    .eq("id", id);
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
