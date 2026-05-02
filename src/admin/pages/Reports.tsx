import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FileSpreadsheet,
  Receipt,
  Wallet,
  CreditCard,
  Package,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { downloadCsv, rowsToCsv } from "@/lib/csvExport";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils";
import {
  fetchReport,
  type ReportOrder,
  type ReportRange,
  type ReportSummary,
} from "@/services/reports";
import { AdminEmptyState } from "../components/AdminEmptyState";

// ──────────────────────────────────────────────────────────────────
// Date helpers — keep all "ranges" as { start, end } ISO pairs with
// `end` exclusive so adjacent windows tile without overlap.
// ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfTomorrow(): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() + 1);
  return d;
}

function dateInputValue(d: Date): string {
  // <input type="date"> wants local-tz YYYY-MM-DD. toISOString() would
  // shift days when the local TZ is behind UTC.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInput(value: string): Date | null {
  // Treat the input as a local-tz date at midnight.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function buildRange(fromDate: Date, toDate: Date): ReportRange {
  const start = startOfDay(fromDate);
  const endExclusive = startOfDay(toDate);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return {
    start: start.toISOString(),
    end: endExclusive.toISOString(),
  };
}

interface PresetSpec {
  id: string;
  label: string;
  /** Returns the [from, to] pair (both inclusive at day-precision). */
  resolve: () => [Date, Date];
}

const PRESETS: readonly PresetSpec[] = [
  {
    id: "7d",
    label: "Last 7 days",
    resolve: () => {
      const to = startOfDay(new Date());
      const from = new Date(to);
      from.setDate(from.getDate() - 6);
      return [from, to];
    },
  },
  {
    id: "30d",
    label: "Last 30 days",
    resolve: () => {
      const to = startOfDay(new Date());
      const from = new Date(to);
      from.setDate(from.getDate() - 29);
      return [from, to];
    },
  },
  {
    id: "this-month",
    label: "This month",
    resolve: () => {
      const now = startOfDay(new Date());
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return [from, now];
    },
  },
  {
    id: "last-month",
    label: "Last month",
    resolve: () => {
      const now = startOfDay(new Date());
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return [from, to];
    },
  },
];

// ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  // Default to last 30 days on first load — broad enough to be
  // useful, narrow enough to fetch quickly.
  const [from, to] = PRESETS[1].resolve();
  const [fromDate, setFromDate] = useState<Date>(from);
  const [toDate, setToDate] = useState<Date>(to);

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => buildRange(fromDate, toDate), [fromDate, toDate]);
  const validRange = fromDate <= toDate;
  const exceedsToday = toDate >= startOfTomorrow();

  const refetch = useCallback(async () => {
    if (!validRange) return;
    setIsLoading(true);
    const result = await fetchReport(range);
    if (result.error) {
      setError(result.error);
    } else {
      setError(null);
      setSummary(result.summary);
      setOrders(result.orders);
    }
    setIsLoading(false);
  }, [range, validRange]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const applyPreset = (preset: PresetSpec) => {
    const [f, t] = preset.resolve();
    setFromDate(f);
    setToDate(t);
  };

  const handleExport = () => {
    if (orders.length === 0) {
      toast.error("Nothing to export — no orders in this range.");
      return;
    }
    const csv = rowsToCsv(
      [
        "Order ID",
        "Table",
        "Customer",
        "Status",
        "Items",
        "Item summary",
        "Total",
        "Notes",
        "Created at",
      ],
      orders.map((o) => [
        o.id,
        o.tableId,
        o.customerName ?? "",
        o.status,
        o.itemCount,
        o.itemSummary,
        o.total.toFixed(2),
        o.notes ?? "",
        new Date(o.createdAt).toISOString(),
      ])
    );
    const filename = `servio-orders-${dateInputValue(fromDate)}_to_${dateInputValue(toDate)}.csv`;
    downloadCsv(filename, csv);
    toast.success(`Exported ${orders.length} ${orders.length === 1 ? "order" : "orders"}`);
  };

  const truncated = orders.length === 10000;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Admin
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a date range to summarise orders and export a CSV for accounting.
        </p>
      </header>

      <RangePicker
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={setFromDate}
        onToChange={setToDate}
        onPreset={applyPreset}
        validRange={validRange}
      />

      {!validRange && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          From date must be on or before To date.
        </p>
      )}

      {error && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {exceedsToday && validRange && (
        <p className="rounded-2xl border border-warning/40 bg-warning/15 p-3 text-xs text-foreground">
          Heads up — your To date is in the future. Only orders up to now will
          show.
        </p>
      )}

      <SummaryCards summary={summary} isLoading={isLoading} />

      <ExportRow
        count={orders.length}
        truncated={truncated}
        onExport={handleExport}
        disabled={isLoading || orders.length === 0}
      />

      <OrdersPreview orders={orders} isLoading={isLoading} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────

function RangePicker({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  onPreset,
  validRange,
}: {
  fromDate: Date;
  toDate: Date;
  onFromChange: (d: Date) => void;
  onToChange: (d: Date) => void;
  onPreset: (preset: PresetSpec) => void;
  validRange: boolean;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onPreset(preset)}
            className="inline-flex items-center rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground active:scale-95"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DateField
          label="From"
          value={dateInputValue(fromDate)}
          onChange={(v) => {
            const parsed = parseDateInput(v);
            if (parsed) onFromChange(parsed);
          }}
        />
        <DateField
          label="To"
          value={dateInputValue(toDate)}
          onChange={(v) => {
            const parsed = parseDateInput(v);
            if (parsed) onToChange(parsed);
          }}
          invalid={!validRange}
        />
      </div>
    </section>
  );
}

