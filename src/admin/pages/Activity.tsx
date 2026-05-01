import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Image as ImageIcon,
  QrCode,
  Tag,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/utils";
import { AdminEmptyState } from "../components/AdminEmptyState";
import {
  useAdminActivity,
  type AuditEntityType,
  type AuditLogEntry,
} from "../useAdminActivity";

/**
 * Visual config for each entity type that can show up in the feed.
 * The icon and tone double as the filter chip's identity, so the
 * tone names map to the same brand classes used elsewhere.
 */
const ENTITY_META: Record<
  AuditEntityType,
  { label: string; icon: LucideIcon; tone: string }
> = {
  menu_item: {
    label: "Menu",
    icon: UtensilsCrossed,
    tone: "bg-info/15 text-info",
  },
  category: {
    label: "Categories",
    icon: Tag,
    tone: "bg-foreground/10 text-foreground",
  },
  banner: {
    label: "Banners",
    icon: ImageIcon,
    tone: "bg-warning/25 text-foreground",
  },
  table: {
    label: "Tables",
    icon: QrCode,
    tone: "bg-foreground/10 text-foreground",
  },
  waiter_call: {
    label: "Calls",
    icon: Bell,
    tone: "bg-success/15 text-success",
  },
};

const ENTITY_TYPES: AuditEntityType[] = [
  "menu_item",
  "category",
  "banner",
  "table",
  "waiter_call",
];

type Filter = "all" | AuditEntityType;

export default function ActivityPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { entries, isLoading } = useAdminActivity({
    entityType: filter === "all" ? null : filter,
    limit: 200,
  });
  const [now, setNow] = useState(() => Date.now());

  // Tick relative timestamps so "5 min ago" doesn't go stale.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const counts = useMemo(() => {
    const out: Record<Filter, number> = {
      all: entries.length,
      menu_item: 0,
      category: 0,
      banner: 0,
      table: 0,
      waiter_call: 0,
    };
    // When a type filter is active the entries list is already
    // narrowed, so the counts row only shows the active bucket
    // accurately. That's an acceptable trade-off vs. running a
    // separate count query.
    for (const e of entries) out[e.entityType]++;
    return out;
  }, [entries]);

  // Group entries by day so the feed reads as a timeline.
  const groups = useMemo(() => {
    const byDay = new Map<string, AuditLogEntry[]>();
    for (const e of entries) {
      const key = dayKey(e.createdAt);
      const list = byDay.get(key) ?? [];
      list.push(e);
      byDay.set(key, list);
    }
    return Array.from(byDay.entries()).map(([key, items]) => ({
      key,
      label: dayLabel(key, now),
      items,
    }));
  }, [entries, now]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Admin
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who changed what, across menu, categories, banners, tables, and calls.
        </p>
      </header>

      <Filters filter={filter} onChange={setFilter} counts={counts} />

      {isLoading ? (
        <ListSkeleton />
      ) : entries.length === 0 ? (
        <AdminEmptyState
          icon={Activity}
          title="Nothing yet"
          description="Once admins start editing things, the timeline fills in here."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h2>
              <ul className="space-y-2">
                {group.items.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} now={now} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Filters({
  filter,
  onChange,
  counts,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
  counts: Record<Filter, number>;
}) {
  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    ...ENTITY_TYPES.map((id) => ({ id, label: ENTITY_META[id].label })),
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const isActive = filter === tab.id;
        const showCount = tab.id === "all" || isActive;
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
            {showCount && counts[tab.id] > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums",
                  isActive ? "bg-background/15" : "bg-muted"
                )}
              >
                {counts[tab.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function EntryRow({ entry, now }: { entry: AuditLogEntry; now: number }) {
  const meta = ENTITY_META[entry.entityType];
  const Icon = meta.icon;
  const actor = entry.actorEmail
    ? entry.actorEmail.split("@")[0]
    : "Someone";

  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          meta.tone
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">
          {entry.summary}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{actor}</span>
          <span aria-hidden>·</span>
          <span>{formatRelative(entry.createdAt, now)}</span>
          <span aria-hidden>·</span>
          <span className="font-mono text-[10px]">{entry.entityId}</span>
        </p>
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
        >
          <div className="h-9 w-9 shrink-0 rounded-xl bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-3/5 rounded bg-muted" />
            <div className="h-3 w-2/5 rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Date grouping helpers — local-time day boundaries, with friendly
// labels for the most-recent two days plus weekday context for the
// rest of the week.
// ─────────────────────────────────────────────────────────────────────

function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(key: string, now: number): string {
  const [yStr, mStr, dStr] = key.split("-");
  const day = new Date(Number(yStr), Number(mStr), Number(dStr));
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === yesterday.getTime()) return "Yesterday";

  const ageDays = Math.floor((today.getTime() - day.getTime()) / 86_400_000);
  if (ageDays < 7) {
    return day.toLocaleDateString(undefined, { weekday: "long" });
  }
  return day.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: day.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}
