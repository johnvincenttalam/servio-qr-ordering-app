/**
 * Activity-log data layer — read-only. Audit_log rows are inserted
 * exclusively by Postgres triggers (see migrations/0015_audit_log.sql)
 * so there are no write APIs here.
 */
import { supabase } from "@/lib/supabase";

export type AuditEntityType =
  | "menu_item"
  | "category"
  | "banner"
  | "table"
  | "waiter_call";

export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

/**
 * One row of the audit_log table. action mirrors the trigger TG_OP
 * tag; entityType identifies which trigger fired so the UI can icon
 * + filter the feed without inspecting the JSON payloads.
 */
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

export interface ActivityFetchResult {
  entries: AuditLogEntry[];
  error: string | null;
}

interface FetchActivityOptions {
  /** Restrict to a single entity type (null/undefined → all). */
  entityType?: AuditEntityType | null;
  /** Number of rows to load. Default 100. */
  limit?: number;
}

export async function fetchActivity({
  entityType,
  limit = 100,
}: FetchActivityOptions = {}): Promise<ActivityFetchResult> {
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

  const { data, error } = await q;
  if (error) {
    console.error("[services/activity] fetch failed:", error);
    return { entries: [], error: error.message };
  }
  return {
    entries: ((data ?? []) as AuditLogRow[]).map(rowToEntry),
    error: null,
  };
}
