import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { BrandMark } from "@/components/common/BrandMark";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";
import { useOpenStatus } from "@/hooks/useBusinessHours";
import { useAppStore } from "@/store/useAppStore";
import { formatNextOpenAt } from "@/services/businessHours";

/**
 * Customer-facing "we're closed" takeover. Renders without the
 * AppLayout chrome so the cart / bell / history icons don't appear
 * (a tap on those would either no-op or throw, and showing them
 * just to grey them out is worse than hiding them).
 *
 * Auto-redirects to /menu when the venue opens — useOpenStatus ticks
 * every 30s, so a customer waiting on this page sees the menu the
 * moment hours flip without having to refresh.
 */
export default function ClosedPage() {
  const navigate = useNavigate();
  const { settings } = useRestaurantSettings();
  const status = useOpenStatus();
  const tableId = useAppStore((s) => s.tableId);

  useEffect(() => {
    // Only auto-redirect if we have a tableId in the store — i.e.,
    // the customer scanned a valid QR earlier. Without one, /menu
    // would just bounce back to / for a fresh scan.
    if (status.kind === "open" && tableId) {
      navigate("/menu", { replace: true });
    }
  }, [status.kind, tableId, navigate]);

  const subline =
    status.kind === "closed-schedule" && status.nextOpenAt
      ? formatNextOpenAt(status.nextOpenAt, settings.timezone)
      : status.kind === "closed-override"
      ? "We've paused ordering for now."
      : "Please come back during open hours.";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex items-center gap-2.5">
        <BrandMark className="h-9 w-9" />
        <p className="text-base font-extrabold tracking-tight">
          {settings.name}
        </p>
      </div>

      <div
        className="flex h-24 w-24 items-center justify-center rounded-3xl border border-border bg-muted animate-fade-up"
        aria-hidden="true"
      >
        <Clock className="h-12 w-12 text-foreground" strokeWidth={1.6} />
      </div>

      <div
        className="space-y-1.5 animate-fade-up"
        style={{ animationDelay: "100ms" }}
      >
        <h1 className="text-3xl font-bold tracking-tight">We&apos;re closed</h1>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">
          {settings.name} isn&apos;t taking orders right now.
        </p>
      </div>

      <p
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground animate-fade-up"
        style={{ animationDelay: "200ms" }}
      >
        {subline}
      </p>
    </div>
  );
}
