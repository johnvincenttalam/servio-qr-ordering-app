import { Skeleton } from "@/components/ui/skeleton";

export function MenuSkeleton() {
  return (
    <div className="space-y-3">
      {/* Greeting */}
      <section>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="mt-2 h-4 w-56" />
      </section>

      {/* Promo carousel — single banner inside page padding (no -mx-4
          breakout), matches PromoCarousel's actual layout. */}
      <section>
        <Skeleton className="aspect-[16/9] w-full rounded-3xl" />
        <div className="mt-3 flex justify-center gap-1.5">
          <Skeleton className="h-1.5 w-6 rounded-full" />
          <Skeleton className="h-1.5 w-1.5 rounded-full" />
          <Skeleton className="h-1.5 w-1.5 rounded-full" />
        </div>
      </section>

      {/* Top picks */}
      <section className="-mx-4">
        <Skeleton className="ml-4 h-3 w-20" />
        <div className="mt-2 flex gap-3 overflow-hidden px-4 pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-36 shrink-0">
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <div className="mt-2 space-y-2 px-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Search bar */}
      <Skeleton className="h-11 w-full rounded-xl" />

      {/* Category tabs — first pill ("All") is wider because it's the
          selected chip showing icon + label, the rest are icon-only
          circles. Mirrors the actual CategoryTabs layout. */}
      <div className="-mx-4 border-b border-border py-3">
        <div className="flex gap-2 px-4 py-0.5">
          <Skeleton className="h-10 w-20 rounded-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-full" />
          ))}
        </div>
      </div>

      {/* Menu grid — each card mirrors MenuItemCard: image with a price
          chip overlay, body row with name/desc on the left and the
          add-button circle on the right. */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-3xl border border-border bg-card"
          >
            <div className="relative">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <Skeleton className="absolute bottom-2 left-2 h-6 w-14 rounded-full" />
            </div>
            <div className="flex items-start justify-between gap-2 p-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
