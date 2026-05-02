import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
  /** Currently-selected option id. */
  value: T;
  /** Called with the new id when an option is clicked. */
  onChange: (next: T) => void;
  options: readonly SegmentedOption<T>[];
  /**
   * Active-pill style. "card" → light bg-card pill on a muted track
   * (subtle, used for view/range pickers). "filled" → bg-foreground
   * pill (stronger, used for primary status switching).
   */
  variant?: "card" | "filled";
  /** Hide labels and render icon-only. Label still exposed as title/aria. */
  iconOnly?: boolean;
  /** Stretch options to fill the track equally. Defaults to auto-width. */
  fill?: boolean;
  /** Disable all options (e.g. during a save). */
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}

const ACTIVE_CLASSES: Record<"card" | "filled", string> = {
  card: "bg-card text-foreground shadow-sm",
  filled: "bg-foreground text-background shadow-sm",
};

/**
 * Pill-track segmented control. Replaces three near-identical inline
 * implementations (DateRangeFilter, ViewToggle, the status tabs in
 * OrderDetail) with one component so the visual language stays
 * consistent and a single place owns the rounded-track + active-pill
 * styling.
 *
 * Always rendered with role="tablist" + aria-selected — the
 * "selected one of N" semantics fit a tablist whether the choice is
 * a date range, a view mode, or a workflow status.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  variant = "card",
  iconOnly = false,
  fill = false,
  disabled = false,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 rounded-full bg-muted p-0.5",
        fill && "w-full",
        className
      )}
    >
      {options.map(({ id, label, icon: Icon }) => {
        const isActive = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(id)}
            title={label}
            aria-label={iconOnly ? label : undefined}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
              fill && "flex-1",
              iconOnly
                ? "h-8 w-8"
                : "px-3 py-1.5 text-xs font-semibold",
              isActive
                ? ACTIVE_CLASSES[variant]
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-4 w-4" strokeWidth={2.2} />}
            {!iconOnly && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
