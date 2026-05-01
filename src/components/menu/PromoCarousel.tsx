import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { PromoBanner } from "@/types";

interface PromoCarouselProps {
  banners: PromoBanner[];
}

const AUTO_ADVANCE_MS = 5000;

export function PromoCarousel({ banners }: PromoCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  // While the user is touching or actively scrolling we suspend the
  // auto-advance so we don't yank the deck out from under them.
  const [paused, setPaused] = useState(false);
  const resumeTimerRef = useRef<number | null>(null);

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

  const goTo = useCallback((index: number) => {
    // Scroll the carousel's own container, NOT the target's
    // scrollIntoView — the latter scrolls every scrollable ancestor
    // including <body>, which yanked the menu page back to the top
    // every 5s when auto-advance fired below the fold. Each slide is
    // w-full so the offset is just index × scroller width.
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({
      left: index * scroller.clientWidth,
      behavior: "smooth",
    });
  }, []);

  // Auto-advance loop. Restarts whenever activeIndex changes (so the
  // 5s window is "since last visible change", not "every 5s globally")
  // and pauses while the user is interacting.
  useEffect(() => {
    if (banners.length <= 1 || paused) return;
    const id = window.setTimeout(() => {
      goTo((activeIndex + 1) % banners.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [activeIndex, banners.length, paused, goTo]);

  // Pause for a beat after any user interaction so manual swipes don't
  // race against the auto-advance.
  const bumpPause = useCallback(() => {
    setPaused(true);
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = window.setTimeout(() => {
      setPaused(false);
      resumeTimerRef.current = null;
    }, AUTO_ADVANCE_MS * 1.5);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }
    };
  }, []);

  if (banners.length === 0) return null;

  return (
    // Stays inside the page padding (no -mx-4 breakout). Each slide
    // fills the column width and inherits the rounded-3xl curve so the
    // banner reads as a contained card rather than a strip touching
    // both column edges.
    <section className="animate-fade-up">
      <div
        ref={scrollerRef}
        onTouchStart={bumpPause}
        onPointerDown={bumpPause}
        onWheel={bumpPause}
        className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none"
      >
        {banners.map((banner, i) => (
          <div
            key={banner.id}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className="relative aspect-[16/9] w-full shrink-0 snap-center overflow-hidden rounded-3xl bg-muted"
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
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  {banner.title && (
                    <h3 className="text-2xl font-bold leading-tight tracking-tight">
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
                onClick={() => {
                  bumpPause();
                  goTo(i);
                }}
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
