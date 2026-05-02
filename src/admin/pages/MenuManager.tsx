import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  AlertCircle,
  Check,
  CheckSquare,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminMenu } from "../useAdminMenu";
import { AdminEmptyState } from "../components/AdminEmptyState";
import { InlinePriceEdit } from "../components/InlinePriceEdit";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { MenuItemEditor } from "./MenuItemEditor";
import type { Category, MenuItem, MenuCategory } from "@/types";

type DrawerState =
  | { mode: "edit"; item: MenuItem }
  | { mode: "create" }
  | null;

type CategoryFilter = MenuCategory | "all";

type ViewMode = "list" | "grid";
const VIEW_MODE_STORAGE_KEY = "servio.admin.menu.view";

export default function MenuManagerPage() {
  const {
    items,
    categories,
    isLoading,
    error,
    setInStock,
    setInStockBulk,
    setPrice,
    saveItem,
    createItem,
    archiveItem,
  } = useAdminMenu();

  // Bulk-edit selection. A Set keeps add/remove O(1) and gives clean
  // size/has reads for rendering selection state on each row.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Quick lookup so item rows can render their category's label without
  // repeating the find. Falls back to the raw id if a category was
  // archived between the row's creation and now.
  const labelFor = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.label]));
    return (id: string) => map.get(id) ?? id;
  }, [categories]);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [soldOutOnly, setSoldOutOnly] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Persist the chosen view mode so admins don't have to re-pick it
  // every visit. Read lazily from localStorage so SSR (if ever) doesn't
  // bork; fall back to "list" which is the legacy default.
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "list";
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === "grid" ? "grid" : "list";
  });
  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  // "/" to focus the in-page search. ⌘K is reserved for the global
  // command palette (mounted at AdminLayout). Skipped while the user
  // is already typing in an input/textarea so it doesn't hijack a
  // literal slash typed into another field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const soldOut = items.filter((i) => i.inStock === false).length;
    return { total, inStock: total - soldOut, soldOut };
  }, [items]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && item.category !== filter) return false;
      if (soldOutOnly && item.inStock !== false) return false;
      if (query) {
        return (
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [items, filter, searchQuery, soldOutOnly]);

  const isFiltering =
    filter !== "all" || soldOutOnly || searchQuery.trim().length > 0;

  const clearFilters = () => {
    setFilter("all");
    setSoldOutOnly(false);
    setSearchQuery("");
  };

  // Esc to drop the selection — convenient when the bulk bar appears
  // and the admin actually meant to do something else.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds.size]);

  const handleBulkSetInStock = async (inStock: boolean) => {
    const ids = Array.from(selectedIds);
    clearSelection();
    await setInStockBulk(ids, inStock);
  };

  // Visible-selection toggle: select all of `filtered` if any are
  // unselected, otherwise clear them. Only applies to the items the
  // admin can currently see, which avoids the surprise of "Select all"
  // also picking up rows hidden by the filter.
  const visibleIds = useMemo(() => filtered.map((it) => it.id), [filtered]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      // Drop only the visible ones — keep any hidden selections intact.
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.add(id);
        return next;
      });
    }
  };

  return (
    <div
      className={cn(
        "space-y-6",
        // Reserve room for the floating bulk-action bar so the last
        // row stays visible when the page is scrolled to the bottom.
        selectedIds.size > 0 && "pb-20"
      )}
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Menu
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Menu manager
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.total} items
            {stats.soldOut > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-foreground">
                  {stats.soldOut}
                </span>{" "}
                sold out
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawer({ mode: "create" })}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          Add item
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <SearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
      />

      {/* Filters row: chips scroll horizontally inside the left flex
          slot while the view toggle stays anchored on the right edge —
          on a long category list, the toggle never scrolls off the
          viewport on mobile. The chip slot's right edge fades to
          transparent so overflowing chips don't hard-clip mid-text
          against the toggle; pr-3 keeps a comfortable gap from the
          toggle when chips fully fit. */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 pr-3 [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)]">
          <CategoryFilters
            categories={categories}
            filter={filter}
            onChange={setFilter}
            count={items.length}
            trailing={
              <SoldOutChip
                active={soldOutOnly}
                onToggle={() => setSoldOutOnly((v) => !v)}
                count={stats.soldOut}
              />
            }
          />
        </div>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {isLoading ? (
        viewMode === "grid" ? <GridSkeleton /> : <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyMessage isFiltering={isFiltering} onClear={clearFilters} />
      ) : (
        <>
          <SelectAllRow
            visibleCount={filtered.length}
            allSelected={allVisibleSelected}
            someSelected={someVisibleSelected}
            onToggle={toggleSelectAllVisible}
          />
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  categoryLabel={labelFor(item.category)}
                  showCategory={filter === "all"}
                  isSelected={selectedIds.has(item.id)}
                  onToggleSelect={() => toggleSelected(item.id)}
                  onToggleStock={(value) => setInStock(item.id, value)}
                  onSetPrice={(price) => setPrice(item.id, price)}
                  onEdit={() => setDrawer({ mode: "edit", item })}
                />
              ))}
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((item) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  categoryLabel={labelFor(item.category)}
                  showCategory={filter === "all"}
                  isSelected={selectedIds.has(item.id)}
                  onToggleSelect={() => toggleSelected(item.id)}
                  onToggleStock={(value) => setInStock(item.id, value)}
                  onSetPrice={(price) => setPrice(item.id, price)}
                  onEdit={() => setDrawer({ mode: "edit", item })}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <BulkActionBar
        count={selectedIds.size}
        onMarkSoldOut={() => handleBulkSetInStock(false)}
        onMarkInStock={() => handleBulkSetInStock(true)}
        onClear={clearSelection}
      />

      <MenuItemEditor
        open={drawer !== null}
        item={drawer?.mode === "edit" ? drawer.item : null}
        categories={categories}
        initialCategory={
          drawer?.mode === "create" && filter !== "all" ? filter : null
        }
        onClose={() => setDrawer(null)}
        onSave={async (draft) => {
          if (drawer?.mode === "edit") {
            await saveItem(drawer.item.id, draft);
          } else {
            await createItem(draft);
          }
        }}
        onArchive={
          drawer?.mode === "edit"
            ? () => archiveItem(drawer.item.id)
            : undefined
        }
      />
    </div>
  );
}

