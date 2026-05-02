import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  Archive,
  ArchiveRestore,
  Circle,
  LogOut,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Printer,
  QrCode,
  RotateCw,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { Menu } from "@base-ui/react/menu";
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
import { openStickerPrintWindow, renderQrSvg } from "../qrPrint";
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
    markPrinted,
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

  // Tables whose qr_token has rotated since their last printed sticker.
  // Drives the reprint-needed banner + per-card badge.
  const needsReprint = useMemo(
    () =>
      items.filter(
        (t) =>
          !t.archivedAt &&
          t.qrToken !== null &&
          t.qrToken !== t.printedToken
      ),
    [items]
  );

  const [bulkPrinting, setBulkPrinting] = useState(false);
  const handleBulkPrintReprints = async () => {
    if (bulkPrinting || needsReprint.length === 0) return;
    setBulkPrinting(true);
    try {
      const stickers = await Promise.all(
        needsReprint.map(async (t) => ({
          table: t,
          svgMarkup: await renderQrSvg(t),
        }))
      );
      const opened = openStickerPrintWindow(settings.name, stickers);
      if (!opened) {
        toast.error("Browser blocked the print window.");
        return;
      }
      // Mark each as printed at the token value we just rendered. If
      // the cron rotates again before the operator confirms the print
      // dialog, the next refetch will re-flag any table whose token
      // changed since.
      await Promise.all(
        needsReprint
          .filter((t) => t.qrToken)
          .map((t) => markPrinted(t.id, t.qrToken as string))
      );
      toast.success(`Printing ${stickers.length} sticker${stickers.length === 1 ? "" : "s"}`);
    } catch (err) {
      console.error("[admin/tables] bulk print failed:", err);
      toast.error("Couldn't generate the bulk print.");
    } finally {
      setBulkPrinting(false);
    }
  };

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

      {needsReprint.length > 0 && (
        <ReprintBanner
          count={needsReprint.length}
          pending={bulkPrinting}
          onPrintAll={handleBulkPrintReprints}
        />
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
        onMarkPrinted={markPrinted}
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

function ReprintBanner({
  count,
  pending,
  onPrintAll,
}: {
  count: number;
  pending: boolean;
  onPrintAll: () => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/30 text-foreground">
        <RotateCw aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">
          {count} sticker{count === 1 ? "" : "s"} need reprinting
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          QR tokens rotated since last print. Replace stale stickers before
          customers next scan.
        </p>
      </div>
      <button
        type="button"
        onClick={onPrintAll}
        disabled={pending}
        aria-busy={pending || undefined}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Printer aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
        {pending ? "Preparing…" : "Print all"}
      </button>
    </div>
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

// ─────────────────────────────────────────────────────────────────────
// Card state machine — derived once at the top of TableCard so the
// header pill, status strip, and border tone all read from the same
// truth. Priority order matches operator intent: anything that
// requires staff action (paused / reprint / waiting-to-seat) wins
// over passive states (live / seated / empty).
// ─────────────────────────────────────────────────────────────────────
type CardStateKind =
  | "archived"
  | "paused"
  | "reprint"
  | "waiting"
  | "live"
  | "seated"
  | "empty";

interface StateTone {
  card: string;
  pill: string;
  icon: LucideIcon;
  label: string;
}

const STATE_TONE: Record<CardStateKind, StateTone> = {
  archived: {
    card: "border-border opacity-65",
    pill: "bg-muted text-muted-foreground",
    icon: Archive,
    label: "Archived",
  },
  paused: {
    card: "border-warning/50 bg-warning/5",
    pill: "bg-warning/30 text-foreground",
    icon: Pause,
    label: "Paused",
  },
  reprint: {
    card: "border-warning/40 bg-warning/[0.04]",
    pill: "bg-warning/30 text-foreground",
    icon: RotateCw,
    label: "Reprint",
  },
  waiting: {
    card: "border-info/50 bg-info/5",
    pill: "bg-info text-white",
    icon: UserCheck,
    label: "Waiting",
  },
  live: {
    card: "border-success/40 hover:border-success/60",
    pill: "bg-success text-white",
    icon: Activity,
    label: "Live",
  },
  seated: {
    card: "border-foreground/15 hover:border-foreground/25",
    pill: "bg-foreground text-background",
    icon: UserCheck,
    label: "Seated",
  },
  empty: {
    card: "border-border hover:border-foreground/15",
    pill: "bg-muted text-muted-foreground",
    icon: Circle,
    label: "Empty",
  },
};

function deriveCardState(
  table: AdminTable,
  session: TableSession | null,
  customerSession: AdminCustomerSession | null,
  requireSeatedSession: boolean
): CardStateKind {
  if (table.archivedAt) return "archived";
  if (table.pausedAt) return "paused";
  if (table.qrToken !== null && table.qrToken !== table.printedToken) {
    return "reprint";
  }
  if (
    requireSeatedSession &&
    customerSession !== null &&
    !customerSession.seated
  ) {
    return "waiting";
  }
  if (session !== null && session.activeCount > 0) return "live";
  if (customerSession !== null) return "seated";
  return "empty";
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
  const state = deriveCardState(
    table,
    session,
    customerSession,
    requireSeatedSession
  );
  const tone = STATE_TONE[state];
  const isArchived = state === "archived";

  return (
    <li
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-card transition-colors",
        tone.card
      )}
    >
      {/* ─── Zone 1: Header — identity + state pill ─── */}
      <CardHeader table={table} state={state} tone={tone} onShowQr={onShowQr} />

      {/* ─── Zone 2: Status strip — single contextual line, always present ─── */}
      <CardStatus
        state={state}
        table={table}
        customerSession={customerSession}
        session={session}
        now={now}
        onSeat={onSeat}
        onBump={onBump}
        onResume={onResume}
      />

      {/* ─── Zone 3: Stats footer — always rendered, dim when zero ─── */}
      <CardStats session={session} now={now} />

      {/* ─── Zone 4: Actions ─── */}
      {isArchived ? (
        <div className="flex items-center justify-end border-t border-border/60 bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={onRestore}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground active:scale-95"
          >
            <ArchiveRestore aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
            Restore
          </button>
        </div>
      ) : (
        <CardActions
          table={table}
          state={state}
          onShowQr={onShowQr}
          onPause={onPause}
          onEdit={onEdit}
          onArchive={onArchive}
        />
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Header — identity chip + label + state pill. The pill is the
// glance-from-across-the-room signal; the card border tint reinforces it.
// ─────────────────────────────────────────────────────────────────────
function CardHeader({
  table,
  state,
  tone,
  onShowQr,
}: {
  table: AdminTable;
  state: CardStateKind;
  tone: StateTone;
  onShowQr: () => void;
}) {
  const isArchived = state === "archived";
  const PillIcon = tone.icon;

  return (
    <div className="flex items-center gap-3 p-3">
      <button
        type="button"
        onClick={onShowQr}
        disabled={isArchived}
        title={isArchived ? "Archived — restore to show QR" : "Open QR sticker"}
        aria-label={`Open QR for ${table.id}`}
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-extrabold tracking-tight transition-colors",
          isArchived
            ? "cursor-not-allowed bg-muted text-foreground"
            : "bg-foreground text-background hover:bg-foreground/90 active:scale-95 cursor-pointer"
        )}
      >
        {table.id}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">
          {table.label}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {table.qrToken ? "Token live" : "No token"}
        </p>
      </div>

      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
          tone.pill
        )}
      >
        <PillIcon aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
        {tone.label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Status strip — one row of contextual detail keyed off state. Always
// renders so cards stay equal height; for "empty" it shows a faint
// "no active session" line rather than collapsing.
// ─────────────────────────────────────────────────────────────────────
function CardStatus({
  state,
  table,
  customerSession,
  session,
  now,
  onSeat,
  onBump,
  onResume,
}: {
  state: CardStateKind;
  table: AdminTable;
  customerSession: AdminCustomerSession | null;
  session: TableSession | null;
  now: number;
  onSeat: (sessionId: string) => Promise<void>;
  onBump: (sessionId: string) => Promise<void>;
  onResume: () => void;
}) {
  const sessionAge = customerSession
    ? formatOpenAge(customerSession.createdAt, now)
    : null;

  return (
    <div className="flex min-h-10 items-center gap-2 border-t border-border/60 px-3 py-2 text-[11px]">
      {state === "archived" && (
        <span className="text-muted-foreground">Hidden from customers</span>
      )}

      {state === "paused" && (
        <>
          <span className="flex-1 truncate">
            <span className="font-semibold text-foreground">Paused</span>
            <span className="ml-1 text-muted-foreground">
              · blocking new orders
            </span>
          </span>
          <button
            type="button"
            onClick={onResume}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-warning/20 px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-warning/30 active:scale-95"
          >
            <Play aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
            Resume
          </button>
        </>
      )}

      {state === "reprint" && (
        <>
          <RotateCw aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-warning" strokeWidth={2.4} />
          <span className="flex-1 truncate">
            <span className="font-semibold text-foreground">Reprint needed</span>
            <span className="ml-1 text-muted-foreground">
              · token rotated
            </span>
          </span>
        </>
      )}

      {state === "waiting" && customerSession && (
        <>
          <span className="flex-1 truncate">
            <span className="font-semibold text-foreground">
              Waiting to be seated
            </span>
            {sessionAge && (
              <span className="ml-1 text-muted-foreground">
                · scanned {sessionAge} ago
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => onSeat(customerSession.id)}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-info px-2.5 text-[11px] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95"
          >
            <UserCheck aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
            Seat
          </button>
        </>
      )}

      {state === "live" && (
        <>
          <span className="flex-1 truncate">
            <span className="font-semibold text-foreground">
              {session?.activeCount ?? 0}{" "}
              {session?.activeCount === 1 ? "order" : "orders"}
            </span>
            {sessionAge && (
              <span className="ml-1 text-muted-foreground">
                · scanned {sessionAge} ago
              </span>
            )}
          </span>
          {customerSession && (
            <BumpIcon onBump={() => onBump(customerSession.id)} />
          )}
        </>
      )}

      {state === "seated" && customerSession && (
        <>
          <span className="flex-1 truncate text-muted-foreground">
            <span className="font-semibold text-foreground">Seated</span>
            {sessionAge && (
              <span className="ml-1">· scanned {sessionAge} ago</span>
            )}
          </span>
          <BumpIcon onBump={() => onBump(customerSession.id)} />
        </>
      )}

      {state === "empty" && (
        <span className="text-muted-foreground/80">
          {table.qrToken ? "No active session" : "No QR token yet"}
        </span>
      )}
    </div>
  );
}

function BumpIcon({ onBump }: { onBump: () => Promise<void> }) {
  return (
    <button
      type="button"
      onClick={onBump}
      aria-label="End this customer's session"
      title="End session"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95"
    >
      <LogOut aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Stats footer — Items / Tab / Open. Always renders for layout stability;
// muted em-dashes when there's nothing to show.
// ─────────────────────────────────────────────────────────────────────
function CardStats({
  session,
  now,
}: {
  session: TableSession | null;
  now: number;
}) {
  const hasOrders = session !== null && session.activeCount > 0;
  return (
    <div className="grid grid-cols-3 gap-2 border-t border-border/60 bg-muted/30 px-3 py-2.5">
      <Stat
        label="Items"
        value={hasOrders ? String(session!.itemCount) : "—"}
        dimmed={!hasOrders}
      />
      <Stat
        label="Tab"
        value={hasOrders ? formatPrice(session!.total) : "—"}
        dimmed={!hasOrders}
      />
      <Stat
        label="Open"
        value={hasOrders ? formatOpenAge(session!.oldestCreatedAt, now) : "—"}
        dimmed={!hasOrders}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Actions — QR + Pause/Resume primary, kebab menu for the rest. Pause
// flips into a labeled "Resume" pill when the table is paused so the
// way out is obvious without opening the menu.
// ─────────────────────────────────────────────────────────────────────
function CardActions({
  table,
  state,
  onShowQr,
  onPause,
  onEdit,
  onArchive,
}: {
  table: AdminTable;
  state: CardStateKind;
  onShowQr: () => void;
  onPause: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const isPaused = state === "paused";

  return (
    <div className="flex items-center gap-1.5 border-t border-border/60 bg-muted/30 px-3 py-2">
      <button
        type="button"
        onClick={onShowQr}
        aria-label={`Show QR for ${table.id}`}
        title="Show QR"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
      >
        <QrCode aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
      </button>

      {/* Pause icon only renders while the table is accepting orders.
          When paused, the status strip above carries the Resume CTA,
          so we don't duplicate it here. */}
      {!isPaused && (
        <button
          type="button"
          onClick={onPause}
          aria-label={`Pause ${table.id}`}
          title="Pause — block new orders without rotating the QR token"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-warning/10 hover:text-foreground active:scale-95"
        >
          <Pause aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
        </button>
      )}

      <span className="ml-auto" />

      <CardKebab onEdit={onEdit} onArchive={onArchive} tableId={table.id} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Kebab overflow — base-ui Menu. Holds the lower-frequency actions
// (Edit label, Archive). Keeps the card row clean while leaving the
// rare actions one click away.
// ─────────────────────────────────────────────────────────────────────
function CardKebab({
  onEdit,
  onArchive,
  tableId,
}: {
  onEdit: () => void;
  onArchive: () => void;
  tableId: string;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`More actions for ${tableId}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2"
      >
        <MoreVertical aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="end">
          <Menu.Popup className="z-50 min-w-[160px] origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Menu.Item
              onClick={onEdit}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors data-highlighted:bg-muted"
            >
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
              Edit label
            </Menu.Item>
            <Menu.Item
              onClick={onArchive}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive outline-none transition-colors data-highlighted:bg-destructive/10"
            >
              <Archive aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
              Archive
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function Stat({
  label,
  value,
  dimmed = false,
}: {
  label: string;
  value: string;
  /** Visually mute the value when there's nothing to show (em-dash). */
  dimmed?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-bold tabular-nums",
          dimmed && "text-muted-foreground/50"
        )}
      >
        {value}
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
