import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  AlertCircle,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminMenu } from "../useAdminMenu";
import { InlinePriceEdit } from "../components/InlinePriceEdit";
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
    setPrice,
    saveItem,
    createItem,
    archiveItem,
  } = useAdminMenu();

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

  // ⌘K / Ctrl+K to focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
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

  return (
    <div className="space-y-6">
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
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              categoryLabel={labelFor(item.category)}
              showCategory={filter === "all"}
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
              onToggleStock={(value) => setInStock(item.id, value)}
              onSetPrice={(price) => setPrice(item.id, price)}
              onEdit={() => setDrawer({ mode: "edit", item })}
            />
          ))}
        </ul>
      )}

      <MenuItemEditor
        open={drawer !== null}
        item={drawer?.mode === "edit" ? drawer.item : null}
        categories={categories}
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
  onToggleStock,
  onSetPrice,
  onEdit,
}: {
  item: MenuItem;
  categoryLabel: string;
  showCategory: boolean;
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
        !inStock && "border-l-4 border-l-destructive"
      )}
    >
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

function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const options: { id: ViewMode; icon: typeof List; label: string }[] = [
    { id: "list", icon: List, label: "List view" },
    { id: "grid", icon: LayoutGrid, label: "Grid view" },
  ];
  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex rounded-full bg-muted p-0.5"
    >
      {options.map(({ id, icon: Icon, label }) => {
        const isActive = mode === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={isActive}
            title={label}
            aria-label={label}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-95",
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </button>
        );
      })}
    </div>
  );
}

function MenuItemCard({
  item,
  categoryLabel,
  showCategory,
  onToggleStock,
  onSetPrice,
  onEdit,
}: {
  item: MenuItem;
  categoryLabel: string;
  showCategory: boolean;
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
        !inStock && "border-l-4 border-l-destructive"
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${item.name}`}
        className="relative aspect-[4/3] overflow-hidden bg-muted text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30"
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
        {item.topPick && (
          <span
            className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-foreground"
            title="Top pick"
          >
            <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />
            Top pick
          </span>
        )}
        {!inStock && (
          <span className="absolute right-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Sold out
          </span>
        )}
      </button>

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
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        {isFiltering ? "No items match your filters." : "No menu items yet."}
      </p>
      {isFiltering && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted active:scale-95"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
