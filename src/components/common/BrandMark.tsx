import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /**
   * Tailwind class for the outer container — owns the size, rounding,
   * and background. Default treatment is the dark-on-light brand chip
   * used across the app, so most callers only set sizing classes.
   */
  className?: string;
  /** Override the default outer treatment entirely. */
  variant?: "filled" | "ghost";
}

/**
 * SERVIO brand mark — knife + fork inlined as SVG paths so the icon
 * is theme-aware (renders via currentColor) and stays in lock-step
 * with /public/favicon.svg. Replaces the previous Lucide Utensils
 * approximation throughout the app's brand chips.
 *
 * Render at any size by passing height + width Tailwind classes:
 *   <BrandMark className="h-10 w-10 rounded-2xl" />
 *
 * The "filled" variant (default) is the familiar dark chip with a
 * white mark — for headers, sidebar, login. "ghost" inherits its
 * background from the parent so the same paths can sit on top of
 * existing surfaces (e.g. a sticker-style overlay).
 */
export function BrandMark({ className, variant = "filled" }: BrandMarkProps) {
  return (
    <span
      // Corner radius matches the logo SVG's rx=150 on a 568 canvas
      // (~26%). Using a percentage keeps the rounded-square shape
      // consistent across every chip size — a fixed Tailwind class
      // like rounded-2xl turns into a circle at h-9 and a softer
      // shape at h-14.
      style={{ borderRadius: "26%" }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        variant === "filled" && "bg-foreground text-background",
        className
      )}
    >
      <svg
        viewBox="0 0 568 568"
        className="h-3/5 w-3/5"
        fill="none"
        stroke="currentColor"
        strokeWidth={40}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M138.5 122.334V235.501C138.5 253.284 153.05 267.834 170.833 267.834H235.5C244.075 267.834 252.299 264.427 258.363 258.364C264.427 252.3 267.833 244.076 267.833 235.501V122.334" />
        <path d="M203.395 122.105V445.894" />
        <path d="M429.501 332.501V122.334C408.063 122.334 387.503 130.85 372.344 146.01C357.184 161.169 348.668 181.729 348.668 203.167V300.167C348.668 317.951 363.218 332.501 381.001 332.501H429.501ZM429.501 332.501V445.667" />
      </svg>
    </span>
  );
}
