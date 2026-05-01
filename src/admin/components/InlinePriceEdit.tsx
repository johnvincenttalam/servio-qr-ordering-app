import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { CURRENCY_SYMBOL } from "@/constants";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils";

interface InlinePriceEditProps {
  /** The currently-saved price. */
  value: number;
  /** Called with the new value when the admin commits a different price. */
  onSave: (next: number) => Promise<void>;
  /** Class applied to the outer wrapper in both view + edit states. */
  className?: string;
  /** Optional override for the formatted display in view mode. */
  formatter?: (n: number) => string;
}

/**
 * Click-to-edit wrapper around a price. View mode reads as a tiny
 * pill-shaped button with a pencil icon that fades in on hover, signalling
 * editability without crowding the static read state. Edit mode swaps in
 * a small text input prefixed with the currency symbol; Enter commits,
 * Escape cancels, and blur commits if the value actually changed.
 *
 * Saves are optimistic in the parent hook (setPrice) so this component
 * doesn't have to manage rollback — it just surfaces a faint loading
 * state while the network call is in flight.
 */
export function InlinePriceEdit({
  value,
  onSave,
  className,
  formatter = formatPrice,
}: InlinePriceEditProps) {
  const [mode, setMode] = useState<"view" | "edit" | "saving">("view");
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Guard against double-fires: pressing Enter triggers commit, which
  // sets the input disabled, which fires onBlur. The ref is the
  // single source of truth for "a commit is already in flight".
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (mode === "edit") {
      // Defer focus + select to the next tick so the input has rendered.
      const id = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [mode]);

  const startEdit = () => {
    setDraft(value.toFixed(2));
    setMode("edit");
  };

  const cancel = () => {
    setMode("view");
    setDraft("");
  };

  const commit = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const parsed = Number(draft);
      // Reject NaN, infinities, and negatives. Zero is allowed in case
      // an admin wants to mark something as a complimentary item.
      if (!Number.isFinite(parsed) || parsed < 0 || parsed === value) {
        cancel();
        return;
      }
      setMode("saving");
      try {
        await onSave(parsed);
      } catch {
        // Hook surfaces its own error toast; nothing else to do here.
      }
      setMode("view");
      setDraft("");
    } finally {
      inFlightRef.current = false;
    }
  };

  if (mode === "view") {
    return (
      <button
        type="button"
        onClick={startEdit}
        className={cn(
          "group/price inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 tabular-nums transition-colors hover:bg-muted",
          className
        )}
        title="Click to edit price"
      >
        {formatter(value)}
        <Pencil
          className="h-3 w-3 opacity-0 transition-opacity group-hover/price:opacity-50"
          strokeWidth={2.4}
          aria-hidden
        />
      </button>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border bg-card px-1.5 transition-colors",
        mode === "saving"
          ? "border-foreground/20 opacity-70"
          : "border-foreground/30 focus-within:border-foreground",
        className
      )}
    >
      <span className="text-xs text-muted-foreground" aria-hidden>
        {CURRENCY_SYMBOL}
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        onBlur={() => {
          if (mode === "edit") void commit();
        }}
        disabled={mode === "saving"}
        aria-label="Edit price"
        className="w-16 bg-transparent py-0.5 tabular-nums focus:outline-none disabled:cursor-wait"
      />
      {mode === "saving" && (
        <Loader2
          className="h-3 w-3 animate-spin text-muted-foreground"
          strokeWidth={2.4}
          aria-hidden
        />
      )}
    </span>
  );
}
