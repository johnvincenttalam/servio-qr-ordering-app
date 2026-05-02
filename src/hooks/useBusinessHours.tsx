import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  computeOpenStatus,
  defaultHours,
  fetchBusinessHours,
  type BusinessHoursDay,
  type OpenStatus,
  type Weekday,
} from "@/services/businessHours";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";

interface BusinessHoursContextValue {
  hours: Record<Weekday, BusinessHoursDay>;
  isLoading: boolean;
}

const BusinessHoursContext = createContext<BusinessHoursContextValue | null>(
  null
);

/**
 * Provider that owns the single Supabase realtime subscription for
 * business_hours. Mirrors the RestaurantSettingsProvider pattern: one
 * channel for the whole app, mounted at App root, so multiple components
 * can read hours without colliding on the postgres_changes subscription.
 */
export function BusinessHoursProvider({ children }: { children: ReactNode }) {
  const [hours, setHours] = useState<Record<Weekday, BusinessHoursDay>>(() =>
    defaultHours()
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchBusinessHours();
      if (cancelled) return;
      setHours(result.hours);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch on any change. The table is small (7 rows) so the round-trip
  // is cheaper than splicing payload deltas.
  useRealtimeTables({
    channel: "business-hours",
    tables: ["business_hours"],
    onChange: () => {
      void (async () => {
        const result = await fetchBusinessHours();
        setHours(result.hours);
      })();
    },
  });

  return (
    <BusinessHoursContext.Provider value={{ hours, isLoading }}>
      {children}
    </BusinessHoursContext.Provider>
  );
}

export function useBusinessHours() {
  const ctx = useContext(BusinessHoursContext);
  if (!ctx) {
    return { hours: defaultHours(), isLoading: false };
  }
  return ctx;
}

/**
 * Composite hook — combines the schedule with current settings (timezone,
 * override, last-call) into a live OpenStatus that re-evaluates every
 * minute. Customer-side ClosedPage and admin Settings status banner
 * both consume this.
 */
export function useOpenStatus(): OpenStatus {
  const { settings } = useRestaurantSettings();
  const { hours } = useBusinessHours();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // 30s tick is fine — open/close transitions are wall-clock
    // events, but a 30s lag at the boundary is acceptable for the
    // customer-facing "we're closed" banner.
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(
    () =>
      computeOpenStatus({
        openForOrders: settings.openForOrders,
        timezone: settings.timezone,
        lastCallMinutes: settings.lastCallMinutesBeforeClose,
        hours,
        now,
      }),
    [settings, hours, now]
  );
}
