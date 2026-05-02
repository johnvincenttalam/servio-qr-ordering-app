import { useCallback, useEffect, useState } from "react";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import {
  DEFAULT_DASHBOARD_STATS,
  fetchDashboard,
  type DashboardStats,
  type RecentOrder,
  type TopSeller,
} from "@/services/dashboard";

export type { DashboardStats, RecentOrder, TopSeller };

interface UseDashboardStatsReturn {
  stats: DashboardStats;
  recent: RecentOrder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboardStats(): UseDashboardStatsReturn {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_DASHBOARD_STATS);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const result = await fetchDashboard();
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setStats(result.stats);
    setRecent(result.recent);
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
    tables: ["orders", "order_items"],
    onChange: () => refetch(),
  });

  return { stats, recent, isLoading, error, refetch };
}