function SearchBar({
  searchQuery,
  onSearchChange,
  searchInputRef,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2.2}
      />
      <input
        ref={searchInputRef}
        type="search"
        inputMode="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search menu…"
        aria-label="Search menu items"
        className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-10 text-sm font-medium text-foreground placeholder:text-muted-foreground transition-colors focus:border-foreground/40 focus:outline-none"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

function SoldOutChip({
  active,
  onToggle,
  count,
}: {
  active: boolean;
  onToggle: () => void;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      disabled={count === 0 && !active}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-destructive text-white"
          : "bg-card text-foreground/70 border border-border hover:border-destructive/40 hover:text-destructive"
      )}
      title={
        count === 0
          ? "No sold-out items"
          : active
          ? "Showing sold out only — click to clear"
          : "Show only sold-out items"
      }
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-white" : "bg-destructive"
        )}
        aria-hidden
      />
      Sold out
      {count > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums",
            active ? "bg-white/20" : "bg-muted"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function CategoryFilters({
  categories,
  filter,
  onChange,
  count,
  trailing,
}: {
  categories: Category[];
  filter: CategoryFilter;
  onChange: (filter: CategoryFilter) => void;
  count: number;
  trailing?: React.ReactNode;
}) {
  const tabs: { id: CategoryFilter; label: string }[] = [
    { id: "all", label: `All (${count})` },
    ...categories.map((c) => ({ id: c.id, label: c.label })),
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors active:scale-95",
            filter === tab.id
              ? "bg-foreground text-background"
              : "bg-card text-foreground/70 border border-border hover:border-foreground/30 hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
      {trailing && (
        <>
          <span
            className="hidden h-5 w-px shrink-0 bg-border sm:block"
            aria-hidden
          />
          {trailing}
        </>
      )}
    </div>
  );
}

function MenuItemRow({
  item,
  categoryLabel,
  showCategory,
  isSelected,
  onToggleSelect,
  onToggleStock,
  onSetPrice,
  onEdit,
}: {
  item: MenuItem;
  categoryLabel: string;
  showCategory: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggleStock: (value: boolean) => void;
  onSetPrice: (price: number) => Promise<void>;
  onEdit: () => void;
}) {
  const inStock = item.inStock !== false;
  const hasOptions = (item.options?.length ?? 0) > 0;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 transition-colors hover:border-foreground/20",
        !inStock && "border-l-4 border-l-destructive",
        isSelected && "border-foreground/60 bg-muted/40 ring-1 ring-foreground/20"
      )}
    >
      <SelectCheckbox selected={isSelected} onChange={onToggleSelect} />
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2"
        aria-label={`Edit ${item.name}`}
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            className={cn(
              "h-full w-full object-cover",
              !inStock && "grayscale opacity-60"
            )}
          />
          {item.topPick && (
            <span
              className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning"
              title="Top pick"
              aria-label="Top pick"
            >
              <Sparkles
                className="h-2 w-2 text-foreground"
                strokeWidth={2.5}
              />
            </span>
          )}
        </div>

        <div className={cn("min-w-0 flex-1", !inStock && "opacity-70")}>
          <h3 className="truncate text-sm font-bold leading-tight">
            {item.name}
          </h3>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            {showCategory && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-0 font-semibold uppercase tracking-wider text-foreground/70">
                {categoryLabel}
              </span>
            )}
            {hasOptions && (
              <span className="shrink-0 font-medium">
                {item.options!.length}{" "}
                {item.options!.length === 1 ? "option" : "options"}
              </span>
            )}
            {!inStock && (
              <span className="shrink-0 font-semibold text-destructive">
                Sold out
              </span>
            )}
          </div>
        </div>
      </button>

      <div className="w-20 shrink-0 text-right text-sm font-semibold">
        <InlinePriceEdit value={item.price} onSave={onSetPrice} />
      </div>

      <StockSwitch
        inStock={inStock}
        onChange={onToggleStock}
        itemName={item.name}
      />

      <button
        type="button"
        onClick={onEdit}
        title="Edit"
        aria-label={`Edit ${item.name}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
      </button>
    </li>
  );
}

function SelectCheckbox({
  selected,
  onChange,
  className,
}: {
  selected: boolean;
  onChange: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onChange}
      title={selected ? "Unselect" : "Select"}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2",
        selected
          ? "bg-foreground text-background"
          : "border border-border bg-card hover:border-foreground/50",
        className
      )}
    >
      {selected && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}

function SelectAllRow({
  visibleCount,
  allSelected,
  someSelected,
  onToggle,
}: {
  visibleCount: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggle: () => void;
}) {
  // Indeterminate state — some but not all visible items selected.
  const indeterminate = someSelected && !allSelected;
  return (
    <div className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
      <button
        type="button"
        role="checkbox"
        aria-checked={allSelected ? true : indeterminate ? "mixed" : false}
        onClick={onToggle}
        title={allSelected ? "Unselect all visible" : "Select all visible"}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2",
          allSelected || indeterminate
            ? "bg-foreground text-background"
            : "border border-border bg-card hover:border-foreground/50"
        )}
      >
        {allSelected ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : indeterminate ? (
          <span className="block h-0.5 w-2.5 rounded bg-background" aria-hidden />
        ) : null}
      </button>
      <span className="font-semibold tracking-wider">
        {allSelected
          ? `All ${visibleCount} selected`
          : someSelected
          ? "Selected"
          : "Select all"}
      </span>
    </div>
  );
}

function BulkActionBar({
  count,
  onMarkSoldOut,
  onMarkInStock,
  onClear,
}: {
  count: number;
  onMarkSoldOut: () => void;
  onMarkInStock: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 animate-fade-up"
    >
      <div className="flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground p-1.5 text-background shadow-2xl">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold">
          <CheckSquare className="h-3.5 w-3.5" strokeWidth={2.4} />
          {count} selected
        </span>
        <span className="h-5 w-px bg-background/20" aria-hidden />
        <button
          type="button"
          onClick={onMarkSoldOut}
          className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-background/10 active:scale-95"
        >
          Mark sold out
        </button>
        <button
          type="button"
          onClick={onMarkInStock}
          className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-background/10 active:scale-95"
        >
          Mark in stock
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          title="Clear selection (Esc)"
          className="flex h-7 w-7 items-center justify-center rounded-full text-background/70 transition-colors hover:bg-background/10 hover:text-background active:scale-95"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function StockSwitch({
  inStock,
  onChange,
  itemName,
}: {
  inStock: boolean;
  onChange: (value: boolean) => void;
  itemName: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={inStock}
      aria-label={
        inStock
          ? `${itemName} is in stock — click to mark sold out`
          : `${itemName} is sold out — click to mark in stock`
      }
      onClick={() => onChange(!inStock)}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2",
        inStock ? "bg-success" : "bg-muted-foreground/30"
      )}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-white transition-transform",
          inStock ? "translate-x-5" : "translate-x-0"
        )}
        aria-hidden
      />
    </button>
  );
}

const VIEW_MODE_OPTIONS = [
  { id: "list" as const, icon: List, label: "List view" },
  { id: "grid" as const, icon: LayoutGrid, label: "Grid view" },
];

function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <SegmentedControl
      value={mode}
      onChange={onChange}
      options={VIEW_MODE_OPTIONS}
      iconOnly
      ariaLabel="View mode"
    />
  );
}

function MenuItemCard({
  item,
  categoryLabel,
  showCategory,
  isSelected,
  onToggleSelect,
  onToggleStock,
  onSetPrice,
  onEdit,
}: {
  item: MenuItem;
  categoryLabel: string;
  showCategory: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggleStock: (value: boolean) => void;
  onSetPrice: (price: number) => Promise<void>;
  onEdit: () => void;
}) {
  const inStock = item.inStock !== false;
  const hasOptions = (item.options?.length ?? 0) > 0;

  return (
    <div
      className={cn(
        "group/card relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/20",
        !inStock && "border-l-4 border-l-destructive",
        isSelected && "border-foreground/60 ring-1 ring-foreground/20"
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${item.name}`}
          className="absolute inset-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30"
        >
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            className={cn(
              "h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105",
              !inStock && "grayscale opacity-60"
            )}
          />
        </button>
        {/* The checkbox sits as an overlay sibling of the image button so
            we don't end up with nested <button> elements. z-10 keeps it
            above the image; stopPropagation isn't needed because the
            buttons aren't ancestors of each other. */}
        <SelectCheckbox
          selected={isSelected}
          onChange={onToggleSelect}
          className="absolute left-2 top-2 z-10"
        />
        {item.topPick && (
          <span
            className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-foreground"
            title="Top pick"
          >
            <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />
            Top pick
          </span>
        )}
        {!inStock && (
          <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Sold out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className={cn("min-w-0", !inStock && "opacity-70")}>
          <h3 className="truncate text-sm font-bold leading-tight">
            {item.name}
          </h3>
          {(showCategory || hasOptions) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {showCategory && (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0 font-semibold uppercase tracking-wider text-foreground/70">
                  {categoryLabel}
                </span>
              )}
              {hasOptions && (
                <span className="shrink-0 font-medium">
                  {item.options!.length}{" "}
                  {item.options!.length === 1 ? "option" : "options"}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <InlinePriceEdit
            value={item.price}
            onSave={onSetPrice}
            className="text-base font-bold"
          />
          <div className="flex items-center gap-2">
            <StockSwitch
              inStock={inStock}
              onChange={onToggleStock}
              itemName={item.name}
            />
            <button
              type="button"
              onClick={onEdit}
              title="Edit"
              aria-label={`Edit ${item.name}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5"
        >
          <div className="h-14 w-14 shrink-0 rounded-xl bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/4 rounded bg-muted" />
          </div>
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-6 w-11 rounded-full bg-muted" />
          <div className="h-8 w-8 rounded-full bg-muted" />
        </li>
      ))}
    </ul>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="aspect-[4/3] w-full bg-muted" />
          <div className="space-y-2 p-3">
            <div className="h-3.5 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="flex items-center justify-between pt-2">
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-11 rounded-full bg-muted" />
                <div className="h-8 w-8 rounded-full bg-muted" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyMessage({
  isFiltering,
  onClear,
}: {
  isFiltering: boolean;
  onClear: () => void;
}) {
  if (isFiltering) {
    return (
      <AdminEmptyState
        icon={Search}
        title="No matches"
        description="Nothing matches your current filters. Clear them to see everything."
        secondaryActionLabel="Clear filters"
        onSecondaryAction={onClear}
        tone="neutral"
        compact
      />
    );
  }
  return (
    <AdminEmptyState
      icon={Plus}
      title="No menu items yet"
      description="Add your first dish so guests can start ordering."
    />
  );
}
