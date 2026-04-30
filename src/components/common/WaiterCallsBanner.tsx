import { useEffect, useState } from "react";
import { Bell, Receipt, Check, MessageSquare } from "lucide-react";
import { useWaiterCalls } from "@/hooks/useWaiterCalls";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/utils";
import type { WaiterCall, WaiterCallKind } from "@/types";

interface WaiterCallsBannerProps {
  /**
   * Which kind of call gets visual emphasis on this surface.
   * - "service" → kitchen weight: service rows red/warning, bill muted
   * - "bill"    → admin weight: bill rows info/success, service muted
   */
  emphasize: WaiterCallKind;
}

const KIND_LABEL: Record<WaiterCallKind, string> = {
  service: "Service",
  bill: "Bill request",
};

const KIND_ICON: Record<WaiterCallKind, typeof Bell> = {
  service: Bell,
  bill: Receipt,
};

export function WaiterCallsBanner({ emphasize }: WaiterCallsBannerProps) {
  const { calls, resolve } = useWaiterCalls();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (calls.length === 0) return null;

  return (
    <section className="mb-4 space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {calls.length} call{calls.length === 1 ? "" : "s"} waiting
        </h2>
      </div>
      <ul className="space-y-2">
        {calls.map((call) => (
          <CallRow
            key={call.id}
            call={call}
            now={now}
            isPrimary={call.kind === emphasize}
            onResolve={() => resolve(call.id)}
          />
        ))}
      </ul>
    </section>
  );
}

interface CallRowProps {
  call: WaiterCall;
  now: number;
  isPrimary: boolean;
  onResolve: () => void;
}

function CallRow({ call, now, isPrimary, onResolve }: CallRowProps) {
  const Icon = KIND_ICON[call.kind];
  // Primary tone follows the call kind's brand color; secondary tone is muted
  // gray so calls handled by another role still register but don't compete.
  const tone =
    call.kind === "service" ? "bg-warning text-foreground" : "bg-info text-white";

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 transition-colors animate-fade-up",
        isPrimary
          ? "border-foreground/15 bg-card"
          : "border-border bg-muted/30 opacity-80"
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          isPrimary ? tone : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.4} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold leading-tight">
            Table {call.tableId}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {KIND_LABEL[call.kind]}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatRelative(call.createdAt, now)}</span>
          {call.orderId && (
            <>
              <span aria-hidden>·</span>
              <span className="font-mono">{call.orderId}</span>
            </>
          )}
          {call.note && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 truncate">
                <MessageSquare className="h-3 w-3" strokeWidth={2.2} />
                {call.note}
              </span>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onResolve}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
        Resolve
      </button>
    </li>
  );
}
