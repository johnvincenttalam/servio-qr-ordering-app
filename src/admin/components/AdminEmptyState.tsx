import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tone for the icon container. "info" is the default — a soft brand-blue
 * tint that adds quiet life without making the page loud. "neutral"
 * falls back to the muted gray for filtered "no matches" surfaces where
 * the absence of data isn't really a positive prompt to act.
 */
type EmptyTone = "info" | "success" | "warning" | "neutral";

const TONE_CLASSES: Record<EmptyTone, string> = {
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/20 text-foreground",
  neutral: "bg-muted text-foreground/70",
};

interface AdminEmptyStateProps {
  /** Optional Lucide icon — when set, renders inside a tinted container. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Solid black "primary" CTA — typically a "Create / Add" action. */
  actionLabel?: string;
  onAction?: () => void;
  /** Outlined "secondary" CTA — typically "Clear filters". */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  tone?: EmptyTone;
  /** Tighter padding for embedded contexts (default uses comfortable py-16). */
  compact?: boolean;
}

/**
 * Shared admin empty-state surface. Replaces the half-dozen bespoke
 * dashed-border boxes that were scattered across pages so they share
 * one visual language: tinted icon container, bold title, optional
 * description, optional primary + secondary actions.
 */
export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  tone = "info",
  compact = false,
}: AdminEmptyStateProps) {
  const hasPrimary = actionLabel && onAction;
  const hasSecondary = secondaryActionLabel && onSecondaryAction;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card text-center",
        compact ? "px-6 py-10" : "px-6 py-14"
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl",
            TONE_CLASSES[tone]
          )}
          aria-hidden
        >
          <Icon className="h-6 w-6" strokeWidth={1.8} />
        </span>
      )}
      <div className="space-y-1">
        <h2 className="text-base font-bold">{title}</h2>
        {description && (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {(hasPrimary || hasSecondary) && (
        <div className="mt-1 flex items-center gap-2">
          {hasPrimary && (
            <button
              type="button"
              onClick={onAction}
              className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
            >
              {actionLabel}
            </button>
          )}
          {hasSecondary && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted active:scale-95"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
