import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";

interface ConfirmFooterRowProps {
  question: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Inline confirmation row used inside dialog footers when a destructive
 * action needs a second click — replaces window.confirm() across the
 * admin shell. Drop it inside the existing <footer> in place of the
 * normal action row when a `confirming…` flag is true.
 */
export function ConfirmFooterRow({
  question,
  cancelLabel = "Cancel",
  confirmLabel,
  pendingLabel,
  pending = false,
  onCancel,
  onConfirm,
}: ConfirmFooterRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-medium text-foreground">{question}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-full px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
          {pending && pendingLabel ? pendingLabel : confirmLabel}
        </button>
      </div>
    </div>
  );
}
