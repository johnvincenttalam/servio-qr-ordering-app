import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { PromoBanner } from "@/types";

interface PromoCarouselProps {
  banners: PromoBanner[];
}

export function PromoCarousel({ banners }: PromoCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length === 0) return;
        const target = visible[0].target as HTMLDivElement;
        const index = slideRefs.current.indexOf(target);
        if (index >= 0) setActiveIndex(index);
      },
      { root: scroller, threshold: [0.5, 0.75, 1] }
    );

    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [banners]);

  const goTo = (index: number) => {
    const target = slideRefs.current[index];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  if (banners.length === 0) return null;

  return (
    <section className="-mx-4 animate-fade-up">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-none px-4 pb-1"
      >
        {banners.map((banner, i) => (
          <div
            key={banner.id}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className="relative aspect-[16/9] w-[min(85vw,22rem)] shrink-0 snap-center overflow-hidden rounded-3xl bg-muted"
          >
            <img
              src={banner.image}
              alt={banner.title ?? "Promotion"}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
            {(banner.title || banner.subtitle) && (
              <>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  {banner.title && (
                    <h3 className="text-xl font-bold leading-tight tracking-tight">
                      {banner.title}
                    </h3>
                  )}
                  {banner.subtitle && (
                    <p className="mt-1 text-sm font-medium text-white/85">
                      {banner.subtitle}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {banners.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {banners.map((banner, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={banner.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={isActive}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  isActive ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25"
                )}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
