import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Trash2, Sparkles, AlertCircle, ImageIcon, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS } from "@/constants";
import { cn } from "@/lib/utils";
import type { MenuCategory, MenuItem } from "@/types";
import type { MenuItemDraft } from "../useAdminMenu";

interface MenuItemEditorProps {
  open: boolean;
  item: MenuItem | null; // null = create new
  onClose: () => void;
  onSave: (draft: MenuItemDraft) => Promise<void>;
  onArchive?: () => Promise<void>;
}

const EMPTY_DRAFT: MenuItemDraft = {
  name: "",
  price: 0,
  image: "",
  category: "meals",
  description: "",
  topPick: false,
  inStock: true,
};

export function MenuItemEditor({
  open,
  item,
  onClose,
  onSave,
  onArchive,
}: MenuItemEditorProps) {
  const isNew = item === null;
  const [draft, setDraft] = useState<MenuItemDraft>(EMPTY_DRAFT);
  const [priceText, setPriceText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  // Reset confirm state when the drawer closes/changes item
  useEffect(() => {
    if (!open) setConfirmingArchive(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setDraft({
        name: item.name,
        price: item.price,
        image: item.image,
        category: item.category,
        description: item.description,
        topPick: item.topPick ?? false,
        inStock: item.inStock !== false,
        options: item.options,
      });
      setPriceText(String(item.price));
    } else {
      setDraft(EMPTY_DRAFT);
      setPriceText("");
    }
    setError(null);
  }, [open, item]);

  const isValid =
    draft.name.trim().length > 0 &&
    draft.description.trim().length > 0 &&
    draft.image.trim().length > 0 &&
    Number.isFinite(draft.price) &&
    draft.price >= 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid || saving) return;

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: draft.name.trim(),
        price: draft.price,
        image: draft.image.trim(),
        category: draft.category,
        description: draft.description.trim(),
        topPick: draft.topPick,
        inStock: draft.inStock,
        options: draft.options,
      });
      toast.success(isNew ? "Item created" : "Changes saved");
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save. Try again in a moment."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!onArchive || archiving) return;
    setArchiving(true);
    setError(null);
    try {
      await onArchive();
      toast.success(`Archived ${item?.name ?? "item"}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't archive.");
      setConfirmingArchive(false);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:w-full sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isNew ? "Create" : "Edit"}
          </DialogDescription>
          <DialogTitle className="text-base font-bold leading-tight">
            {isNew ? "New menu item" : item!.name}
          </DialogTitle>
        </DialogHeader>

        <form
          id="menu-item-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-5 overflow-y-auto p-5"
        >
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <Field label="Image">
            <ImagePreview src={draft.image} />
            <Input
              type="url"
              value={draft.image}
              onChange={(e) =>
                setDraft((d) => ({ ...d, image: e.target.value }))
              }
              placeholder="https://… or /images/…"
              required
              className="mt-2 h-11 rounded-xl"
            />
          </Field>

          <Field label="Name">
            <Input
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
              placeholder="Grilled Chicken Bowl"
              required
              className="h-11 rounded-xl"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  ₱
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={priceText}
                  onChange={(e) => {
                    setPriceText(e.target.value);
                    const parsed = parseFloat(e.target.value);
                    setDraft((d) => ({
                      ...d,
                      price: Number.isFinite(parsed) ? parsed : 0,
                    }));
                  }}
                  placeholder="0.00"
                  required
                  className="h-11 rounded-xl pl-7"
                />
              </div>
            </Field>
            <Field label="Category">
              <CategoryPicker
                value={draft.category}
                onChange={(c) => setDraft((d) => ({ ...d, category: c }))}
              />
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              value={draft.description}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value }))
              }
              placeholder="What's in it, what makes it special…"
              rows={3}
              required
              className="rounded-xl"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Switch
              label="In stock"
              description="Show on the customer menu and accept orders"
              checked={draft.inStock}
              onChange={(v) => setDraft((d) => ({ ...d, inStock: v }))}
            />
            <Switch
              icon={Sparkles}
              label="Top pick"
              description="Highlight in the Top Picks strip"
              checked={draft.topPick}
              onChange={(v) => setDraft((d) => ({ ...d, topPick: v }))}
            />
          </div>

          {draft.options && draft.options.length > 0 && (
            <Field
              label="Options"
              hint={`${draft.options.length} group${
                draft.options.length === 1 ? "" : "s"
              } — full editor coming soon`}
            >
              <ul className="space-y-2 rounded-2xl border border-dashed border-border bg-muted/40 p-3">
                {draft.options.map((option) => (
                  <li key={option.id} className="text-xs">
                    <p className="font-semibold">
                      {option.name}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({option.required ? "required" : "optional"} ·{" "}
                        {option.type})
                      </span>
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {option.choices
                        .map(
                          (c) =>
                            `${c.name}${
                              c.priceDelta ? ` +₱${c.priceDelta}` : ""
                            }`
                        )
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </Field>
          )}
        </form>

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          {confirmingArchive ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">
                Archive{" "}
                <span className="font-bold">&ldquo;{item?.name}&rdquo;</span>?
                It stays in past orders.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingArchive(false)}
                  disabled={archiving}
                  className="rounded-full px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleArchiveConfirm}
                  disabled={archiving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                  {archiving ? "Archiving…" : "Archive"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              {!isNew && onArchive ? (
                <button
                  type="button"
                  onClick={() => setConfirmingArchive(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15 active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                  Archive
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-full px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="menu-item-form"
                  disabled={!isValid || saving}
                  className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {saving ? "Saving…" : isNew ? "Create item" : "Save changes"}
                </button>
              </div>
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {hint && (
          <span className="ml-2 normal-case tracking-normal text-muted-foreground/80">
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function CategoryPicker({
  value,
  onChange,
}: {
  value: MenuCategory;
  onChange: (value: MenuCategory) => void;
}) {
  const entries = Object.entries(CATEGORY_LABELS) as [MenuCategory, string][];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as MenuCategory)}
        className="h-11 w-full appearance-none rounded-xl border border-border bg-card pl-3 pr-10 text-sm font-medium text-foreground transition-colors hover:border-foreground/30 focus:border-foreground/40 focus:outline-none"
      >
        {entries.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2.2}
      />
    </div>
  );
}

function Switch({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/30 active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />}
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <span
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors",
          checked ? "bg-foreground" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform",
            checked ? "translate-x-[1.125rem]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

function ImagePreview({ src }: { src: string }) {
  if (!src.trim()) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted text-muted-foreground">
        <ImageIcon className="h-6 w-6" strokeWidth={1.6} />
      </div>
    );
  }
  return (
    <div className="aspect-[16/9] w-full overflow-hidden rounded-xl border border-border bg-muted">
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
        }}
      />
    </div>
  );
}
