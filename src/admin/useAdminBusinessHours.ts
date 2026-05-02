import { useCallback } from "react";
import { toast } from "sonner";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import {
  saveBusinessHoursDay,
  type BusinessHoursDay,
  type Weekday,
} from "@/services/businessHours";

interface UseAdminBusinessHoursReturn {
  hours: Record<Weekday, BusinessHoursDay>;
  isLoading: boolean;
  /** Persist a single day's edits. Realtime in BusinessHoursProvider syncs the cache. */
  saveDay: (day: BusinessHoursDay) => Promise<void>;
}

/**
 * Admin wrapper over the shared business-hours provider — adds the
 * authenticated UPDATE path. Reads come from the same context every
 * customer-facing component uses, so a save here repaints the closed
 * banner everywhere via the existing realtime subscription.
 */
export function useAdminBusinessHours(): UseAdminBusinessHoursReturn {
  const { hours, isLoading } = useBusinessHours();

  const saveDay = useCallback(async (day: BusinessHoursDay) => {
    const { error } = await saveBusinessHoursDay(day);
    if (error) {
      console.error("[admin/businessHours] save failed:", error);
      toast.error("Couldn't save hours — try again");
      throw error;
    }
  }, []);

  return { hours, isLoading, saveDay };
}