function DateField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 rounded-xl",
          invalid && "border-destructive focus-visible:ring-destructive/20"
        )}
      />
    </label>
  );
}

// ──────────────────────────────────────────────────────────────────

function SummaryCards({
  summary,
  isLoading,
}: {
  summary: ReportSummary | null;
  isLoading: boolean;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        icon={Receipt}
        label="Orders"
        value={
          isLoading
            ? "—"
            : summary
            ? String(summary.totalOrders)
            : "—"
        }
        subtext={
          summary && summary.cancelledOrders > 0
            ? `${summary.fulfilledOrders} fulfilled · ${summary.cancelledOrders} cancelled`
            : "Total in range"
        }
      />
      <SummaryCard
        icon={Wallet}
        label="Revenue"
        tone="success"
        value={
          isLoading
            ? "—"
            : summary
            ? formatPrice(summary.totalRevenue)
            : "—"
        }
        subtext="Excludes cancelled"
      />
      <SummaryCard
        icon={CreditCard}
        label="Avg ticket"
        value={
          isLoading
            ? "—"
            : summary && summary.avgTicket !== null
            ? formatPrice(summary.avgTicket)
            : "—"
        }
        subtext="Per fulfilled order"
      />
      <SummaryCard
        icon={Package}
        label="Items sold"
        tone="info"
        value={
          isLoading
            ? "—"
            : summary
            ? String(summary.itemCount)
            : "—"
        }
        subtext="Across fulfilled orders"
      />
    </section>
  );
}

const TONE_CLASSES: Record<"neutral" | "success" | "info", string> = {
  neutral: "bg-muted text-foreground/80",
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
};

function SummaryCard({
  icon: Icon,
  label,
  value,
  subtext,
  tone = "neutral",
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  subtext: string;
  tone?: "neutral" | "success" | "info";
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-xl",
            TONE_CLASSES[tone]
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      </div>
      <p className="mt-3 truncate text-2xl font-bold tracking-tight">
        {value}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────

function ExportRow({
  count,
  truncated,
  onExport,
  disabled,
}: {
  count: number;
  truncated: boolean;
  onExport: () => void;
  disabled: boolean;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">Download CSV</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {truncated
            ? "Showing the most recent 10,000 orders — narrow the range for full results."
            : count > 0
            ? `${count} ${count === 1 ? "order" : "orders"} in range — Excel- and Numbers-friendly UTF-8 CSV.`
            : "No orders in this range yet."}
        </p>
      </div>
      <button
        type="button"
        onClick={onExport}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        <Download className="h-4 w-4" strokeWidth={2.4} />
        Export CSV
      </button>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────

const PREVIEW_LIMIT = 25;

function OrdersPreview({
  orders,
  isLoading,
}: {
  orders: ReportOrder[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-border bg-card p-4">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Orders preview</h2>
        </header>
        <ul className="mt-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3"
            >
              <div className="h-9 w-12 rounded-xl bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-1/2 rounded bg-muted" />
                <div className="h-3 w-1/3 rounded bg-muted" />
              </div>
              <div className="h-4 w-16 rounded bg-muted" />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (orders.length === 0) {
    return (
      <AdminEmptyState
        icon={FileSpreadsheet}
        title="Nothing in this window"
        description="No orders fall inside the selected date range. Try a wider span."
        tone="neutral"
        compact
      />
    );
  }

  const previewOrders = orders.slice(0, PREVIEW_LIMIT);
  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Orders preview</h2>
        <span className="text-xs text-muted-foreground">
          {previewOrders.length} of {orders.length} shown
        </span>
      </header>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">Order</th>
              <th className="py-2 pr-3">Table</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3 text-right">Items</th>
              <th className="py-2 pl-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {previewOrders.map((o) => (
              <tr key={o.id} className="border-b border-border/60 last:border-b-0">
                <td className="py-2 pr-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {new Date(o.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">
                  {o.id}
                </td>
                <td className="py-2 pr-3 font-semibold">{o.tableId}</td>
                <td className="py-2 pr-3 text-xs uppercase tracking-wider">
                  {o.status}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {o.itemCount}
                </td>
                <td className="py-2 pl-3 text-right font-bold tabular-nums">
                  {formatPrice(o.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
