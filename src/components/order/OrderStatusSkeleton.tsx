import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the Order Status page layout block-for-block: heading, hero
 * card with status icon + chip + title + description + ETA pill, the
 * 3-step progress bar, the items recap with a few lines, the "Need
 * help?" row, and the bottom CTA. Sized so each placeholder roughly
 * matches the eventual rendered height — keeps the layout from
 * jumping when data arrives.
 */
export function OrderStatusSkeleton() {
  return (
    <div className="space-y-4">
      {/* Page heading — "Order Status" */}
      <Skeleton className="h-8 w-44" />

      {/* Hero card */}
      <section className="relative overflow-hidden rounded-3xl bg-muted/60 p-6">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-3xl bg-muted" />
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="mt-1 h-6 w-44 rounded-full" />
          </div>
        </div>
      </section>

      {/* Progress card */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <Skeleton className="h-3 w-20" />
        <div className="mt-4 flex items-center">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-1 items-center last:flex-initial"
            >
              <Skeleton className="h-9 w-9 rounded-full" />
              {i < 2 && <Skeleton className="mx-1 h-1 flex-1 rounded-full" />}
            </div>
          ))}
        </div>
        <div className="h-6" />
      </section>

      {/* Items recap */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
        <ul className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-16" />
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-20" />
        </div>
      </section>

      {/* Need help row */}
      <Skeleton className="h-16 w-full rounded-3xl" />

      {/* Bottom CTA */}
      <Skeleton className="h-14 w-full rounded-full" />
    </div>
  );
}
