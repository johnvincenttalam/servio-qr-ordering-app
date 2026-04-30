import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import type { OrderStatus } from "@/types";

export interface DashboardStats {
  activeCount: number;
  todayCount: number;
  todayRevenue: number;
  avgPrepMinutes: number | null;
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

const ACTIVE: OrderStatus[] = ["pending", "preparing", "ready"];

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

interface UseDashboardStatsReturn {
  stats: DashboardStats;
  recent: RecentOrder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboardStats(): UseDashboardStatsReturn {
  const [stats, setStats] = useState<DashboardStats>({
    activeCount: 0,
    todayCount: 0,
    todayRevenue: 0,
    avgPrepMinutes: null,
  });
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const today = startOfTodayIso();

    const [todayRes, activeRes, recentRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, status, total, created_at, ready_at")
        .gte("created_at", today),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ACTIVE),
      supabase
        .from("orders")
        .select("id, table_id, status, total, customer_name, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (todayRes.error || activeRes.error || recentRes.error) {
      const e = todayRes.error || activeRes.error || recentRes.error;
      setError(e?.message ?? "Failed to load stats");
      return;
    }

    const todayRows = (todayRes.data ?? []) as OrderRow[];
    const todayRevenue = todayRows.reduce((sum, r) => sum + Number(r.total), 0);

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

    setStats({
      activeCount: activeRes.count ?? 0,
      todayCount: todayRows.length,
      todayRevenue,
      avgPrepMinutes,
    });

    setRecent(
      ((recentRes.data ?? []) as OrderRow[]).map((r) => ({
        id: r.id,
        tableId: r.table_id,
        status: r.status,
        total: Number(r.total),
        customerName: r.customer_name,
        createdAt: new Date(r.created_at).getTime(),
      }))
    );
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refetch();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  useRealtimeTables({
    channel: "admin-dashboard",
    tables: ["orders"],
    onChange: () => refetch(),
  });

  return { stats, recent, isLoading, error, refetch };
}
