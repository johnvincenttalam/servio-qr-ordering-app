/**
 * Dashboard data layer — owns the multi-query Promise.all that
 * computes today's KPIs and the per-call aggregations (revenue, avg
 * prep time, top seller). Hook layer is reduced to state + realtime
 * once this returns.
 */
import { supabase } from "@/lib/supabase";
import type { OrderStatus } from "@/types";

export interface DashboardStats {
  /** Total active orders right now — sum of the three breakdown buckets. */
  activeCount: number;
  /** Per-status active counts so the dashboard hero can show NEW / COOKING / READY chips. */
  activeBreakdown: { pending: number; preparing: number; ready: number };
  /** Distinct tables currently holding at least one active order. */
  tablesLive: number;
  todayCount: number;
  todayRevenue: number;
  avgPrepMinutes: number | null;
  yesterdayCount: number;
  yesterdayRevenue: number;
  /** todayRevenue / todayCount, or null if no orders yet today. */
  avgTicket: number | null;
  /** Best-selling line item across today's orders, by quantity. */
  topItem: { name: string; quantity: number } | null;
  /**
   * Top 5 best-sellers across today's orders ranked by units sold,
   * each with the revenue they contributed. Excludes lines from
   * cancelled orders. Empty array if nothing's been sold today.
   */
  topSellers: TopSeller[];
  /**
   * Trailing 7-day sparkline data — daily order count + revenue totals
   * including today, oldest first. Drives the inline sparklines on
   * the Today's orders + Today's revenue stat cards.
   */
  dailyHistory: DailyPoint[];
  /**
   * Today's hourly distribution — drives the Service load chart so
   * staff can spot the busy / quiet windows for tomorrow's planning.
   */
  serviceLoad: ServiceLoad;
}

/**
 * One hour's order count for today — always 24 entries (0..23), zero-
 * filled for hours with no orders so the chart renders a complete
 * day shape regardless of when service started.
 */
export interface HourlyPoint {
  hour: number;
  count: number;
}

export interface ServiceLoad {
  hourly: HourlyPoint[];
  /** Hour with the highest count today, or null if no orders yet. */
  peakHour: number | null;
  peakCount: number;
}

export interface TopSeller {
  name: string;
  quantity: number;
  revenue: number;
}

/**
 * One day's totals — used to draw the 7-day sparklines on the
 * Today's orders + Today's revenue cards.
 */
export interface DailyPoint {
  /** Local-date key in YYYY-MM-DD form, ascending. */
  date: string;
  count: number;
  revenue: number;
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
  unit_price: number | string;
  orders: { status: string } | { status: string }[];
}

const ACTIVE: OrderStatus[] = ["pending", "preparing", "ready"];

const EMPTY_STATS: DashboardStats = {
  activeCount: 0,
  activeBreakdown: { pending: 0, preparing: 0, ready: 0 },
  tablesLive: 0,
  todayCount: 0,
  todayRevenue: 0,
  avgPrepMinutes: null,
  yesterdayCount: 0,
  yesterdayRevenue: 0,
  avgTicket: null,
  topItem: null,
  topSellers: [],
  dailyHistory: [],
  serviceLoad: {
    hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
    peakHour: null,
    peakCount: 0,
  },
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

function startOfNDaysAgoIso(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * Build today's hourly load distribution from the flat list of
 * today's orders. Cancelled rows are excluded — service load is
 * about kitchen pressure, and a cancelled order didn't actually
 * land on the line.
 */
function buildServiceLoad(rows: OrderRow[]): ServiceLoad {
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
  }));
  for (const row of rows) {
    if (row.status === "cancelled") continue;
    const h = new Date(row.created_at).getHours();
    hourly[h].count += 1;
  }

  let peakHour: number | null = null;
  let peakCount = 0;
  for (const point of hourly) {
    if (point.count > peakCount) {
      peakCount = point.count;
      peakHour = point.hour;
    }
  }

  return { hourly, peakHour, peakCount };
}

/**
 * Build a 7-day history array (oldest first, including today) from a
 * flat list of order rows. Days with no orders show up as zero rather
 * than gaps so the sparkline renders a continuous line.
 */
