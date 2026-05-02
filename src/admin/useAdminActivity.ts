import { useCallback, useEffect, useState } from "react";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import {
  fetchActivity,
  type AuditAction,
  type AuditEntityType,
  type AuditLogEntry,
} from "@/services/activity";

export type { AuditAction, AuditEntityType, AuditLogEntry };

interface UseAdminActivityOptions {
  /** Restrict to a single entity type (null/undefined → all). */
  entityType?: AuditEntityType | null;
  /** Number of rows to load. Default 100 — enough for a working feed. */
  limit?: number;
}

interface UseAdminActivityReturn {
  entries: AuditLogEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Wraps the activity-log fetch with React state + realtime so the
 * Activity page picks up new entries live as triggers fire on writes
 * elsewhere in the admin.
 */
export function useAdminActivity({
  entityType,
  limit = 100,
}: UseAdminActivityOptions = {}): UseAdminActivityReturn {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const result = await fetchActivity({ entityType, limit });
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setEntries(result.entries);
  }, [entityType, limit]);

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

  // Realtime: every INSERT into audit_log refreshes the list. The feed
  // is small (100-row limit) and inserts are infrequent, so a full
  // refetch is simpler than splicing payloads in.
  useRealtimeTables({
    channel: "admin-activity",
    tables: ["audit_log"],
    onChange: () => {
      void refetch();
    },
  });

  return { entries, isLoading, error, refetch };
}
