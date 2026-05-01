import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  Activity,
  ChefHat,
  ChevronRight,
  CornerDownLeft,
  Image as ImageIcon,
  LayoutDashboard,
  ListOrdered,
  QrCode,
  Search,
  Tag,
  Users,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { ADMIN_STATUS_LABEL, ADMIN_STATUS_PILL } from "../orderStatus";
import type { AdminOrderStatus } from "../useAdminOrders";

type Result =
  | { kind: "page"; id: string; label: string; icon: LucideIcon; route: string; hint?: string }
  | { kind: "item"; id: string; name: string; categoryLabel: string; image: string; route: string }
  | { kind: "order"; id: string; tableId: string; customerName: string | null; status: AdminOrderStatus; route: string }
  | { kind: "category"; id: string; label: string; route: string }
  | { kind: "banner"; id: string; title: string; route: string }
  | { kind: "table"; id: string; label: string; route: string };

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Global ⌘K search/jump palette for admin. Lazily fetches lightweight
 * summary rows from the entities the current user has permission for,
 * groups them by kind, and lets the operator jump anywhere in 2-3
 * keystrokes. Refetches on every open — staleness is fine for a
 * navigation tool.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<{
    menuItems: Array<{ id: string; name: string; image: string; category: string }>;
    categories: Array<{ id: string; label: string }>;
    orders: Array<{ id: string; tableId: string; customerName: string | null; status: AdminOrderStatus }>;
    banners: Array<{ id: string; title: string | null; subtitle: string | null }>;
    tables: Array<{ id: string; label: string | null }>;
  }>({ menuItems: [], categories: [], orders: [], banners: [], tables: [] });
  const [isFetching, setIsFetching] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset query each time the palette opens — empty by default mirrors
  // what the operator usually wants (browse pages, not last query).
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightIndex(0);
      // Defer focus to next frame so the dialog's own focus handling
      // doesn't race us.
      const id = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [open]);

  // Lazy fetch when the palette opens. Each query is tiny (<= 100 rows
  // of a few columns each) so the round trip is fine; we don't bother
  // with realtime — the palette is a navigation tool, not live state.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsFetching(true);
    (async () => {
      const adminFetches = isAdmin
        ? Promise.all([
            supabase
              .from("menu_items")
              .select("id, name, image, category")
              .is("archived_at", null)
              .order("name", { ascending: true })
              .limit(100),
            supabase
              .from("categories")
              .select("id, label")
              .is("archived_at", null)
              .order("position", { ascending: true })
              .limit(50),
            // Banners are hard-deleted, not soft-archived — no
            // archived_at filter to apply.
            supabase
              .from("banners")
              .select("id, title, subtitle")
              .order("position", { ascending: true })
              .limit(50),
            supabase
              .from("tables")
              .select("id, label")
              .is("archived_at", null)
              .order("id", { ascending: true })
              .limit(100),
          ])
        : Promise.resolve(null);
      const ordersFetch = supabase
        .from("orders")
        .select("id, table_id, customer_name, status")
        .order("created_at", { ascending: false })
        .limit(50);

      const [adminResult, ordersResult] = await Promise.all([
        adminFetches,
        ordersFetch,
      ]);
      if (cancelled) return;
      setItems({
        menuItems:
          adminResult?.[0].data?.map((r: { id: string; name: string; image: string; category: string }) => r) ?? [],
        categories:
          adminResult?.[1].data?.map((r: { id: string; label: string }) => r) ?? [],
        banners:
          adminResult?.[2].data?.map((r: { id: string; title: string | null; subtitle: string | null }) => r) ?? [],
        tables:
          adminResult?.[3].data?.map((r: { id: string; label: string | null }) => r) ?? [],
        orders:
          (ordersResult.data ?? []).map((r: { id: string; table_id: string; customer_name: string | null; status: AdminOrderStatus }) => ({
            id: r.id,
            tableId: r.table_id,
            customerName: r.customer_name,
            status: r.status,
          })),
      });
      setIsFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isAdmin]);

  // Build the page list. visibleFor mirrors the Sidebar logic so the
  // palette never lists a destination the user can't actually reach.
  const pages: Result[] = useMemo(() => {
    const all: Array<Result & { allowedRoles?: string[] }> = [
      { kind: "page", id: "dashboard", label: "Dashboard", icon: LayoutDashboard, route: "/admin" },
      { kind: "page", id: "orders", label: "Orders", icon: ListOrdered, route: "/admin/orders" },
      { kind: "page", id: "menu", label: "Menu", icon: UtensilsCrossed, route: "/admin/menu", allowedRoles: ["admin"] },
      { kind: "page", id: "categories", label: "Categories", icon: Tag, route: "/admin/categories", allowedRoles: ["admin"] },
      { kind: "page", id: "banners", label: "Banners", icon: ImageIcon, route: "/admin/banners", allowedRoles: ["admin"] },
      { kind: "page", id: "tables", label: "Tables", icon: QrCode, route: "/admin/tables", allowedRoles: ["admin"] },
      { kind: "page", id: "staff", label: "Staff", icon: Users, route: "/admin/staff", allowedRoles: ["admin"] },
      { kind: "page", id: "activity", label: "Activity", icon: Activity, route: "/admin/activity", allowedRoles: ["admin"] },
      { kind: "page", id: "kitchen", label: "Kitchen Display", icon: ChefHat, route: "/kitchen", allowedRoles: ["admin", "kitchen"], hint: "Opens in this tab" },
    ];
    return all
      .filter((p) => !p.allowedRoles || (role && p.allowedRoles.includes(role)))
      .map(({ allowedRoles: _ignored, ...p }) => p);
  }, [role]);

  const categoryLabelById = useMemo(() => {
    const map = new Map(items.categories.map((c) => [c.id, c.label]));
    return (id: string) => map.get(id) ?? id;
  }, [items.categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s: string | null | undefined) =>
      !!s && s.toLowerCase().includes(q);

    const groups: Array<{ heading: string; results: Result[] }> = [];

    // Pages — always visible. When q is empty, show all; when q matches,
    // filter by label.
    const pageMatches = q
      ? pages.filter((p) => p.kind === "page" && match(p.label))
      : pages;
    if (pageMatches.length > 0) {
      groups.push({ heading: "Pages", results: pageMatches });
    }

    if (q) {
      const itemMatches: Result[] = items.menuItems
        .filter((it) => match(it.name))
        .slice(0, 8)
        .map((it) => ({
          kind: "item",
          id: it.id,
          name: it.name,
          categoryLabel: categoryLabelById(it.category),
          image: it.image,
          route: "/admin/menu",
        }));
      if (itemMatches.length > 0) {
        groups.push({ heading: "Menu items", results: itemMatches });
      }

      const orderMatches: Result[] = items.orders
        .filter(
          (o) =>
            match(o.id) ||
            match(o.tableId) ||
            match(o.customerName)
        )
        .slice(0, 6)
        .map((o) => ({
          kind: "order",
          id: o.id,
          tableId: o.tableId,
          customerName: o.customerName,
          status: o.status,
          route: "/admin/orders",
        }));
      if (orderMatches.length > 0) {
        groups.push({ heading: "Orders", results: orderMatches });
      }

      const categoryMatches: Result[] = items.categories
        .filter((c) => match(c.label))
        .slice(0, 6)
        .map((c) => ({
          kind: "category",
          id: c.id,
          label: c.label,
          route: "/admin/categories",
        }));
      if (categoryMatches.length > 0) {
        groups.push({ heading: "Categories", results: categoryMatches });
      }

      const bannerMatches: Result[] = items.banners
        .filter((b) => match(b.title) || match(b.subtitle))
        .slice(0, 6)
        .map((b) => ({
          kind: "banner",
          id: b.id,
          title: b.title ?? "Untitled banner",
          route: "/admin/banners",
        }));
      if (bannerMatches.length > 0) {
        groups.push({ heading: "Banners", results: bannerMatches });
      }

      const tableMatches: Result[] = items.tables
        .filter((t) => match(t.id) || match(t.label))
        .slice(0, 6)
        .map((t) => ({
          kind: "table",
          id: t.id,
          label: t.label ?? `Table ${t.id}`,
          route: "/admin/tables",
        }));
      if (tableMatches.length > 0) {
        groups.push({ heading: "Tables", results: tableMatches });
      }
    }

    return groups;
  }, [query, pages, items, categoryLabelById]);

  const flatResults = useMemo(
    () => filtered.flatMap((g) => g.results),
    [filtered]
  );

  // Reset highlight whenever the result set changes.
  useEffect(() => {
    setHighlightIndex(0);
  }, [query, flatResults.length]);

  const handleSelect = useCallback(
    (result: Result) => {
      onOpenChange(false);
      navigate(result.route);
    },
    [navigate, onOpenChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) =>
        flatResults.length === 0 ? 0 : Math.min(i + 1, flatResults.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const result = flatResults[highlightIndex];
      if (result) handleSelect(result);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-black/30 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-[18%] z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl bg-card text-foreground shadow-2xl ring-1 ring-foreground/10 outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0",
            "sm:max-w-xl"
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>

          {/* Search input row */}
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.2} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, menu items, orders…"
              className="h-12 w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
              aria-label="Search"
            />
            <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
              Esc
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <EmptyResults isFetching={isFetching} hasQuery={query.trim().length > 0} />
            ) : (
              filtered.map((group) => (
                <div key={group.heading} className="py-1">
                  <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.heading}
                  </div>
                  <ul role="listbox">
                    {group.results.map((result) => {
                      const flatIndex = flatResults.indexOf(result);
                      const isHighlighted = flatIndex === highlightIndex;
                      return (
                        <li key={`${result.kind}-${result.id}`}>
                          <ResultRow
                            result={result}
                            highlighted={isHighlighted}
                            onSelect={() => handleSelect(result)}
                            onHover={() => setHighlightIndex(flatIndex)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          {/* Footer hint row */}
          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd>
                  <CornerDownLeft className="h-3 w-3" strokeWidth={2.2} />
                </Kbd>
                Open
              </span>
            </div>
            <span className="hidden items-center gap-1 sm:flex">
              <Kbd>Esc</Kbd>
              Close
            </span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ResultRow({
  result,
  highlighted,
  onSelect,
  onHover,
}: {
  result: Result;
  highlighted: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={highlighted}
      onClick={onSelect}
      onMouseMove={onHover}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
        highlighted ? "bg-muted" : "hover:bg-muted/60"
      )}
    >
      <ResultLeading result={result} />
      <div className="min-w-0 flex-1">
        <ResultBody result={result} />
      </div>
      <ChevronRight
        className={cn(
          "h-4 w-4 shrink-0 transition-opacity",
          highlighted ? "opacity-70" : "opacity-30"
        )}
        strokeWidth={2.2}
      />
    </button>
  );
}

function ResultLeading({ result }: { result: Result }) {
  if (result.kind === "page") {
    const Icon = result.icon;
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/80">
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
    );
  }
  if (result.kind === "item") {
    return (
      <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-muted">
        {result.image ? (
          <img src={result.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <Utensils className="m-auto h-4 w-4 text-foreground/60" strokeWidth={2.2} />
        )}
      </span>
    );
  }
  if (result.kind === "order") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-extrabold tabular-nums">
        {result.tableId}
      </span>
    );
  }
  if (result.kind === "category") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/80">
        <Tag className="h-4 w-4" strokeWidth={2.2} />
      </span>
    );
  }
  if (result.kind === "banner") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/80">
        <ImageIcon className="h-4 w-4" strokeWidth={2.2} />
      </span>
    );
  }
  // table
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/80">
      <QrCode className="h-4 w-4" strokeWidth={2.2} />
    </span>
  );
}

