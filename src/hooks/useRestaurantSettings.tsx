import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";

export type QrRotationCadence = "off" | "weekly" | "monthly";

export interface RestaurantSettings {
  name: string;
  currencySymbol: string;
  openForOrders: boolean;
  requireCustomerName: boolean;
  defaultPrepMinutes: number;
  /**
   * When on, customer sessions start unseated and need an admin Seat
   * action before orders can be placed. Off-by-default so existing
   * venues keep the trust-by-default model.
   */
  requireSeatedSession: boolean;
  /**
   * How often the daily cron rotates QR tokens. "off" = manual only.
   * Each rotation invalidates printed stickers — the Tables page
   * surfaces a "reprint needed" banner and bulk-print action so the
   * cost stays manageable.
   */
  qrRotationCadence: QrRotationCadence;
  /**
   * IANA timezone (e.g., "Asia/Manila") the business_hours rows are
   * interpreted in. Single value for v1 — multi-tenant SaaS would
   * lift it per restaurant_settings row.
   */
  timezone: string;
  /**
   * Stop accepting new orders this many minutes before close_time.
   * 0 = no last call. Single value applies to all weekdays.
   */
  lastCallMinutesBeforeClose: number;
  updatedAt: number;
}

interface RestaurantSettingsRow {
  id: number;
  name: string;
  currency_symbol: string;
  open_for_orders: boolean;
  require_customer_name: boolean;
  default_prep_minutes: number;
  require_seated_session: boolean | null;
  qr_rotation_cadence: QrRotationCadence | null;
  timezone: string | null;
  last_call_minutes_before_close: number | null;
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
  requireSeatedSession: false,
  qrRotationCadence: "off",
  timezone: "Asia/Manila",
  lastCallMinutesBeforeClose: 0,
  updatedAt: 0,
};

function rowToSettings(row: RestaurantSettingsRow): RestaurantSettings {
  return {
    name: row.name,
    currencySymbol: row.currency_symbol,
    openForOrders: row.open_for_orders,
    requireCustomerName: row.require_customer_name,
    defaultPrepMinutes: row.default_prep_minutes,
    requireSeatedSession: row.require_seated_session ?? false,
    qrRotationCadence: row.qr_rotation_cadence ?? "off",
    timezone: row.timezone ?? "Asia/Manila",
    lastCallMinutesBeforeClose: row.last_call_minutes_before_close ?? 0,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

interface RestaurantSettingsContextValue {
  settings: RestaurantSettings;
  isLoading: boolean;
}

const RestaurantSettingsContext =
  createContext<RestaurantSettingsContextValue | null>(null);

/**
 * Provider that owns the single Supabase realtime subscription and
 * fetch for restaurant_settings. Multiple components can call
 * useRestaurantSettings() — they all read from this provider's context
 * instead of each opening a new channel (which Supabase rejects with
 * "cannot add postgres_changes callbacks after subscribe()").
 *
 * Mounted at the App root so both customer routes (which need
 * openForOrders / requireCustomerName) and admin routes (which need
 * the full settings) share one subscription.
 */
export function RestaurantSettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
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
          "id, name, currency_symbol, open_for_orders, require_customer_name, default_prep_minutes, require_seated_session, qr_rotation_cadence, timezone, last_call_minutes_before_close, updated_at"
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

  return (
    <RestaurantSettingsContext.Provider value={{ settings, isLoading }}>
      {children}
    </RestaurantSettingsContext.Provider>
  );
}

interface UseRestaurantSettingsReturn {
  settings: RestaurantSettings;
  isLoading: boolean;
}

/**
 * Read the current restaurant settings from the provider. Falls back
 * to DEFAULT_RESTAURANT_SETTINGS when called outside the provider so
 * tests / orphan renders don't crash.
 */
export function useRestaurantSettings(): UseRestaurantSettingsReturn {
  const ctx = useContext(RestaurantSettingsContext);
  if (!ctx) {
    return { settings: DEFAULT_RESTAURANT_SETTINGS, isLoading: false };
  }
  return ctx;
}
