import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";

export interface RestaurantSettings {
  name: string;
  currencySymbol: string;
  openForOrders: boolean;
  requireCustomerName: boolean;
  defaultPrepMinutes: number;
  updatedAt: number;
}

interface RestaurantSettingsRow {
  id: number;
  name: string;
  currency_symbol: string;
  open_for_orders: boolean;
  require_customer_name: boolean;
  default_prep_minutes: number;
  updated_at: string;
}

/**
 * Hard-coded fallbacks used while the singleton row hasn't loaded yet
 * (or if the migration hasn't been applied). These match the defaults
 * the migration sets so the experience is the same either way.
 */
export const DEFAULT_RESTAURANT_SETTINGS: RestaurantSettings = {
  name: "SERVIO",
  currencySymbol: "₱",
  openForOrders: true,
  requireCustomerName: false,
  defaultPrepMinutes: 9,
  updatedAt: 0,
};

function rowToSettings(row: RestaurantSettingsRow): RestaurantSettings {
  return {
    name: row.name,
    currencySymbol: row.currency_symbol,
    openForOrders: row.open_for_orders,
    requireCustomerName: row.require_customer_name,
    defaultPrepMinutes: row.default_prep_minutes,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

interface UseRestaurantSettingsReturn {
  settings: RestaurantSettings;
  isLoading: boolean;
}

/**
 * Read-only hook that returns the current restaurant settings. Subscribes
 * to postgres_changes on the singleton row so an admin flipping
 * "open for orders" propagates to all open customer tabs without a
 * manual refresh. Falls back to DEFAULT_RESTAURANT_SETTINGS while loading.
 */
export function useRestaurantSettings(): UseRestaurantSettingsReturn {
  const [settings, setSettings] = useState<RestaurantSettings>(
    DEFAULT_RESTAURANT_SETTINGS
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("restaurant_settings")
        .select(
          "id, name, currency_symbol, open_for_orders, require_customer_name, default_prep_minutes, updated_at"
        )
        .eq("id", 1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // Migration not applied yet, or RLS blocks. Keep defaults.
        console.warn("[settings] fetch failed:", error.message);
      } else if (data) {
        setSettings(rowToSettings(data as RestaurantSettingsRow));
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useRealtimeTables({
    channel: "restaurant-settings",
    tables: ["restaurant_settings"],
    onChange: (_table, payload) => {
      const next = (payload.new ?? null) as RestaurantSettingsRow | null;
      if (next) setSettings(rowToSettings(next));
    },
  });

  return { settings, isLoading };
}