function ResultBody({ result }: { result: Result }) {
  if (result.kind === "page") {
    return (
      <div className="flex items-baseline gap-2">
        <p className="truncate text-sm font-semibold leading-tight">
          {result.label}
        </p>
        {result.hint && (
          <p className="truncate text-[11px] text-muted-foreground">
            {result.hint}
          </p>
        )}
      </div>
    );
  }
  if (result.kind === "item") {
    return (
      <div>
        <p className="truncate text-sm font-semibold leading-tight">{result.name}</p>
        <p className="mt-0.5 truncate text-[11px] uppercase tracking-wider text-muted-foreground">
          {result.categoryLabel}
        </p>
      </div>
    );
  }
  if (result.kind === "order") {
    return (
      <div>
        <p className="flex items-baseline gap-2 truncate text-sm font-semibold leading-tight">
          <span className="truncate">{result.customerName ?? "Guest"}</span>
          <span className="font-mono text-[10px] font-medium text-muted-foreground">
            {result.id}
          </span>
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className={cn(
              "rounded-full px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider",
              ADMIN_STATUS_PILL[result.status]
            )}
          >
            {ADMIN_STATUS_LABEL[result.status]}
          </span>
          <span>Table {result.tableId}</span>
        </p>
      </div>
    );
  }
  if (result.kind === "category" || result.kind === "table") {
    return (
      <p className="truncate text-sm font-semibold leading-tight">
        {result.label}
      </p>
    );
  }
  // banner
  return (
    <p className="truncate text-sm font-semibold leading-tight">{result.title}</p>
  );
}

function EmptyResults({
  isFetching,
  hasQuery,
}: {
  isFetching: boolean;
  hasQuery: boolean;
}) {
  if (isFetching) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        Searching…
      </p>
    );
  }
  return (
    <p className="py-8 text-center text-xs text-muted-foreground">
      {hasQuery ? "No matches found" : "Type to search"}
    </p>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-card px-1 text-[10px] font-semibold text-foreground">
      {children}
    </kbd>
  );
}
