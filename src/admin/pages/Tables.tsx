import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Clock,
  LogOut,
  Pause,
  Pencil,
  Play,
  Plus,
  QrCode,
  UserCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils";
import { useAdminTables, type AdminTable } from "../useAdminTables";
import { useTableSessions, type TableSession } from "../useTableSessions";
import {
  useCustomerSessions,
  type AdminCustomerSession,
} from "../useCustomerSessions";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";
import { AdminEmptyState } from "../components/AdminEmptyState";
import { ConfirmFooterRow } from "../components/ConfirmFooterRow";
import { TableEditor } from "./TableEditor";
import { TableQrModal } from "./TableQrModal";

type Filter = "active" | "archived" | "all";

export default function TablesPage() {
  const {
    items,
    isLoading,
    error,
    create,
    saveLabel,
    archive,
    restore,
    rotateToken,
    pause,
    resume,
    countActiveOrders,
  } = useAdminTables();

  const { sessions } = useTableSessions();
  const customerSessions = useCustomerSessions();
  const { settings } = useRestaurantSettings();

  const [filter, setFilter] = useState<Filter>("active");
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);
  const [qrTargetId, setQrTargetId] = useState<string | null>(null);

  // Tick "open 24m" labels on each card without requiring the sessions
  // hook to refetch. 30s is enough resolution for human-scale "how long
  // has this party been here" reading.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const counts = useMemo(() => {
    const active = items.filter((t) => !t.archivedAt).length;
    const archived = items.length - active;
    const live = items.filter(
      (t) => !t.archivedAt && (sessions.get(t.id)?.activeCount ?? 0) > 0
    ).length;
    return { active, archived, all: items.length, live };
  }, [items, sessions]);

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (filter === "active") return !t.archivedAt;
      if (filter === "archived") return !!t.archivedAt;
      return true;
    });
  }, [items, filter]);

  const editTarget = editTargetId
    ? items.find((t) => t.id === editTargetId) ?? null
    : null;
  const archiveTarget = archiveTargetId
    ? items.find((t) => t.id === archiveTargetId) ?? null
    : null;
  const qrTarget = qrTargetId
    ? items.find((t) => t.id === qrTargetId) ?? null
    : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tables
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Tables
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            {counts.live > 0 && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
                  </span>
                  <span className="font-semibold text-foreground">
                    {counts.live}
                  </span>{" "}
                  live
                </span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>
              {counts.active} active
            </span>
            {counts.archived > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>
                  <span className="font-semibold text-foreground">
                    {counts.archived}
                  </span>{" "}
                  archived
                </span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          Add table
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <FilterChips filter={filter} onChange={setFilter} counts={counts} />

      {isLoading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <Empty
          filter={filter}
          onAdd={() => setCreating(true)}
        />
      ) : (
        <TablesGrid
          items={filtered}
          sessions={sessions}
          customerSessions={customerSessions.byTableId}
          requireSeatedSession={settings.requireSeatedSession}
          now={now}
          onEdit={(t) => setEditTargetId(t.id)}
          onArchive={(id) => setArchiveTargetId(id)}
          onRestore={restore}
          onPause={pause}
          onResume={resume}
          onSeat={customerSessions.seat}
          onBump={customerSessions.bump}
          onShowQr={(id) => setQrTargetId(id)}
        />
      )}

      <TableEditor
        open={creating || editTarget !== null}
        table={editTarget}
        isNew={creating}
        existingIds={items.map((t) => t.id)}
        onClose={() => {
          setCreating(false);
          setEditTargetId(null);
        }}
        onCreate={create}
        onSaveLabel={saveLabel}
      />

      <ArchiveDialog
        target={archiveTarget}
        countActiveOrders={countActiveOrders}
        onClose={() => setArchiveTargetId(null)}
        onConfirm={async (id) => {
          await archive(id);
          setArchiveTargetId(null);
        }}
      />

      <TableQrModal
        open={qrTarget !== null}
        table={qrTarget}
        onClose={() => setQrTargetId(null)}
        onRotate={rotateToken}
      />
    </div>
  );
}

