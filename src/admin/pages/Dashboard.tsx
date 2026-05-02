import {
  Receipt,
  Wallet,
  Timer,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  CreditCard,
  Star,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import {
  useDashboardStats,
  type RecentOrder,
  type TopSeller,
} from "../useDashboardStats";
import { ADMIN_STATUS_LABEL, ADMIN_STATUS_PILL } from "../orderStatus";
import { Sparkline } from "@/components/common/Sparkline";
import { cn } from "@/lib/utils";
import { formatPrice, formatRelative } from "@/utils";

/**
 * Pull the first word from displayName, falling back to the email's
 * local-part. Keeps the greeting personal even when no display name
 * is set yet.
 */
function firstNameFrom(
  displayName: string | null,
  email: string | undefined
): string {
  if (displayName) {
    const trimmed = displayName.trim();
    if (trimmed) {
      const first = trimmed.split(/\s+/)[0];
      // Title-case in case the source is lowercase
      return first[0].toUpperCase() + first.slice(1);
    }
  }
  if (email) {
    const local = email.split("@")[0];
    if (local) return local[0].toUpperCase() + local.slice(1);
  }
  return "back";
}

function formatDateEyebrow(now: Date): string {
  return now
    .toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

export default function DashboardPage() {
  const { user, displayName } = useAuth();
  const { stats, recent, isLoading } = useDashboardStats();

  const firstName = firstNameFrom(displayName, user?.email);

  return (
    <div className="space-y-8">
      <Header
        firstName={firstName}
        tablesLive={stats.tablesLive}
        activeCount={stats.activeCount}
        isLoading={isLoading}
      />

      <Stats isLoading={isLoading} stats={stats} />

      <div className="grid gap-3 lg:grid-cols-5">
        {/* Recent activity gets the wider slot — operators glance at it
            most often. The leaderboard panel is the secondary detail
            column at lg+, stacked below on smaller widths. */}
        <div className="lg:col-span-3">
          <RecentActivity orders={recent} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-2">
          <TopSellersPanel
            sellers={stats.topSellers}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

function Header({
  firstName,
  tablesLive,
  activeCount,
  isLoading,
}: {
  firstName: string;
  tablesLive: number;
  activeCount: number;
  isLoading: boolean;
}) {
  const dateLabel = formatDateEyebrow(new Date());
  // Service is "running" whenever there's at least one live table —
  // matches what the operator can see on the Orders page banner. When
  // it's quiet we soften the language so it doesn't read as a problem.
  const running = tablesLive > 0;

  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Dashboard <span className="text-muted-foreground/60">·</span>{" "}
        {dateLabel}
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        Welcome back, {firstName}.
      </h1>
      {!isLoading && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                running ? "bg-success" : "bg-muted-foreground/40"
              )}
              aria-hidden
            />
            {running ? "Service running" : "Service idle"}
          </span>
          {tablesLive > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>
                <span className="font-semibold text-foreground">
                  {tablesLive}
                </span>{" "}
                {tablesLive === 1 ? "table" : "tables"} live
              </span>
            </>
          )}
          {activeCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>
                <span className="font-semibold text-foreground">
                  {activeCount}
                </span>{" "}
                in the kitchen
              </span>
            </>
          )}
        </p>
      )}
    </header>
  );
}

function Stats({
  isLoading,
  stats,
}: {
  isLoading: boolean;
  stats: ReturnType<typeof useDashboardStats>["stats"];
}) {
  const ordersDelta = computeDelta(stats.todayCount, stats.yesterdayCount);
  const revenueDelta = computeDelta(stats.todayRevenue, stats.yesterdayRevenue);

  return (
    <section className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ActiveOrdersHero
          isLoading={isLoading}
          breakdown={stats.activeBreakdown}
          total={stats.activeCount}
        />
        <StatCard
          icon={Receipt}
          label="Today's orders"
          value={isLoading ? "—" : String(stats.todayCount)}
          delta={isLoading ? undefined : ordersDelta}
          subtext="vs yesterday"
          sparkline={
            isLoading ? undefined : stats.dailyHistory.map((d) => d.count)
          }
        />
        <StatCard
          icon={Wallet}
          label="Today's revenue"
          value={isLoading ? "—" : formatPrice(stats.todayRevenue)}
          delta={isLoading ? undefined : revenueDelta}
          subtext="vs yesterday"
          tone="success"
          sparkline={
            isLoading ? undefined : stats.dailyHistory.map((d) => d.revenue)
          }
          sparklineTone="success"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={CreditCard}
          label="Avg ticket"
          value={
            isLoading
              ? "—"
              : stats.avgTicket === null
              ? "—"
              : formatPrice(stats.avgTicket)
          }
          subtext={stats.avgTicket === null ? "No orders yet" : "Per order today"}
        />
        <StatCard
          icon={Star}
          label="Top seller"
          value={isLoading || !stats.topItem ? "—" : stats.topItem.name}
          subtext={
            isLoading || !stats.topItem
              ? "No items sold yet"
              : `${stats.topItem.quantity} sold today`
          }
          compact
          tone="warning"
        />
        <StatCard
          icon={Timer}
          label="Avg prep time"
          value={
            isLoading
              ? "—"
              : stats.avgPrepMinutes === null
              ? "—"
              : `${stats.avgPrepMinutes.toFixed(1)} min`
          }
          subtext={
            stats.avgPrepMinutes === null
              ? "No completed orders"
              : "Order to ready"
          }
        />
      </div>
    </section>
  );
}

