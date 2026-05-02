import { useCallback, useEffect, useState } from "react";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import {
  DEFAULT_DASHBOARD_STATS,
  fetchDashboard,
  type DashboardRange,
  type DashboardStats,
  type HourlyPoint,
  type RecentOrder,
  type ServiceLoad,
  type TopSeller,
} from "@/services/dashboard";

export type {
  DashboardRange,
  DashboardStats,
  HourlyPoint,
  RecentOrder,
  ServiceLoad,
  TopSeller,
};

interface UseDashboardStatsReturn {
  stats: DashboardStats;
  recent: RecentOrder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Range determines the period window for the headline metrics
 * (period totals, comparison delta, top sellers, avg prep / avg
 * ticket). Service load + sparkline trail "today" / "last 7 days"
 * regardless — they answer different questions.
 */
export function useDashboardStats(
  range: DashboardRange = "today"
): UseDashboardStatsReturn {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_DASHBOARD_STATS);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const result = await fetchDashboard(range);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setStats(result.stats);
    setRecent(result.recent);
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
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
    tables: ["orders", "order_items"],
    onChange: () => refetch(),
  });

  return { stats, recent, isLoading, error, refetch };
}
