import { useState } from "react";
import {
  AlertCircle,
  Plus,
  ArrowUp,
  ArrowDown,
  Pencil,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAdminBanners,
  type AdminBanner,
} from "../useAdminBanners";
import { BannerEditor } from "./BannerEditor";

type DrawerState =
  | { mode: "edit"; banner: AdminBanner }
  | { mode: "create" }
  | null;

export default function BannersPage() {
  const {
    items,
    isLoading,
    error,
    setActive,
    save,
    create,
    remove,
    move,
  } = useAdminBanners();
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const total = items.length;
  const activeCount = items.filter((b) => b.active).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Banners
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Banners</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} {total === 1 ? "banner" : "banners"}
            {total > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-foreground">
                  {activeCount}
                </span>{" "}
                live
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
          Add banner
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
        <Empty onAdd={() => setDrawer({ mode: "create" })} />
      ) : (
        <ul className="space-y-2">
          {items.map((banner, i) => (
            <BannerRow
              key={banner.id}
              banner={banner}
              isFirst={i === 0}
              isLast={i === items.length - 1}
              onToggle={(v) => setActive(banner.id, v)}
              onEdit={() => setDrawer({ mode: "edit", banner })}
              onMoveUp={() => move(banner.id, "up")}
              onMoveDown={() => move(banner.id, "down")}
            />
          ))}
        </ul>
      )}

      <BannerEditor
        open={drawer !== null}
        banner={drawer?.mode === "edit" ? drawer.banner : null}
        onClose={() => setDrawer(null)}
        onSave={async (draft) => {
          if (drawer?.mode === "edit") {
            await save(drawer.banner.id, draft);
          } else {
            await create(draft);
          }
        }}
        onDelete={
          drawer?.mode === "edit"
            ? () => remove(drawer.banner.id)
            : undefined
        }
      />
    </div>
  );
}

function BannerRow({
  banner,
  isFirst,
  isLast,
  onToggle,
  onEdit,
  onMoveUp,
  onMoveDown,
}: {
  banner: AdminBanner;
  isFirst: boolean;
  isLast: boolean;
  onToggle: (active: boolean) => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <li
      style={
        { viewTransitionName: `banner-${banner.id}` } as React.CSSProperties
      }
      className={cn(
        "flex items-center gap-3 rounded-3xl border border-border bg-card p-3 transition-colors hover:border-foreground/20",
        !banner.active && "opacity-70"
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2 rounded-2xl"
        aria-label={`Edit ${banner.title ?? "banner"}`}
      >
        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
          {banner.image ? (
            <img
              src={banner.image}
              alt={banner.title ?? "Banner"}
              loading="lazy"
              className={cn(
                "h-full w-full object-cover",
                !banner.active && "grayscale opacity-70"
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-5 w-5" strokeWidth={1.6} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight">
            {banner.title || (
              <span className="italic text-muted-foreground">
                Untitled banner
              </span>
            )}
          </h3>
          {banner.subtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {banner.subtitle}
            </p>
          )}
        </div>
      </button>

      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Move up"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Move down"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      </div>

      <ActiveSwitch
        active={banner.active}
        onChange={onToggle}
        title={banner.title ?? "banner"}
      />

      <button
        type="button"
        onClick={onEdit}
        title="Edit"
        aria-label="Edit banner"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
      </button>
    </li>
  );
}

function ActiveSwitch({
  active,
  onChange,
  title,
}: {
  active: boolean;
  onChange: (value: boolean) => void;
  title: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={
        active
          ? `${title} live — click to hide`
          : `${title} hidden — click to make live`
      }
      onClick={() => onChange(!active)}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2",
        active ? "bg-success" : "bg-muted-foreground/30"
      )}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-white transition-transform",
          active ? "translate-x-5" : "translate-x-0"
        )}
        aria-hidden
      />
    </button>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3"
        >
          <div className="h-16 w-28 shrink-0 rounded-2xl bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
          <div className="h-6 w-11 rounded-full bg-muted" />
          <div className="h-9 w-9 rounded-full bg-muted" />
        </li>
      ))}
    </ul>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <ImageIcon className="h-6 w-6 text-foreground/70" strokeWidth={1.8} />
      </span>
      <div className="space-y-1">
        <h2 className="text-base font-bold">No banners yet</h2>
        <p className="text-sm text-muted-foreground">
          Promo banners show in a carousel at the top of the customer menu.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
        Add banner
      </button>
    </div>
  );
}
