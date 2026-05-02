import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Activity,
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Check,
  Hash,
  MoreVertical,
  Pencil,
  Plus,
  Type,
} from "lucide-react";
import { Menu } from "@base-ui/react/menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AdminEmptyState } from "../components/AdminEmptyState";
import { ConfirmFooterRow } from "../components/ConfirmFooterRow";
import {
  useAdminCategories,
  type CategoryDraft,
} from "../useAdminCategories";
import {
  CATEGORY_ICONS,
  resolveCategoryIcon,
} from "@/lib/categoryIcons";
import type { Category } from "@/types";
import { cn } from "@/lib/utils";

const ID_RE = /^[a-z0-9-]{2,32}$/;
const RESERVED_IDS = new Set(["all", "none", "null", "undefined"]);

/**
 * Convert a human label into a clean URL-safe slug. Decomposes accents
 * ("café" → "cafe"), drops anything that isn't a-z / 0-9, collapses
 * runs of hyphens, trims, and caps at 32 chars to fit the column limit.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    // NFD splits accented letters into base + combining mark, so the
    // base letter survives the next pass while the diacritic gets
    // stripped along with everything else non-alnum.
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export default function CategoriesPage() {
  const {
    items,
    isLoading,
    error,
    create,
    saveDetails,
    archive,
    restore,
    move,
    countItems,
  } = useAdminCategories();

  const [creating, setCreating] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);

  const editTarget = editTargetId
    ? items.find((c) => c.id === editTargetId) ?? null
    : null;
  const archiveTarget = archiveTargetId
    ? items.find((c) => c.id === archiveTargetId) ?? null
    : null;

  const active = useMemo(
    () => items.filter((c) => c.archivedAt === null),
    [items]
  );
  const archived = useMemo(
    () => items.filter((c) => c.archivedAt !== null),
    [items]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Menu
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Categories
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {active.length} active
            {archived.length > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-foreground">
                  {archived.length}
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
          New category
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <Empty onAdd={() => setCreating(true)} />
      ) : (
        <CategoriesList
          items={items}
          activeCount={active.length}
          onEdit={(c) => setEditTargetId(c.id)}
          onArchive={(c) => setArchiveTargetId(c.id)}
          onRestore={restore}
          onMove={move}
        />
      )}

      <CategoryEditor
        open={creating || editTarget !== null}
        category={editTarget}
        isNew={creating}
        existingIds={items.map((c) => c.id)}
        onClose={() => {
          setCreating(false);
          setEditTargetId(null);
        }}
        onCreate={create}
        onSaveDetails={saveDetails}
      />

      <ArchiveDialog
        target={archiveTarget}
        countItems={countItems}
        onClose={() => setArchiveTargetId(null)}
        onConfirm={async (id) => {
          await archive(id);
          setArchiveTargetId(null);
        }}
      />
    </div>
  );
}

function CategoriesList({
  items,
  activeCount,
  onEdit,
  onArchive,
  onRestore,
  onMove,
}: {
  items: Category[];
  activeCount: number;
  onEdit: (c: Category) => void;
  onArchive: (c: Category) => void;
  onRestore: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}) {
  return (
    <ul className="space-y-2">
      {items.map((cat) => {
        const isArchived = cat.archivedAt !== null;
        // Compute up/down enablement against the active subset only.
        const activeIndex = isArchived
          ? -1
          : items.filter((c) => c.archivedAt === null).findIndex((c) => c.id === cat.id);
        const Icon = resolveCategoryIcon(cat.icon);
        return (
          <li
            key={cat.id}
            // View transitions on reorder, mirroring the banners flow.
            style={{ viewTransitionName: `category-${cat.id}` }}
            className={cn(
              "flex items-center gap-3 rounded-2xl border bg-card p-3 transition-colors",
              isArchived
                ? "border-border opacity-65"
                : "border-border hover:border-foreground/20"
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">
                {cat.label}
              </p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <Hash aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={2.2} />
                <span className="font-mono">{cat.id}</span>
              </p>
            </div>

            <StatePill isArchived={isArchived} />

            <div className="flex shrink-0 items-center gap-0.5">
              {isArchived ? (
                <button
                  type="button"
                  onClick={() => onRestore(cat.id)}
                  aria-label={`Restore ${cat.label}`}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground active:scale-95"
                >
                  <ArchiveRestore aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
                  Restore
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onMove(cat.id, "up")}
                    disabled={activeIndex === 0}
                    aria-label={`Move ${cat.label} up`}
                    title="Move up"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(cat.id, "down")}
                    disabled={activeIndex === activeCount - 1}
                    aria-label={`Move ${cat.label} down`}
                    title="Move down"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                  <CategoryKebab
                    label={cat.label}
                    onEdit={() => onEdit(cat)}
                    onArchive={() => onArchive(cat)}
                  />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StatePill({ isArchived }: { isArchived: boolean }) {
  if (isArchived) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Archive aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
        Archived
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success">
      <Activity aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
      Active
    </span>
  );
}

function CategoryKebab({
  label,
  onEdit,
  onArchive,
}: {
  label: string;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`More actions for ${label}`}
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
              Edit
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

function CategoryEditor({
  open,
  category,
  isNew,
  existingIds,
  onClose,
  onCreate,
  onSaveDetails,
}: {
  open: boolean;
  category: Category | null;
  isNew: boolean;
  existingIds: readonly string[];
  onClose: () => void;
  onCreate: (draft: CategoryDraft) => Promise<void>;
  onSaveDetails: (
    id: string,
    fields: { label: string; icon: string | null }
  ) => Promise<void>;
}) {
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  // Null means "no icon picked" → renders the Tag fallback.
  const [icon, setIcon] = useState<string | null>(null);
  // While idTouched is false, the id auto-mirrors a slug of the label.
  // The moment the admin types directly into the id field we stop
  // mirroring so their custom slug isn't overwritten on the next
  // keystroke. Edit mode starts touched (id is fixed and uneditable).
  const [idTouched, setIdTouched] = useState(false);
  const [idCustomizing, setIdCustomizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setId(isNew ? "" : category?.id ?? "");
    setLabel(category?.label ?? "");
    setIcon(category?.icon ?? null);
    setIdTouched(!isNew);
    setIdCustomizing(false);
    setError(null);
    setSubmitting(false);
  }, [open, isNew, category]);

  const handleLabelChange = (next: string) => {
    setLabel(next);
    if (!idTouched) {
      setId(slugify(next));
    }
  };

  const trimmedId = id.trim().toLowerCase();
  const trimmedLabel = label.trim();
  const idValid = ID_RE.test(trimmedId);
  const idReserved = RESERVED_IDS.has(trimmedId);
  const idDuplicate = isNew && existingIds.includes(trimmedId);
  const canSubmit =
    trimmedLabel.length > 0 &&
    (!isNew || (idValid && !idReserved && !idDuplicate));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isNew) {
        await onCreate({ id: trimmedId, label: trimmedLabel, icon });
      } else if (category) {
        await onSaveDetails(category.id, { label: trimmedLabel, icon });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!submitting}
        className="w-[calc(100%-2rem)] gap-0 rounded-3xl p-0 sm:w-full sm:max-w-md"
      >
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isNew ? "New category" : "Edit category"}
          </DialogDescription>
          <DialogTitle className="text-xl font-bold leading-tight">
            {isNew ? "Add a category" : category?.label}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Label
            </label>
            <div className="relative">
              <Type
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2.2}
              />
              <Input
                value={label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="Breakfast"
                required
                maxLength={60}
                className="h-11 rounded-xl pl-9"
                autoFocus
              />
            </div>
          </div>

          {isNew && (
            // ID is auto-derived from the label by default. We only
            // surface the field when the admin opts into customizing,
            // since the value is internal and a slug is almost always
            // fine. Validation errors still always surface so a clash
            // or a label that slugifies to nothing can be fixed.
            <div className="space-y-1.5">
              {!idCustomizing ? (
                <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">
                    ID
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono">
                    <Hash className="h-3 w-3" strokeWidth={2.4} />
                    {trimmedId || "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIdCustomizing(true);
                      setIdTouched(true);
                    }}
                    className="font-semibold text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Customize
                  </button>
                </p>
              ) : (
                <>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    ID{" "}
                    <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">
                      used internally
                    </span>
                  </label>
                  <div className="relative">
                    <Hash
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      strokeWidth={2.2}
                    />
                    <Input
                      value={id}
                      onChange={(e) => {
                        setId(e.target.value.toLowerCase());
                        setIdTouched(true);
                      }}
                      placeholder="breakfast"
                      required
                      maxLength={32}
                      autoCapitalize="none"
                      spellCheck={false}
                      className="h-11 rounded-xl pl-9 lowercase font-mono"
                    />
                  </div>
                </>
              )}
              {trimmedId && !idValid && (
                <p className="text-[11px] text-destructive">
                  2–32 lowercase letters, digits, or hyphens.
                </p>
              )}
              {idReserved && (
                <p className="text-[11px] text-destructive">
                  &ldquo;{trimmedId}&rdquo; is reserved.
                </p>
              )}
              {idDuplicate && (
                <p className="text-[11px] text-destructive">
                  A category with id &ldquo;{trimmedId}&rdquo; already exists.
                </p>
              )}
            </div>
          )}

          <IconPicker value={icon} onChange={setIcon} />

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </form>

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {submitting ? "Saving…" : isNew ? "Create category" : "Save"}
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function IconPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Icon{" "}
        <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">
          shown in tabs and menu rows
        </span>
      </label>
      {/*
        Curated grid — clicking the same tile again clears the selection,
        and the cleared state renders the Tag fallback throughout the app.
      */}
      <div className="grid grid-cols-8 gap-1.5 rounded-2xl border border-border bg-muted/40 p-2">
        {CATEGORY_ICONS.map(({ name, icon: Icon }) => {
          const isActive = value === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(isActive ? null : name)}
              aria-pressed={isActive}
              title={name}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-95",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-transparent bg-card text-foreground/70 hover:border-border hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} />
              {isActive && (
                <Check
                  className="absolute right-0.5 top-0.5 h-2.5 w-2.5"
                  strokeWidth={3}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ArchiveDialog({
  target,
  countItems,
  onClose,
  onConfirm,
}: {
  target: Category | null;
  countItems: (id: string) => Promise<number>;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!target) {
      setCount(null);
      return;
    }
    let cancelled = false;
    countItems(target.id).then((n) => {
      if (!cancelled) setCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [target, countItems]);

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
            Hide {target?.label} from customers
          </DialogTitle>
        </DialogHeader>

        {target && (
          <div className="space-y-3 px-5 py-4 text-sm">
            <p className="text-foreground">
              Customers will no longer see this category in the menu, and
              the manager picker will skip it.
            </p>
            {count !== null && count > 0 && (
              <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/15 p-3 text-xs text-foreground">
                <AlertCircle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  strokeWidth={2.4}
                />
                <p>
                  <span className="font-bold">
                    {count} item{count === 1 ? "" : "s"}
                  </span>{" "}
                  still belong to this category. They&apos;ll stay assigned;
                  reassign them or archive them separately to clean up.
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
                  Archive <span className="font-bold">{target.label}</span>?
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

function ListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
        >
          <div className="h-10 w-10 shrink-0 rounded-xl bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/4 rounded bg-muted" />
          </div>
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="h-8 w-8 rounded-full bg-muted" />
        </li>
      ))}
    </ul>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <AdminEmptyState
      icon={Hash}
      title="No categories yet"
      description="Categories group your menu items — every item belongs to one."
      actionLabel="Create the first"
      onAction={onAdd}
    />
  );
}
