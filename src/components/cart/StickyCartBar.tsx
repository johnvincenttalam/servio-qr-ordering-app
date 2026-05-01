import { ChevronRight } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { formatPrice } from "@/utils";

interface StickyCartBarProps {
  onClick: () => void;
}

const MAX_THUMBNAILS = 3;

/**
 * Sticky bottom bar that shows on the menu page when the cart isn't
 * empty. Three zones: deduped item thumbnails (left), count + total
 * (middle), View Cart button (right). The thumbnails make the cart
 * tangible — guests see what they ordered, not just a counter.
 */
export function StickyCartBar({ onClick }: StickyCartBarProps) {
  const cart = useAppStore((s) => s.cart);
  const cartTotal = useAppStore((s) => s.getCartTotal());
  const cartCount = useAppStore((s) => s.getCartItemCount());

  if (cartCount === 0) return null;

  // Dedupe thumbnails by itemId so 5x of the same drink doesn't fill
  // the stack with identical photos. First occurrence wins (visually
  // matches the order things were added in).
  const seen = new Set<string>();
  const uniqueItems = cart.filter((line) => {
    if (seen.has(line.itemId)) return false;
    seen.add(line.itemId);
    return true;
  });
  const visibleThumbs = uniqueItems.slice(0, MAX_THUMBNAILS);
  const overflow = uniqueItems.length - visibleThumbs.length;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
      <div
        className="mx-auto max-w-md p-4 sm:max-w-lg lg:max-w-xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={onClick}
          aria-label={`View cart — ${cartCount} item${
            cartCount === 1 ? "" : "s"
          }, ${formatPrice(cartTotal)}`}
          className="group pointer-events-auto flex w-full items-center justify-between gap-4 rounded-full bg-foreground px-3 py-2.5 text-background shadow-lg shadow-black/20 transition-transform duration-200 hover:scale-[1.01] active:scale-[0.98] animate-fade-up"
        >
          {/* Left: stacked thumbnails + overflow badge. Negative margins
              between siblings collapse them into the overlap pattern. */}
          <span className="flex shrink-0 items-center">
            <span className="flex items-center -space-x-2.5">
              {visibleThumbs.map((line) => (
                <span
                  key={line.lineId}
                  className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-foreground"
                >
                  <img
                    src={line.image}
                    alt=""
                    aria-hidden
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </span>
              ))}
              {overflow > 0 && (
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-warning text-xs font-extrabold text-foreground ring-2 ring-foreground">
                  +{overflow}
                </span>
              )}
            </span>
          </span>

          {/* Middle: just the count — eyebrow style, leaves the total
              the standalone money line on the right. */}
          <span className="min-w-0 flex-1 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-background/70">
            {cartCount} {cartCount === 1 ? "item" : "items"}
          </span>

          {/* Right: total amount as the action affordance. No pill —
              the price IS the call to act, with a chevron hinting that
              tapping advances the flow. */}
          <span className="flex shrink-0 items-center gap-1.5 pr-1 text-base font-extrabold tabular-nums transition-transform group-hover:translate-x-0.5">
            {formatPrice(cartTotal)}
            <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
          </span>
        </button>
      </div>
    </div>
  );
}
