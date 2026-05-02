import { Clock } from "lucide-react";
import { BrandMark } from "@/components/common/BrandMark";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";
import { useOpenStatus } from "@/hooks/useBusinessHours";
import { formatNextOpenAt } from "@/services/businessHours";

/**
 * Customer-facing "we're closed" page. Shown when useTableValidation
 * succeeds but the venue is currently closed (outside business hours
 * or the manual override is off). Hard-gates the menu — the customer
 * can't browse to /menu from here, by design (Phase 2 hard-gate decision).
 */
export default function ClosedPage() {
  const { settings } = useRestaurantSettings();
  const status = useOpenStatus();

  const subline =
    status.kind === "closed-schedule" && status.nextOpenAt
      ? formatNextOpenAt(status.nextOpenAt, settings.timezone)
      : status.kind === "closed-override"
      ? "We've paused ordering for now."
      : "Please come back during open hours.";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center animate-fade-up">
      <BrandMark className="h-16 w-16" />

      <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-border bg-muted">
        <Clock
          aria-hidden="true"
          className="h-12 w-12 text-foreground"
          strokeWidth={1.6}
        />
      </div>

      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">We&apos;re closed</h1>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">
          {settings.name} isn&apos;t taking orders right now.
        </p>
      </div>

      <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">
        {subline}
      </p>
    </div>
  );
}
