import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";

/**
 * One row of the audit_log table. action mirrors the trigger TG_OP
 * tag; entityType identifies which trigger fired so the UI can icon
 * + filter the feed without having to inspect the JSON payloads.
 */
export type AuditEntityType =
  | "menu_item"
  | "category"
  | "banner"
  | "table"
  | "waiter_call";

export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

export interface AuditLogEntry {
  id: number;
  actorId: string | null;
  actorEmail: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: number;
}

interface AuditLogRow {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

function rowToEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    before: row.before,
    after: row.after,
    createdAt: new Date(row.created_at).getTime(),
  };
}

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
 * Fetches recent audit_log rows newest-first and subscribes to
 * postgres_changes so newly-inserted entries flow in live. The
 * trigger functions populate the table on every meaningful write,
 * so this hook is purely read-side.
 */
export function useAdminActivity({
  entityType,
  limit = 100,
}: UseAdminActivityOptions = {}): UseAdminActivityReturn {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    let q = supabase
      .from("audit_log")
      .select(
        "id, actor_id, actor_email, action, entity_type, entity_id, summary, before, after, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (entityType) {
      q = q.eq("entity_type", entityType);
    }

    const { data, error: queryError } = await q;
    if (queryError) {
      console.error("[admin/activity] fetch failed:", queryError);
      setError(queryError.message);
      return;
    }
    setError(null);
    setEntries(((data ?? []) as AuditLogRow[]).map(rowToEntry));
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
