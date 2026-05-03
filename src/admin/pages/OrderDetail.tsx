import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Gift,
  MoreVertical,
  Shield,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Menu } from "@base-ui/react/menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatPrice, formatRelative } from "@/utils";
import {
  ADMIN_STATUS_ICON,
  ADMIN_STATUS_LABEL,
  ADMIN_STATUS_PILL,
  ADMIN_STATUS_PROGRESSION,
} from "../orderStatus";
import { ConfirmFooterRow } from "../components/ConfirmFooterRow";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import type {
  AdminItemModResult,
  AdminOrder,
  AdminOrderItem,
  AdminOrderStatus,
} from "../useAdminOrders";

/** Preset reasons surfaced as quick-tap chips. "Other" reveals a free-text fallback. */
const COMP_REASONS = [
  "Kitchen burn",
  "Wrong order",
  "Customer complaint",
  "Allergy",
  "Promo",
  "Other",
] as const;
const REMOVE_REASONS = [
  "Wrong item",
  "Out of stock",
  "Customer changed mind",
  "Allergy",
  "Other",
] as const;
const UNCOMP_REASONS = [
  "Comped wrong line",
  "Customer paid",
  "Restored",
  "Other",
] as const;

interface OrderDetailProps {
  open: boolean;
  order: AdminOrder | null;
  onClose: () => void;
  onSetStatus: (id: string, status: AdminOrderStatus) => Promise<void>;
  /** Anti-abuse — flip requires_review off so the kitchen sees the ticket. */
  onApproveHeld?: (id: string) => Promise<void>;
  /** Anti-abuse — block this order's device id from future submissions. */
  onBlockDevice?: (deviceId: string, reason?: string) => Promise<void>;
  /** Phase C.1 — comp a single line on this order. */
  onCompItem?: (
    orderId: string,
    lineId: string,
    reason: string
  ) => Promise<AdminItemModResult>;
  /** Phase C.1 — reverse a comp on a single line. */
  onUncompItem?: (
    orderId: string,
    lineId: string,
    reason: string
  ) => Promise<AdminItemModResult>;
  /** Phase C.1 — remove a single line. Order auto-cancels if it was the last line. */
  onRemoveItem?: (
    orderId: string,
    lineId: string,
    reason: string
  ) => Promise<AdminItemModResult>;
}

