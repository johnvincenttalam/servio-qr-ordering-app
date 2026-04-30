import { Skeleton } from "@/components/ui/skeleton";

export function MenuSkeleton() {
  return (
    <div className="space-y-3">
      {/* Promo carousel */}
      <section className="-mx-4">
        <div className="flex gap-3 overflow-hidden px-4 pb-1">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton
              key={i}
              className="aspect-[16/9] w-[min(85vw,22rem)] shrink-0 rounded-3xl"
            />
          ))}
        </div>
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

      {/* Category tabs */}
      <div className="-mx-4 border-b border-border py-3">
        <div className="flex gap-2 px-4 py-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-full" />
          ))}
        </div>
      </div>

      {/* Menu grid */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-3xl border border-border bg-card"
          >
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
