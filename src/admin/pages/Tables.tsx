import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  QrCode,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAdminTables, type AdminTable } from "../useAdminTables";
import { ConfirmFooterRow } from "../components/ConfirmFooterRow";
import { TableEditor } from "./TableEditor";

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
    countActiveOrders,
  } = useAdminTables();

  const [filter, setFilter] = useState<Filter>("active");
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const active = items.filter((t) => !t.archivedAt).length;
    const archived = items.length - active;
    return { active, archived, all: items.length };
  }, [items]);

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
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.active} active
            {counts.archived > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-foreground">
                  {counts.archived}
                </span>{" "}
                archived
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
          onEdit={(t) => setEditTargetId(t.id)}
          onArchive={(id) => setArchiveTargetId(id)}
          onRestore={restore}
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
  onEdit,
  onArchive,
  onRestore,
}: {
  items: AdminTable[];
  onEdit: (t: AdminTable) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((table) => (
        <TableCard
          key={table.id}
          table={table}
          onEdit={() => onEdit(table)}
          onArchive={() => onArchive(table.id)}
          onRestore={() => onRestore(table.id)}
        />
      ))}
    </ul>
  );
}

function TableCard({
  table,
  onEdit,
  onArchive,
  onRestore,
}: {
  table: AdminTable;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const isArchived = !!table.archivedAt;
  return (
    <li
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-foreground/20",
        isArchived && "opacity-65"
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
        <span className="text-base font-extrabold tracking-tight">
          {table.id}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">
          {table.label}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <QrCode className="h-3 w-3 shrink-0" strokeWidth={2.2} />
          {isArchived ? "Archived" : "Ready for QR"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {!isArchived ? (
          <>
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
    </li>
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
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        {filter === "archived"
          ? "Nothing archived."
          : filter === "all"
          ? "No tables yet."
          : "No active tables — add one to start accepting orders."}
      </p>
      {filter !== "archived" && (
        <button
          type="button"
          onClick={onAdd}
          className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
        >
          Add table
        </button>
      )}
    </div>
  );
}