export function OrderDetail({
  open,
  order,
  onClose,
  onSetStatus,
  onApproveHeld,
  onBlockDevice,
  onCompItem,
  onUncompItem,
  onRemoveItem,
}: OrderDetailProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) {
      setConfirmingCancel(false);
      setConfirmingBlock(false);
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [open]);

  if (!order) return null;

  const isTerminal = order.status === "served" || order.status === "cancelled";
  const Icon = ADMIN_STATUS_ICON[order.status];

  const handleStatus = async (next: AdminOrderStatus) => {
    if (next === order.status || pending) return;
    setPending(true);
    try {
      await onSetStatus(order.id, next);
      toast.success(`Order ${order.id} set to ${ADMIN_STATUS_LABEL[next]}`);
    } finally {
      setPending(false);
    }
  };

  const handleCancel = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onSetStatus(order.id, "cancelled");
      toast.success(`Order ${order.id} cancelled`);
      onClose();
    } finally {
      setPending(false);
      setConfirmingCancel(false);
    }
  };

  const handleApproveHeld = async () => {
    if (pending || !onApproveHeld) return;
    setPending(true);
    try {
      await onApproveHeld(order.id);
    } finally {
      setPending(false);
    }
  };

  const handleBlockDevice = async () => {
    if (pending || !onBlockDevice || !order.deviceId) return;
    setPending(true);
    try {
      await onBlockDevice(order.deviceId, `order ${order.id}`);
      // Cancel the order at the same time — staff blocks a device because
      // they don't want this order either.
      await onSetStatus(order.id, "cancelled");
      onClose();
    } finally {
      setPending(false);
      setConfirmingBlock(false);
    }
  };

  const subtotal = order.items.reduce(
    (sum, it) => sum + it.unitPrice * it.quantity,
    0
  );

  // Per-item editing — comp / remove — is server-gated on
  // status NOT IN ('served','cancelled'). Mirror the rule client-side
  // so we don't render kebabs that'd just toast "STATUS_LOCKED".
  const canEditItems =
    order.status !== "served" && order.status !== "cancelled";

  // Comp summary for the totals section. unit_price is 0 on a comped
  // line so the running subtotal already excludes it; we just render
  // a count + estimated value-off using base_price * quantity.
  const compedItems = order.items.filter((it) => it.compedAt !== null);
  const compedValue = compedItems.reduce(
    (sum, it) => sum + it.basePrice * it.quantity,
    0
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[92dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:w-full sm:max-w-2xl"
      >
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogDescription className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {order.id}
              </DialogDescription>
              <DialogTitle className="text-xl font-bold leading-tight">
                Table {order.tableId}
              </DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {order.customerName ? (
                  <>
                    <span className="text-foreground">
                      {order.customerName}
                    </span>{" "}
                    ·{" "}
                  </>
                ) : (
                  "Guest · "
                )}
                {formatRelative(order.createdAt, now)}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                ADMIN_STATUS_PILL[order.status]
              )}
            >
              <Icon className="h-3 w-3" strokeWidth={2.4} />
              {ADMIN_STATUS_LABEL[order.status]}
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Held-for-review callout — only shown while the trigger flag
              is still set. Approving from here flips it off, sending the
              ticket to the kitchen with no other state changes. */}
          {order.requiresReview && order.status === "pending" && (
            <section className="rounded-2xl border border-warning/40 bg-warning/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                  strokeWidth={2.4}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">
                    Held for review
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Flagged by anti-abuse rules
                    {order.riskScore > 0 && (
                      <>
                        {" "}— risk score{" "}
                        <span className="font-semibold text-foreground">
                          {order.riskScore}
                        </span>
                      </>
                    )}
                    . Kitchen won&apos;t see this ticket until you approve.
                  </p>
                </div>
                {onApproveHeld && (
                  <button
                    type="button"
                    onClick={handleApproveHeld}
                    disabled={pending}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" strokeWidth={2.4} />
                    Approve
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Items */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Items ({order.items.reduce((sum, it) => sum + it.quantity, 0)})
            </h3>
            <ul className="mt-2 space-y-2">
              {order.items.map((item) => (
                <ItemRow
                  key={item.lineId}
                  item={item}
                  canEdit={canEditItems}
                  onComp={
                    onCompItem
                      ? (reason) => onCompItem(order.id, item.lineId, reason)
                      : undefined
                  }
                  onUncomp={
                    onUncompItem
                      ? (reason) => onUncompItem(order.id, item.lineId, reason)
                      : undefined
                  }
                  onRemove={
                    onRemoveItem
                      ? (reason) => onRemoveItem(order.id, item.lineId, reason)
                      : undefined
                  }
                />
              ))}
            </ul>
          </section>

          {/* Special instructions */}
          {order.notes && (
            <section className="rounded-2xl border-2 border-dashed border-border bg-muted/40 p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Special instructions
              </h3>
              <p className="mt-1 text-sm font-medium">{order.notes}</p>
            </section>
          )}

          {/* Totals */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">
                {formatPrice(subtotal)}
              </span>
            </div>
            {compedItems.length > 0 && (
              <div className="mt-1 flex justify-between text-xs text-success">
                <span className="inline-flex items-center gap-1">
                  <Gift aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
                  {compedItems.length} comped
                </span>
                <span className="font-medium tabular-nums">
                  −{formatPrice(compedValue)}
                </span>
              </div>
            )}
            <div className="mt-2 flex items-baseline justify-between border-t border-dashed border-border pt-2">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold tabular-nums">
                {formatPrice(order.total)}
              </span>
            </div>
          </section>

          {/* Status control */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </h3>
            <SegmentedControl
              value={order.status}
              onChange={(s) => handleStatus(s)}
              options={ADMIN_STATUS_PROGRESSION.map((id) => ({
                id,
                label: ADMIN_STATUS_LABEL[id],
              }))}
              variant="filled"
              fill
              disabled={pending}
              ariaLabel="Order status"
              className="mt-2"
            />
            {order.status === "cancelled" && (
              <p className="mt-2 text-xs text-muted-foreground">
                This order is cancelled. Set it to a different status to
                reactivate.
              </p>
            )}
          </section>
        </div>

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          {confirmingCancel ? (
            <ConfirmFooterRow
              question={
                <>
                  Cancel order <span className="font-bold">{order.id}</span>?
                </>
              }
              cancelLabel="Keep order"
              confirmLabel="Cancel order"
              pendingLabel="Cancelling…"
              pending={pending}
              onCancel={() => setConfirmingCancel(false)}
              onConfirm={handleCancel}
            />
          ) : confirmingBlock ? (
            <ConfirmFooterRow
              question={
                <>
                  Block this device? They&apos;ll have to ask staff to be
                  unblocked. The current order will be cancelled too.
                </>
              }
              cancelLabel="Cancel"
              confirmLabel="Block + Cancel"
              pendingLabel="Blocking…"
              pending={pending}
              onCancel={() => setConfirmingBlock(false)}
              onConfirm={handleBlockDevice}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {!isTerminal && order.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(true)}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15 active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Cancel order
                  </button>
                )}
                {order.deviceId && onBlockDevice && (
                  <button
                    type="button"
                    onClick={() => setConfirmingBlock(true)}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground active:scale-95 disabled:opacity-50"
                  >
                    <Shield className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Block device
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
              >
                Close
              </button>
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Single line in the items list. Static when canEdit is false (terminal
 * statuses) and when no action handler is supplied. Otherwise the row
 * gets a kebab that expands an inline reason picker — a row of preset
 * chips followed by an optional free-text fallback when "Other" is
 * picked. Comped lines get an Uncomp action instead of Comp; everyone
 * gets Remove.
 */
type ItemMode = "idle" | "comping" | "uncomping" | "removing";

function ItemRow({
  item,
  canEdit,
  onComp,
  onUncomp,
  onRemove,
}: {
  item: AdminOrderItem;
  canEdit: boolean;
  onComp?: (reason: string) => Promise<AdminItemModResult>;
  onUncomp?: (reason: string) => Promise<AdminItemModResult>;
  onRemove?: (reason: string) => Promise<AdminItemModResult>;
}) {
  const [mode, setMode] = useState<ItemMode>("idle");
  const [pending, setPending] = useState(false);

  const isComped = item.compedAt !== null;
  const lineTotal = item.unitPrice * item.quantity;
  const selectionLabel =
    item.selections.length > 0
      ? item.selections.map((s) => s.choiceName).join(" · ")
      : null;
  const showActions =
    canEdit &&
    (Boolean(isComped ? onUncomp : onComp) || Boolean(onRemove));

  const handleSubmit = async (reason: string) => {
    if (!reason.trim()) return;
    setPending(true);
    try {
      if (mode === "comping" && onComp) {
        const result = await onComp(reason.trim());
        if (result.ok) setMode("idle");
      } else if (mode === "uncomping" && onUncomp) {
        const result = await onUncomp(reason.trim());
        if (result.ok) setMode("idle");
      } else if (mode === "removing" && onRemove) {
        const result = await onRemove(reason.trim());
        if (result.ok) setMode("idle");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <li className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-3 p-3">
        <img
          src={item.image}
          alt={item.name}
          className={cn(
            "h-12 w-12 shrink-0 rounded-xl border border-border object-cover",
            isComped && "grayscale opacity-60"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm font-semibold",
                isComped && "text-muted-foreground line-through"
              )}
            >
              {item.name}
            </span>
            <span
              className={cn(
                "shrink-0 text-sm font-bold tabular-nums",
                isComped && "text-success"
              )}
            >
              {isComped ? "Comped" : formatPrice(lineTotal)}
            </span>
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>×{item.quantity}</span>
            {selectionLabel && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{selectionLabel}</span>
              </>
            )}
            {isComped && item.compReason && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 text-success">
                  <Gift
                    aria-hidden="true"
                    className="h-3 w-3"
                    strokeWidth={2.4}
                  />
                  {item.compReason}
                </span>
              </>
            )}
          </p>
        </div>

        {showActions && mode === "idle" && (
          <ItemKebab
            itemName={item.name}
            isComped={isComped}
            onComp={
              !isComped && onComp ? () => setMode("comping") : undefined
            }
            onUncomp={
              isComped && onUncomp ? () => setMode("uncomping") : undefined
            }
            onRemove={onRemove ? () => setMode("removing") : undefined}
          />
        )}
      </div>

      {mode !== "idle" && (
        <ReasonPicker
          mode={mode}
          itemName={item.name}
          pending={pending}
          onSubmit={handleSubmit}
          onCancel={() => setMode("idle")}
        />
      )}
    </li>
  );
}

function ItemKebab({
  itemName,
  isComped,
  onComp,
  onUncomp,
  onRemove,
}: {
  itemName: string;
  isComped: boolean;
  onComp?: () => void;
  onUncomp?: () => void;
  onRemove?: () => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Modify ${itemName}`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/30 focus-visible:outline-offset-2"
      >
        <MoreVertical aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="end" className="z-[60]">
          <Menu.Popup className="min-w-[140px] origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            {!isComped && onComp && (
              <Menu.Item
                onClick={onComp}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors data-highlighted:bg-muted"
              >
                <Gift aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
                Comp item
              </Menu.Item>
            )}
            {isComped && onUncomp && (
              <Menu.Item
                onClick={onUncomp}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors data-highlighted:bg-muted"
              >
                <Undo2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
                Uncomp
              </Menu.Item>
            )}
            {onRemove && (
              <Menu.Item
                onClick={onRemove}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive outline-none transition-colors data-highlighted:bg-destructive/10"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
                Remove
              </Menu.Item>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ReasonPicker({
  mode,
  itemName,
  pending,
  onSubmit,
  onCancel,
}: {
  mode: "comping" | "uncomping" | "removing";
  itemName: string;
  pending: boolean;
  onSubmit: (reason: string) => Promise<void>;
  onCancel: () => void;
}) {
  const reasons =
    mode === "comping"
      ? COMP_REASONS
      : mode === "uncomping"
      ? UNCOMP_REASONS
      : REMOVE_REASONS;
  const action =
    mode === "comping" ? "Comp" : mode === "uncomping" ? "Uncomp" : "Remove";
  const [picked, setPicked] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");

  const isOther = picked === "Other";
  const reason = isOther ? otherText : picked ?? "";
  const canSubmit = !pending && reason.trim().length > 0;

  return (
    <div className="border-t border-border bg-muted/30 p-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {action} {itemName} — reason
      </p>
      <div className="flex flex-wrap gap-1.5">
        {reasons.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setPicked(r);
              if (r !== "Other") setOtherText("");
            }}
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors active:scale-95",
              picked === r
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground/70 hover:border-foreground/40 hover:text-foreground"
            )}
          >
            {r}
          </button>
        ))}
      </div>
      {isOther && (
        <input
          type="text"
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          placeholder="Type a short reason"
          maxLength={80}
          autoFocus
          className="h-9 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none"
        />
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-semibold text-foreground/70 hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
        >
          <X aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSubmit(reason)}
          disabled={!canSubmit}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-semibold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
            mode === "removing"
              ? "bg-destructive text-white hover:scale-[1.02]"
              : mode === "uncomping"
              ? "bg-foreground text-background hover:scale-[1.02]"
              : "bg-success text-white hover:scale-[1.02]"
          )}
        >
          <Check aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
          {pending ? `${action}ing…` : action}
        </button>
      </div>
    </div>
  );
}
