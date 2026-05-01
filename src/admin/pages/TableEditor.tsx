import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Hash, Type } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AdminTable } from "../useAdminTables";

interface TableEditorProps {
  open: boolean;
  /** null means "create new"; an AdminTable means "edit existing label". */
  table: AdminTable | null;
  isNew: boolean;
  existingIds: readonly string[];
  onClose: () => void;
  onCreate: (draft: { id: string; label: string }) => Promise<void>;
  onSaveLabel: (id: string, label: string) => Promise<void>;
}

export function TableEditor({
  open,
  table,
  isNew,
  existingIds,
  onClose,
  onCreate,
  onSaveLabel,
}: TableEditorProps) {
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setId(isNew ? "" : table?.id ?? "");
    setLabel(table?.label ?? "");
    setError(null);
    setSubmitting(false);
  }, [open, isNew, table]);

  const trimmedId = id.trim().toUpperCase();
  const trimmedLabel = label.trim();
  const idValid = /^[A-Z0-9]{1,8}$/.test(trimmedId);
  const isDuplicate =
    isNew && existingIds.includes(trimmedId);
  const canSubmit =
    trimmedLabel.length > 0 &&
    (!isNew || (idValid && !isDuplicate));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      if (isNew) {
        await onCreate({ id: trimmedId, label: trimmedLabel });
        toast.success(`Table ${trimmedId} created`);
      } else if (table) {
        await onSaveLabel(table.id, trimmedLabel);
        toast.success(`Saved`);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save — try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!submitting}
        className="w-[calc(100%-2rem)] gap-0 rounded-3xl p-0 sm:w-full sm:max-w-md"
      >
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isNew ? "New table" : "Edit table"}
          </DialogDescription>
          <DialogTitle className="text-xl font-bold leading-tight">
            {isNew ? "Add a table" : `Table ${table?.id}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {isNew && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ID{" "}
                <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">
                  used in the QR URL
                </span>
              </label>
              <div className="relative">
                <Hash
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={2.2}
                />
                <Input
                  value={id}
                  onChange={(e) => setId(e.target.value.toUpperCase())}
                  placeholder="T11"
                  autoFocus
                  required
                  maxLength={8}
                  className="h-11 rounded-xl pl-9 font-mono uppercase tracking-wider"
                />
              </div>
              {trimmedId && !idValid && (
                <p className="text-[11px] text-destructive">
                  Use 1–8 letters or digits, e.g. T11 or BAR1.
                </p>
              )}
              {isDuplicate && (
                <p className="text-[11px] text-destructive">
                  A table with id {trimmedId} already exists.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Label
            </label>
            <div className="relative">
              <Type
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2.2}
              />
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Booth 3 · Window seat · …"
                required
                maxLength={60}
                className="h-11 rounded-xl pl-9"
                autoFocus={!isNew}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </form>

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {submitting ? "Saving…" : isNew ? "Create table" : "Save"}
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
