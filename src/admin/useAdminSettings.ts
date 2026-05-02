import { useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  useRestaurantSettings,
  type RestaurantSettings,
} from "@/hooks/useRestaurantSettings";

/**
 * Partial settings update — only the fields the admin actually changed
 * are sent so partial saves can stay scoped per section.
 */
export type SettingsUpdate = Partial<
  Omit<RestaurantSettings, "updatedAt">
>;

interface UseAdminSettingsReturn {
  settings: RestaurantSettings;
  isLoading: boolean;
  /** Persist a partial update and surface a toast on error. */
  update: (next: SettingsUpdate) => Promise<void>;
}

/**
 * Admin-side wrapper around useRestaurantSettings that adds an
 * authenticated update path. The realtime subscription in the
 * underlying hook handles re-syncing the form once the write lands.
 */
export function useAdminSettings(): UseAdminSettingsReturn {
  const { settings, isLoading } = useRestaurantSettings();

  const update = useCallback(async (next: SettingsUpdate) => {
    const { data: userData } = await supabase.auth.getUser();
    const payload: Record<string, unknown> = {
      updated_by: userData.user?.id ?? null,
    };
    if (next.name !== undefined) payload.name = next.name;
    if (next.currencySymbol !== undefined)
      payload.currency_symbol = next.currencySymbol;
    if (next.openForOrders !== undefined)
      payload.open_for_orders = next.openForOrders;
    if (next.requireCustomerName !== undefined)
      payload.require_customer_name = next.requireCustomerName;
    if (next.defaultPrepMinutes !== undefined)
      payload.default_prep_minutes = next.defaultPrepMinutes;
    if (next.requireSeatedSession !== undefined)
      payload.require_seated_session = next.requireSeatedSession;

    const { error } = await supabase
      .from("restaurant_settings")
      .update(payload)
      .eq("id", 1);

    if (error) {
      console.error("[admin/settings] update failed:", error);
      toast.error("Couldn't save settings — try again");
      throw error;
    }
  }, []);

  return { settings, isLoading, update };
}