/**
 * Featured "Active orders" card. Inverted (dark on dark) so it reads
 * as the primary operational metric, with a status-broken-down chip
 * row inside that mirrors the kitchen display's NEW / COOKING / READY
 * columns. Quiet state collapses to a calm "All caught up" line.
 */
function ActiveOrdersHero({
  isLoading,
  breakdown,
  total,
}: {
  isLoading: boolean;
  breakdown: { pending: number; preparing: number; ready: number };
  total: number;
}) {
  const isQuiet = total === 0 && !isLoading;
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-3xl p-4 transition-colors",
        isQuiet
          ? "border border-border bg-card text-foreground"
          : "border border-foreground bg-foreground text-background"
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          isQuiet ? "text-muted-foreground" : "text-background/60"
        )}
      >
        Active orders
      </p>

      <div>
        <p className="text-4xl font-bold tracking-tight">
          {isLoading ? "—" : total}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs",
            isQuiet ? "text-muted-foreground" : "text-background/70"
          )}
        >
          {isLoading
            ? "Loading…"
            : isQuiet
            ? "All caught up"
            : "In the kitchen right now"}
        </p>
      </div>

      {!isLoading && total > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <BreakdownChip label="New" value={breakdown.pending} tone="warning" />
          <BreakdownChip
            label="Cooking"
            value={breakdown.preparing}
            tone="info"
          />
          <BreakdownChip label="Ready" value={breakdown.ready} tone="success" />
        </div>
      )}
    </div>
  );
}

// Solid status colors matching the kitchen display + order status pills.
// Solid (not tinted) so the chips read clearly against the inverted
// dark hero card; the eyebrow + count layout still keeps them quieter
// than the headline number.
const BREAKDOWN_TONE: Record<"warning" | "info" | "success", string> = {
  warning: "bg-warning text-foreground",
  info: "bg-info text-white",
  success: "bg-success text-white",
};

function BreakdownChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof BREAKDOWN_TONE;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl px-2.5 py-1.5",
        BREAKDOWN_TONE[tone]
      )}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider opacity-90">
        {label}
      </span>
      <span className="text-base font-bold tabular-nums leading-none">
        {value}
      </span>
    </div>
  );
}

interface Delta {
  /** percentage change vs previous period; null when previous was zero. */
  pct: number | null;
  direction: "up" | "down" | "flat";
}

function computeDelta(current: number, previous: number): Delta {
  if (previous === 0) {
    return { pct: null, direction: current > 0 ? "up" : "flat" };
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return { pct: 0, direction: "flat" };
  return { pct, direction: pct > 0 ? "up" : "down" };
}

/**
 * Tone classes for the StatCard's icon badge. Tinted backgrounds with
 * solid coloured glyphs read as "this metric belongs to that status
 * family" without making the whole card loud. Neutral falls back to
 * the original muted look so cards without semantic colour stay calm.
 */
type StatTone = "neutral" | "info" | "success" | "warning";

const STAT_TONE: Record<StatTone, string> = {
  neutral: "bg-muted text-foreground/80",
  info: "bg-info/15 text-info",
  success: "bg-success/15 text-success",
  // The brand warning is bright yellow — a tinted bg with foreground
  // text reads better than warning-on-warning.
  warning: "bg-warning/25 text-foreground",
};

// Stroke + fill colour pairs for the optional Sparkline at the bottom
// of a StatCard. Chosen to harmonise with the icon tone — success bg
// + success line, neutral bg + foreground line.
const SPARK_TONE: Record<StatTone, { stroke: string; fill: string }> = {
  neutral: { stroke: "stroke-foreground/70", fill: "fill-foreground/10" },
  info: { stroke: "stroke-info", fill: "fill-info/15" },
  success: { stroke: "stroke-success", fill: "fill-success/15" },
  warning: { stroke: "stroke-warning", fill: "fill-warning/20" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  emphasis = false,
  compact = false,
  delta,
  tone = "neutral",
  sparkline,
  sparklineTone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  subtext: string;
  emphasis?: boolean;
  compact?: boolean;
  delta?: Delta;
  tone?: StatTone;
  /** When provided, renders a 7-day mini-chart at the bottom of the card. */
  sparkline?: number[];
  /** Override the sparkline's colour tone independently of the icon tone. */
  sparklineTone?: StatTone;
}) {
  const sparkColour = SPARK_TONE[sparklineTone ?? tone];

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-3xl border bg-card p-4",
        emphasis ? "border-foreground" : "border-border"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-xl",
            STAT_TONE[tone]
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      </div>
      <p
        className={cn(
          "mt-3 truncate font-bold tracking-tight",
          compact ? "text-xl" : "text-3xl"
        )}
        title={compact ? value : undefined}
      >
        {value}
      </p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {delta && <DeltaPill delta={delta} />}
        <p className="truncate text-xs text-muted-foreground">{subtext}</p>
      </div>
      {sparkline && sparkline.length > 0 && (
        <div className="mt-3 -mx-1">
          <Sparkline
            values={sparkline}
            strokeClassName={sparkColour.stroke}
            fillClassName={sparkColour.fill}
            className="h-8"
          />
        </div>
      )}
    </div>
  );
}

