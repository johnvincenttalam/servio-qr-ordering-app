import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import {
  fetchBlockedDevices,
  unblockDevice,
  type BlockedDevice,
} from "@/services/blocklist";

interface UseBlockedDevicesReturn {
  devices: BlockedDevice[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  unblock: (deviceId: string) => Promise<void>;
}

/**
 * Wraps fetchBlockedDevices + realtime so the panel updates live when
 * a block lands from another tab or another admin's session. Mirrors
 * the useAdminActivity / useWaiterCalls pattern.
 */
export function useBlockedDevices(): UseBlockedDevicesReturn {
  const [devices, setDevices] = useState<BlockedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const result = await fetchBlockedDevices();
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setDevices(result.devices);
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
    channel: "admin-blocklist",
    tables: ["device_blocklist"],
    onChange: () => {
      void refetch();
    },
  });

  const unblock = useCallback(
    async (deviceId: string) => {
      // Optimistic removal so the row disappears immediately. The
      // realtime listener will reconcile if the delete fails for
      // another reason (RLS, network).
      setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
      try {
        await unblockDevice(deviceId);
        toast.success("Device unblocked");
      } catch (err) {
        console.error("[admin/blocklist] unblock failed:", err);
        toast.error("Couldn't unblock device");
        await refetch();
      }
    },
    [refetch]
  );

  return { devices, isLoading, error, refetch, unblock };
}
