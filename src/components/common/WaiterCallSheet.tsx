import { useEffect, useState } from "react";
import { Bell, Receipt, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useWaiterCall } from "@/hooks/useWaiterCall";
import { cn } from "@/lib/utils";
import type { WaiterCallKind } from "@/types";

interface WaiterCallSheetProps {
  open: boolean;
  onClose: () => void;
  tableId: string | null;
  /** When set, calls are linked to this order so staff see the context. */
  orderId?: string | null;
  /** When false, only Service is offered (no order yet, bill makes no sense). */
  showBill?: boolean;
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting"; choice: WaiterCallKind }
  | { kind: "success"; choice: WaiterCallKind }
  | { kind: "error"; message: string };

export function WaiterCallSheet({
  open,
  onClose,
  tableId,
  orderId = null,
  showBill = true,
}: WaiterCallSheetProps) {
  const { call, cooldown, inflight } = useWaiterCall(tableId);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) {
      setState({ kind: "idle" });
      setNote("");
    }
  }, [open]);

  const submit = async (kind: WaiterCallKind) => {
    if (!tableId) return;
    setState({ kind: "submitting", choice: kind });
    const result = await call(tableId, kind, {
      orderId,
      note: note.trim() || null,
    });
    if (result.ok) {
      setState({ kind: "success", choice: kind });
      // Auto-dismiss the sheet after a moment so the user can keep ordering.
      window.setTimeout(() => onClose(), 1400);
    } else if (result.reason === "cooldown") {
      const seconds = Math.ceil((result.retryInMs ?? 60_000) / 1000);
      toast.message(`Already on the way — please wait ${seconds}s`);
      onClose();
    } else {
      setState({
        kind: "error",
        message: result.message ?? "Couldn't reach the kitchen — try again.",
      });
    }
  };

  const isSubmitting = state.kind === "submitting";
  const isSuccess = state.kind === "success";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isSubmitting) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!isSubmitting}
        className="w-[calc(100%-2rem)] gap-0 rounded-3xl p-0 sm:w-full sm:max-w-md"
      >
        <div className="px-5 pb-5 pt-6 text-center">
          <DialogTitle className="text-xl font-bold tracking-tight">
            {isSuccess ? "We've notified the staff" : "Need help?"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {isSuccess
              ? "Someone will be with you shortly."
              : tableId
              ? `Sending from Table ${tableId}`
              : "Scan a table QR first"}
          </DialogDescription>
        </div>

        {isSuccess ? (
          <div className="flex flex-col items-center px-5 pb-7">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="h-7 w-7" strokeWidth={2.6} />
            </div>
          </div>
        ) : (
          <div className="space-y-3 px-5 pb-5">
            <ChoiceRow
              icon={Bell}
              title="Call waiter"
              subtitle="Service, water, utensils — anything."
              disabled={!tableId || cooldown.service > 0 || isSubmitting}
              cooldownMs={cooldown.service}
              loading={inflight === "service"}
              onClick={() => submit("service")}
            />

            {showBill && (
              <ChoiceRow
                icon={Receipt}
                title="Request bill"
                subtitle="Ready to settle the check."
                disabled={!tableId || cooldown.bill > 0 || isSubmitting}
                cooldownMs={cooldown.bill}
                loading={inflight === "bill"}
                onClick={() => submit("bill")}
              />
            )}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              aria-label="Optional note for the staff"
              rows={2}
              maxLength={140}
              disabled={isSubmitting}
              className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none disabled:opacity-50"
            />

            {state.kind === "error" && (
              <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>{state.message}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ChoiceRowProps {
  icon: typeof Bell;
  title: string;
  subtitle: string;
  disabled: boolean;
  cooldownMs: number;
  loading: boolean;
  onClick: () => void;
}

function ChoiceRow({
  icon: Icon,
  title,
  subtitle,
  disabled,
  cooldownMs,
  loading,
  onClick,
}: ChoiceRowProps) {
  const seconds = Math.ceil(cooldownMs / 1000);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all",
        "hover:border-foreground/30 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:active:scale-100"
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {cooldownMs > 0 ? `Try again in ${seconds}s` : subtitle}
        </p>
      </div>
      {loading && (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      )}
    </button>
  );
}