function DeltaPill({ delta }: { delta: Delta }) {
  const Icon =
    delta.direction === "up"
      ? TrendingUp
      : delta.direction === "down"
      ? TrendingDown
      : Minus;
  const tone =
    delta.direction === "up"
      ? "text-success"
      : delta.direction === "down"
      ? "text-destructive"
      : "text-muted-foreground";
  const text =
    delta.pct === null
      ? "new"
      : delta.pct === 0
      ? "—"
      : `${delta.pct > 0 ? "+" : ""}${delta.pct.toFixed(0)}%`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold tabular-nums", tone)}>
      <Icon className="h-3 w-3" strokeWidth={2.4} />
      {text}
    </span>
  );
}

function TopSellersPanel({
  sellers,
  isLoading,
}: {
  sellers: TopSeller[];
  isLoading: boolean;
}) {
  return (
    <section className="h-full rounded-3xl border border-border bg-card p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Top sellers</h2>
        <span className="text-xs text-muted-foreground">Today · top 5</span>
      </header>
      <div className="mt-3">
        {isLoading ? (
          <ul className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="h-5 w-5 shrink-0 rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 rounded bg-muted" />
                  <div className="h-2 w-full rounded-full bg-muted" />
                </div>
                <div className="h-3 w-12 rounded bg-muted" />
              </li>
            ))}
          </ul>
        ) : sellers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No items sold yet today.
          </p>
        ) : (
          <ol className="space-y-3">
            {sellers.map((s, i) => (
              <TopSellerRow
                key={s.name}
                rank={i + 1}
                seller={s}
                topQuantity={sellers[0].quantity}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/**
 * Row for the top-sellers leaderboard. The progress bar's width is
 * relative to the leader's quantity so the visual ranking matches
 * the numeric ranking — #1 is always full-width, #5 shrinks
 * proportionally.
 */
function TopSellerRow({
  rank,
  seller,
  topQuantity,
}: {
  rank: number;
  seller: TopSeller;
  topQuantity: number;
}) {
  const widthPct = topQuantity > 0
    ? Math.max(8, (seller.quantity / topQuantity) * 100)
    : 0;
  return (
    <li>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
            rank === 1
              ? "bg-warning text-foreground"
              : "bg-muted text-foreground/70"
          )}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">
            {seller.name}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                rank === 1 ? "bg-warning" : "bg-foreground/40"
              )}
              style={{ width: `${widthPct}%` }}
            />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold tabular-nums leading-tight">
            {seller.quantity}{" "}
            <span className="font-medium text-muted-foreground">sold</span>
          </p>
          <p className="text-[10px] tabular-nums text-muted-foreground">
            {formatPrice(seller.revenue)}
          </p>
        </div>
      </div>
    </li>
  );
}

function RecentActivity({
  orders,
  isLoading,
}: {
  orders: RecentOrder[];
  isLoading: boolean;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Recent orders</h2>
        <span className="text-xs text-muted-foreground">Last 5</span>
      </header>
      <div className="mt-3 divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="h-8 w-12 rounded-md bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </div>
            </div>
          ))
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No orders yet today.
          </p>
        ) : (
          orders.map((order) => <RecentOrderRow key={order.id} order={order} />)
        )}
      </div>
    </section>
  );
}

function RecentOrderRow({ order }: { order: RecentOrder }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-9 min-w-[3rem] items-center justify-center rounded-xl border border-border bg-muted px-2">
        <span className="text-sm font-extrabold tracking-tight">
          {order.tableId}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="truncate">
            {order.customerName ?? "Guest"}
          </span>
          <span className="font-mono text-[10px] font-medium text-muted-foreground">
            {order.id}
          </span>
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" strokeWidth={2.2} />
          {formatRelative(order.createdAt, Date.now())}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold tabular-nums">
          {formatPrice(order.total)}
        </p>
        <span
          className={cn(
            "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            ADMIN_STATUS_PILL[order.status]
          )}
        >
          {ADMIN_STATUS_LABEL[order.status]}
        </span>
      </div>
    </div>
  );
}

