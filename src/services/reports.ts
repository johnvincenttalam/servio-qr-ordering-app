/**
 * Reports data layer — single windowed fetch over orders + their items
 * that powers the Reports page (custom date range + CSV export).
 *
 * Distinct from services/dashboard because the consumption pattern
 * is different: dashboard is realtime, summary-first, range-locked
 * to today/week/month presets; reports is on-demand, all-rows-for-
 * export, with arbitrary windowing.
 */
import { supabase } from "@/lib/supabase";

/**
 * Window for a report. Both bounds are ISO timestamps; the upper
 * bound is exclusive so back-to-back ranges (e.g. "March" then
 * "April") tile without double-counting.
 */
export interface ReportRange {
  start: string;
  end: string;
}

export interface ReportSummary {
  totalOrders: number;
  totalRevenue: number;
  /** Orders not in the cancelled status — what actually got served. */
  fulfilledOrders: number;
  cancelledOrders: number;
  itemCount: number;
  /** totalRevenue / totalOrders, or null if no orders in the window. */
  avgTicket: number | null;
}

export interface ReportOrder {
  id: string;
  tableId: string;
  customerName: string | null;
  status: string;
  total: number;
  itemCount: number;
  /** Comma-joined "qty× name" for context in the CSV / preview. */
  itemSummary: string;
  notes: string | null;
  createdAt: number;
}

interface ReportOrderRow {
  id: string;
  table_id: string;
  customer_name: string | null;
  status: string;
  total: number | string;
  notes: string | null;
  created_at: string;
  items: {
    line_id: string;
    name: string;
    quantity: number;
  }[];
}

const EMPTY_SUMMARY: ReportSummary = {
  totalOrders: 0,
  totalRevenue: 0,
  fulfilledOrders: 0,
  cancelledOrders: 0,
  itemCount: 0,
  avgTicket: null,
};

function rowToReportOrder(row: ReportOrderRow): ReportOrder {
  const itemCount = row.items.reduce((sum, it) => sum + it.quantity, 0);
  const itemSummary = row.items
    .map((it) => `${it.quantity}× ${it.name}`)
    .join(", ");
  return {
    id: row.id,
    tableId: row.table_id,
    customerName: row.customer_name,
    status: row.status,
    total: Number(row.total),
    itemCount,
    itemSummary,
    notes: row.notes,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function computeSummary(orders: ReportOrder[]): ReportSummary {
  if (orders.length === 0) return EMPTY_SUMMARY;
  let totalRevenue = 0;
  let cancelledOrders = 0;
  let itemCount = 0;
  for (const o of orders) {
    if (o.status === "cancelled") {
      cancelledOrders += 1;
    } else {
      // Cancelled orders don't count toward revenue or item totals
      // — they were refunded / never served.
      totalRevenue += o.total;
      itemCount += o.itemCount;
    }
  }
  const fulfilledOrders = orders.length - cancelledOrders;
  return {
    totalOrders: orders.length,
    totalRevenue,
    fulfilledOrders,
    cancelledOrders,
    itemCount,
    avgTicket: fulfilledOrders > 0 ? totalRevenue / fulfilledOrders : null,
  };
}

export interface ReportFetchResult {
  summary: ReportSummary;
  orders: ReportOrder[];
  error: string | null;
}

/**
 * Single Supabase round trip — orders joined with their item lines —
 * capped at 10k rows. Plenty for any realistic small-restaurant
 * window (a year of orders is typically <5k); past that the caller
 * gets a hint via summary.totalOrders === 10000.
 */
export async function fetchReport(
  range: ReportRange
): Promise<ReportFetchResult> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, table_id, customer_name, status, total, notes, created_at,
       items:order_items(line_id, name, quantity)`
    )
    .gte("created_at", range.start)
    .lt("created_at", range.end)
    .order("created_at", { ascending: false })
    .range(0, 9999);

  if (error) {
    console.error("[services/reports] fetch failed:", error);
    return {
      summary: EMPTY_SUMMARY,
      orders: [],
      error: error.message,
    };
  }

  const orders = ((data ?? []) as ReportOrderRow[]).map(rowToReportOrder);
  return {
    summary: computeSummary(orders),
    orders,
    error: null,
  };
}
