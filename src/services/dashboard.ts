/**
 * Dashboard data layer — owns the multi-query Promise.all that
 * computes today's KPIs and the per-call aggregations (revenue, avg
 * prep time, top seller). Hook layer is reduced to state + realtime
 * once this returns.
 */
import { supabase } from "@/lib/supabase";
import type { OrderStatus } from "@/types";

export interface DashboardStats {
  activeCount: number;
  todayCount: number;
  todayRevenue: number;
  avgPrepMinutes: number | null;
  yesterdayCount: number;
  yesterdayRevenue: number;
  /** todayRevenue / todayCount, or null if no orders yet today. */
  avgTicket: number | null;
  /** Best-selling line item across today's orders, by quantity. */
  topItem: { name: string; quantity: number } | null;
}

export interface RecentOrder {
  id: string;
  tableId: string;
  status: OrderStatus | "served" | "cancelled";
  total: number;
  customerName: string | null;
  createdAt: number;
}

interface OrderRow {
  id: string;
  table_id: string;
  status: OrderStatus | "served" | "cancelled";
  total: number | string;
  customer_name: string | null;
  created_at: string;
  ready_at: string | null;
}

interface TopItemRow {
  name: string;
  quantity: number;
  orders: { status: string } | { status: string }[];
}

const ACTIVE: OrderStatus[] = ["pending", "preparing", "ready"];

const EMPTY_STATS: DashboardStats = {
  activeCount: 0,
  todayCount: 0,
  todayRevenue: 0,
  avgPrepMinutes: null,
  yesterdayCount: 0,
  yesterdayRevenue: 0,
  avgTicket: null,
  topItem: null,
};

export const DEFAULT_DASHBOARD_STATS: DashboardStats = EMPTY_STATS;

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfYesterdayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return d.toISOString();
}

function rowToRecent(row: OrderRow): RecentOrder {
  return {
    id: row.id,
    tableId: row.table_id,
    status: row.status,
    total: Number(row.total),
    customerName: row.customer_name,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export interface DashboardFetchResult {
  stats: DashboardStats;
  recent: RecentOrder[];
  error: string | null;
}

/**
 * Fan out 5 concurrent queries (today's orders, yesterday's revenue,
 * active count, recent 5, today's items for top-seller), then
 * aggregate into the dashboard's view model. Single round trip to
 * Supabase per refetch.
 */
export async function fetchDashboard(): Promise<DashboardFetchResult> {
  const today = startOfTodayIso();
  const yesterday = startOfYesterdayIso();

  const [todayRes, yesterdayRes, activeRes, recentRes, topItemRes] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, status, total, created_at, ready_at")
        .gte("created_at", today),
      supabase
        .from("orders")
        .select("total")
        .gte("created_at", yesterday)
        .lt("created_at", today),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ACTIVE),
      supabase
        .from("orders")
        .select("id, table_id, status, total, customer_name, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      // Inner-join order_items → orders so we can filter by today's
      // orders in a single round trip and aggregate client-side.
      supabase
        .from("order_items")
        .select("name, quantity, orders!inner(created_at, status)")
        .gte("orders.created_at", today),
    ]);

  const firstError =
    todayRes.error ||
    yesterdayRes.error ||
    activeRes.error ||
    recentRes.error ||
    topItemRes.error;
  if (firstError) {
    console.error("[services/dashboard] fetch failed:", firstError);
    return {
      stats: EMPTY_STATS,
      recent: [],
      error: firstError.message ?? "Failed to load stats",
    };
  }

  const todayRows = (todayRes.data ?? []) as OrderRow[];
  const todayRevenue = todayRows.reduce((sum, r) => sum + Number(r.total), 0);

  const yesterdayRows = (yesterdayRes.data ?? []) as {
    total: number | string;
  }[];
  const yesterdayRevenue = yesterdayRows.reduce(
    (sum, r) => sum + Number(r.total),
    0
  );

  const completed = todayRows.filter(
    (r) => r.ready_at && r.status !== "cancelled"
  );
  const avgPrepMinutes =
    completed.length === 0
      ? null
      : completed.reduce((sum, r) => {
          const created = new Date(r.created_at).getTime();
          const ready = new Date(r.ready_at as string).getTime();
          return sum + (ready - created) / 1000 / 60;
        }, 0) / completed.length;

  const avgTicket =
    todayRows.length === 0 ? null : todayRevenue / todayRows.length;

  // Aggregate today's order_items by name; ignore lines from cancelled
  // orders so a refunded item doesn't pad the leaderboard.
  const itemRows = (topItemRes.data ?? []) as TopItemRow[];
  const tally = new Map<string, number>();
  for (const row of itemRows) {
    const orderStatus = Array.isArray(row.orders)
      ? row.orders[0]?.status
      : row.orders?.status;
    if (orderStatus === "cancelled") continue;
    tally.set(row.name, (tally.get(row.name) ?? 0) + row.quantity);
  }
  const topEntry = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  const topItem = topEntry
    ? { name: topEntry[0], quantity: topEntry[1] }
    : null;

  return {
    stats: {
      activeCount: activeRes.count ?? 0,
      todayCount: todayRows.length,
      todayRevenue,
      avgPrepMinutes,
      yesterdayCount: yesterdayRows.length,
      yesterdayRevenue,
      avgTicket,
      topItem,
    },
    recent: ((recentRes.data ?? []) as OrderRow[]).map(rowToRecent),
    error: null,
  };
}
