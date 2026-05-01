import { useEffect } from "react";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";
import { setCurrencySymbol } from "@/utils";

/**
 * Hydrates module-level state from the restaurant_settings row so
 * non-React callsites (toast strings inside hooks, etc.) read the live
 * value of formatPrice's currency. Renders nothing — just an effect
 * that reacts to the settings hook updating.
 *
 * Mounted near the root inside <AuthProvider> so it runs as soon as
 * the app is interactive and re-runs when realtime pushes a change.
 */
export function SettingsBoot() {
  const { settings } = useRestaurantSettings();

  useEffect(() => {
    setCurrencySymbol(settings.currencySymbol);
  }, [settings.currencySymbol]);

  return null;
}