function buildDailyHistory(
  rows: { created_at: string; total: number | string; status: string }[]
): DailyPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tally = new Map<string, { count: number; revenue: number }>();
  for (const row of rows) {
    if (row.status === "cancelled") continue;
    const d = new Date(row.created_at);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const bucket = tally.get(key) ?? { count: 0, revenue: 0 };
    bucket.count += 1;
    bucket.revenue += Number(row.total);
    tally.set(key, bucket);
  }

  // Walk back 6 days from today (7 total) so the array always has
  // exactly 7 points, oldest first.
  const points: DailyPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const bucket = tally.get(key) ?? { count: 0, revenue: 0 };
    points.push({ date: key, count: bucket.count, revenue: bucket.revenue });
  }
  return points;
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
  // 6 days back so the trailing-7 window includes today.
  const weekStart = startOfNDaysAgoIso(6);

  const [
    todayRes,
    yesterdayRes,
    activeRes,
    recentRes,
    topItemRes,
    weekRes,
  ] = await Promise.all([
      supabase
        .from("orders")
        .select("id, status, total, created_at, ready_at")
        .gte("created_at", today),
      supabase
        .from("orders")
        .select("total")
        .gte("created_at", yesterday)
        .lt("created_at", today),
      // Pull the active rows themselves (not just count) so we can
      // both bucket by status for the hero chips and dedupe table_ids
      // for the "X tables live" subtitle. Active set is small.
      supabase
        .from("orders")
        .select("status, table_id")
        .in("status", ACTIVE),
      supabase
        .from("orders")
        .select("id, table_id, status, total, customer_name, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      // Inner-join order_items → orders so we can filter by today's
      // orders in a single round trip and aggregate client-side.
      // unit_price comes along so the top-sellers leaderboard can
      // show revenue contribution alongside units sold.
      supabase
        .from("order_items")
        .select(
          "name, quantity, unit_price, orders!inner(created_at, status)"
        )
        .gte("orders.created_at", today),
      // 7-day history for the inline sparklines on Today's orders +
      // Today's revenue. Status is included so we can drop cancelled
      // rows from the daily totals.
      supabase
        .from("orders")
        .select("created_at, total, status")
        .gte("created_at", weekStart),
    ]);

  const firstError =
    todayRes.error ||
    yesterdayRes.error ||
    activeRes.error ||
    recentRes.error ||
    topItemRes.error ||
    weekRes.error;
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
  // orders so a refunded item doesn't pad the leaderboard. Track both
  // units (for ranking) and revenue (so the leaderboard can show the
  // money contribution per item).
  const itemRows = (topItemRes.data ?? []) as TopItemRow[];
  const tally = new Map<string, { quantity: number; revenue: number }>();
  for (const row of itemRows) {
    const orderStatus = Array.isArray(row.orders)
      ? row.orders[0]?.status
      : row.orders?.status;
    if (orderStatus === "cancelled") continue;
    const existing = tally.get(row.name) ?? { quantity: 0, revenue: 0 };
    existing.quantity += row.quantity;
    existing.revenue += row.quantity * Number(row.unit_price);
    tally.set(row.name, existing);
  }
  const topSellers = [...tally.entries()]
    .map(([name, { quantity, revenue }]) => ({ name, quantity, revenue }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
  const topItem = topSellers[0]
    ? { name: topSellers[0].name, quantity: topSellers[0].quantity }
    : null;

  // Bucket the active-order rows into status counts + distinct
  // table_id set in a single pass.
  const activeRows =
    (activeRes.data ?? []) as { status: OrderStatus; table_id: string }[];
  const activeBreakdown = { pending: 0, preparing: 0, ready: 0 };
  const liveTables = new Set<string>();
  for (const row of activeRows) {
    if (row.status === "pending") activeBreakdown.pending++;
    else if (row.status === "preparing") activeBreakdown.preparing++;
    else if (row.status === "ready") activeBreakdown.ready++;
    liveTables.add(row.table_id);
  }

  return {
    stats: {
      activeCount: activeRows.length,
      activeBreakdown,
      tablesLive: liveTables.size,
      todayCount: todayRows.length,
      todayRevenue,
      avgPrepMinutes,
      yesterdayCount: yesterdayRows.length,
      yesterdayRevenue,
      avgTicket,
      topItem,
      topSellers,
      serviceLoad: buildServiceLoad(todayRows),
      dailyHistory: buildDailyHistory(
        (weekRes.data ?? []) as {
          created_at: string;
          total: number | string;
          status: string;
        }[]
      ),
    },
    recent: ((recentRes.data ?? []) as OrderRow[]).map(rowToRecent),
    error: null,
  };
}