function ArchiveDialog({
  target,
  countActiveOrders,
  onClose,
  onConfirm,
}: {
  target: AdminTable | null;
  countActiveOrders: (id: string) => Promise<number>;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [activeCount, setActiveCount] = useState<number | null>(null);

  // Look up the active-order count whenever a fresh target opens. The
  // count is shown as a warning if the table still has unfinished orders
  // — archiving doesn't break anything, but operators should know.
  useEffect(() => {
    if (!target) {
      setActiveCount(null);
      return;
    }
    let cancelled = false;
    countActiveOrders(target.id).then((n) => {
      if (!cancelled) setActiveCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [target, countActiveOrders]);

  const handle = async () => {
    if (!target || pending) return;
    setPending(true);
    try {
      await onConfirm(target.id);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o && !pending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!pending}
        className="w-[calc(100%-2rem)] gap-0 rounded-3xl p-0 sm:w-full sm:max-w-md"
      >
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Archive
          </DialogDescription>
          <DialogTitle className="text-xl font-bold leading-tight">
            Hide {target?.id} from customers
          </DialogTitle>
        </DialogHeader>

        {target && (
          <div className="space-y-3 px-5 py-4 text-sm">
            <p className="text-foreground">
              Customers scanning the QR for{" "}
              <span className="font-bold">{target.id}</span> will see "Invalid
              table" until you restore it.
            </p>

            {activeCount !== null && activeCount > 0 && (
              <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/15 p-3 text-xs text-foreground">
                <AlertCircle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  strokeWidth={2.4}
                />
                <p>
                  <span className="font-bold">
                    {activeCount} active order{activeCount === 1 ? "" : "s"}
                  </span>{" "}
                  on this table. Existing orders keep their status; only new
                  scans are blocked.
                </p>
              </div>
            )}
          </div>
        )}

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          {target ? (
            <ConfirmFooterRow
              question={
                <>
                  Archive <span className="font-bold">{target.id}</span>?
                </>
              }
              cancelLabel="Keep"
              confirmLabel="Archive"
              pendingLabel="Archiving…"
              pending={pending}
              onCancel={onClose}
              onConfirm={handle}
            />
          ) : null}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function FilterChips({
  filter,
  onChange,
  counts,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
  counts: { active: number; archived: number; all: number };
}) {
  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "active", label: "Active", count: counts.active },
    { id: "archived", label: "Archived", count: counts.archived },
    { id: "all", label: "All", count: counts.all },
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const isActive = filter === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={isActive}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors active:scale-95",
              isActive
                ? "bg-foreground text-background"
                : "bg-card text-foreground/70 border border-border hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums",
                isActive ? "bg-background/15" : "bg-muted"
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TablesGrid({
  items,
  sessions,
  customerSessions,
  requireSeatedSession,
  now,
  onEdit,
  onArchive,
  onRestore,
  onPause,
  onResume,
  onSeat,
  onBump,
  onShowQr,
}: {
  items: AdminTable[];
  sessions: Map<string, TableSession>;
  customerSessions: Map<string, AdminCustomerSession>;
  requireSeatedSession: boolean;
  now: number;
  onEdit: (t: AdminTable) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onSeat: (sessionId: string) => Promise<void>;
  onBump: (sessionId: string) => Promise<void>;
  onShowQr: (id: string) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((table) => (
        <TableCard
          key={table.id}
          table={table}
          session={sessions.get(table.id) ?? null}
          customerSession={customerSessions.get(table.id) ?? null}
          requireSeatedSession={requireSeatedSession}
          now={now}
          onEdit={() => onEdit(table)}
          onArchive={() => onArchive(table.id)}
          onRestore={() => onRestore(table.id)}
          onPause={() => onPause(table.id)}
          onResume={() => onResume(table.id)}
          onSeat={onSeat}
          onBump={onBump}
          onShowQr={() => onShowQr(table.id)}
        />
      ))}
    </ul>
  );
}

/**
 * Format the age of an active session as the "OPEN" stat. We round to
 * the nearest minute so the value doesn't flicker every second; for
 * sessions over an hour we switch to "Xh Ym" so the column doesn't
 * read "127m" once the dinner crowd is locked in.
 */
function formatOpenAge(start: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  if (seconds < 60) return "<1m";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

function TableCard({
  table,
  session,
  customerSession,
  requireSeatedSession,
  now,
  onEdit,
  onArchive,
  onRestore,
  onPause,
  onResume,
  onSeat,
  onBump,
  onShowQr,
}: {
  table: AdminTable;
  session: TableSession | null;
  customerSession: AdminCustomerSession | null;
  requireSeatedSession: boolean;
  now: number;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onPause: () => void;
  onResume: () => void;
  onSeat: (sessionId: string) => Promise<void>;
  onBump: (sessionId: string) => Promise<void>;
  onShowQr: () => void;
}) {
  const isArchived = !!table.archivedAt;
  const isPaused = !isArchived && !!table.pausedAt;
  const isLive = !isArchived && session !== null && session.activeCount > 0;
  const needsSeating =
    !isArchived &&
    requireSeatedSession &&
    customerSession !== null &&
    !customerSession.seated;

  return (
    <li
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border bg-card p-3 transition-colors",
        isArchived
          ? "border-border opacity-65"
          : isPaused
          ? "border-warning/50 bg-warning/5"
          : needsSeating
          ? "border-info/50 bg-info/5"
          : isLive
          ? "border-success/40 hover:border-success/60"
          : "border-border hover:border-foreground/20"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onShowQr}
          disabled={isArchived}
          title={isArchived ? "Archived — restore to print QR" : "Open QR sticker"}
          aria-label={`Open QR for ${table.id}`}
          className={cn(
            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-colors",
            !isArchived &&
              "hover:bg-foreground/90 active:scale-95 cursor-pointer",
            isArchived && "cursor-not-allowed bg-muted text-foreground"
          )}
        >
          <span className="text-base font-extrabold tracking-tight">
            {table.id}
          </span>
          {isLive && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5"
              aria-hidden
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">
            {table.label}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            {isPaused ? (
              <>
                <Pause className="h-3 w-3 shrink-0 text-warning" strokeWidth={2.4} />
                <span className="font-semibold text-foreground">Paused</span>
                <span aria-hidden>·</span>
                <span>blocking new orders</span>
              </>
            ) : isLive ? (
              <>
                <span className="font-semibold text-success">Live</span>
                <span aria-hidden>·</span>
                {session!.activeCount}{" "}
                {session!.activeCount === 1 ? "order" : "orders"}
              </>
            ) : (
              <>
                <QrCode className="h-3 w-3 shrink-0" strokeWidth={2.2} />
                {isArchived
                  ? "Archived"
                  : table.qrToken
                  ? "Token live"
                  : "No token"}
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!isArchived ? (
            <>
              <button
                type="button"
                onClick={onShowQr}
                aria-label={`QR for ${table.id}`}
                title="Show QR"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-muted hover:text-foreground active:scale-95"
              >
                <QrCode className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
              {isPaused ? (
                <button
                  type="button"
                  onClick={onResume}
                  aria-label={`Resume ${table.id}`}
                  title="Resume — accept orders again"
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-warning/50 bg-warning/15 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-warning/25 active:scale-95"
                >
                  <Play className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPause}
                  aria-label={`Pause ${table.id}`}
                  title="Pause — block new orders without rotating the QR token"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-warning/50 hover:bg-warning/10 hover:text-foreground active:scale-95"
                >
                  <Pause className="h-3.5 w-3.5" strokeWidth={2.2} />
                </button>
              )}
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${table.id}`}
                title="Edit label"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-muted hover:text-foreground active:scale-95"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
              <button
                type="button"
                onClick={onArchive}
                aria-label={`Archive ${table.id}`}
                title="Archive"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive active:scale-95"
              >
                <Archive className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onRestore}
              aria-label={`Restore ${table.id}`}
              title="Restore"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground active:scale-95"
            >
              <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={2.2} />
              Restore
            </button>
          )}
        </div>
      </div>

      {customerSession && !isArchived && (
        <CustomerSessionStrip
          customerSession={customerSession}
          requireSeatedSession={requireSeatedSession}
          now={now}
          onSeat={() => onSeat(customerSession.id)}
          onBump={() => onBump(customerSession.id)}
        />
      )}

      {isLive && session && (
        <SessionStrip session={session} now={now} />
      )}
    </li>
  );
}

/**
 * Compact strip surfacing the customer's *visit* (customer_sessions row),
 * distinct from the SessionStrip below which renders order-activity stats.
 * Shows seated state, the elapsed time since scan, and the Seat / Bump
 * actions when relevant. Hidden entirely when there's no active visit.
 */
function CustomerSessionStrip({
  customerSession,
  requireSeatedSession,
  now,
  onSeat,
  onBump,
}: {
  customerSession: AdminCustomerSession;
  requireSeatedSession: boolean;
  now: number;
  onSeat: () => Promise<void>;
  onBump: () => Promise<void>;
}) {
  const elapsed = formatOpenAge(customerSession.createdAt, now);
  const needsSeating = requireSeatedSession && !customerSession.seated;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-2.5 py-1.5",
        needsSeating
          ? "border border-info/40 bg-info/10"
          : "bg-muted/40"
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          needsSeating ? "bg-info text-white" : "bg-foreground/10 text-foreground"
        )}
        aria-hidden="true"
      >
        <UserCheck className="h-3 w-3" strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold leading-tight">
          {needsSeating ? "Waiting to be seated" : "Seated"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          scanned {elapsed} ago
        </p>
      </div>
      {needsSeating ? (
        <button
          type="button"
          onClick={onSeat}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-info px-2.5 text-[11px] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95"
        >
          <UserCheck aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
          Seat
        </button>
      ) : (
        <button
          type="button"
          onClick={onBump}
          aria-label="End this customer's session"
          title="End this customer's session"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive active:scale-95"
        >
          <LogOut aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

function SessionStrip({
  session,
  now,
}: {
  session: TableSession;
  now: number;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2.5"
      aria-label="Live session stats"
    >
      <Stat label="Items" value={String(session.itemCount)} />
      <Stat label="Tab" value={formatPrice(session.total)} />
      <Stat
        label="Open"
        value={formatOpenAge(session.oldestCreatedAt, now)}
        icon={Clock}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Clock;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-sm font-bold tabular-nums">
        {Icon && (
          <Icon
            className="h-3 w-3 shrink-0 text-muted-foreground"
            strokeWidth={2.4}
          />
        )}
        <span className="truncate">{value}</span>
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
        >
          <div className="h-12 w-12 shrink-0 rounded-xl bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-1/2 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
          <div className="h-8 w-8 rounded-full bg-muted" />
        </li>
      ))}
    </ul>
  );
}

function Empty({
  filter,
  onAdd,
}: {
  filter: Filter;
  onAdd: () => void;
}) {
  if (filter === "archived") {
    return (
      <AdminEmptyState
        icon={Archive}
        title="Nothing archived"
        description="Archived tables show up here. Restore them anytime."
        tone="neutral"
        compact
      />
    );
  }
  return (
    <AdminEmptyState
      icon={QrCode}
      title={filter === "all" ? "No tables yet" : "No active tables"}
      description="Each table gets its own QR code so guests can order without an app."
      actionLabel="Add table"
      onAction={onAdd}
    />
  );
}
