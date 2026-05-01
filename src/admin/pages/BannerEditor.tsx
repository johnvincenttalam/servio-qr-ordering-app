import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Trash2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AdminBanner, BannerDraft } from "../useAdminBanners";
import { ConfirmFooterRow } from "../components/ConfirmFooterRow";
import { ImageUpload } from "../components/ImageUpload";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";

interface BannerEditorProps {
  open: boolean;
  banner: AdminBanner | null;
  onClose: () => void;
  onSave: (draft: BannerDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const EMPTY_DRAFT: BannerDraft = {
  image: "",
  title: null,
  subtitle: null,
  active: true,
};

export function BannerEditor({
  open,
  banner,
  onClose,
  onSave,
  onDelete,
}: BannerEditorProps) {
  const isNew = banner === null;
  const { settings } = useRestaurantSettings();
  const [draft, setDraft] = useState<BannerDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmingDelete(false);
      return;
    }
    if (banner) {
      setDraft({
        image: banner.image,
        title: banner.title,
        subtitle: banner.subtitle,
        active: banner.active,
      });
    } else {
      setDraft(EMPTY_DRAFT);
    }
    setError(null);
  }, [open, banner]);

  const isValid = draft.image.trim().length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        image: draft.image.trim(),
        title: draft.title?.trim() || null,
        subtitle: draft.subtitle?.trim() || null,
        active: draft.active,
      });
      toast.success(isNew ? "Banner created" : "Banner saved");
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

  const handleDeleteConfirm = async () => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
      toast.success("Banner deleted");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

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
          <DialogDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isNew ? "Create" : "Edit"}
          </DialogDescription>
          <DialogTitle className="text-base font-bold leading-tight">
            {isNew ? "New banner" : draft.title || "Untitled banner"}
          </DialogTitle>
        </DialogHeader>

        <form
          id="banner-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-5 overflow-y-auto p-5"
        >
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Image
            </label>
            <ImageUpload
              value={draft.image}
              onChange={(url) => setDraft((d) => ({ ...d, image: url }))}
              prefix="banners"
              aspectClass="aspect-[16/9]"
              previewOverlay={<BannerOverlay title={draft.title} subtitle={draft.subtitle} />}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Title{" "}
              <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">
                optional
              </span>
            </label>
            <Input
              value={draft.title ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, title: e.target.value }))
              }
              placeholder={`Welcome to ${settings.name}`}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Subtitle{" "}
              <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">
                optional
              </span>
            </label>
            <Textarea
              value={draft.subtitle ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, subtitle: e.target.value }))
              }
              placeholder="Cooked fresh, served straight to your table."
              rows={2}
              className="rounded-xl"
            />
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={draft.active}
            onClick={() =>
              setDraft((d) => ({ ...d, active: !d.active }))
            }
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/30 active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Active</p>
              <p className="text-xs text-muted-foreground">
                Show in the customer carousel
              </p>
            </div>
            <span
              className={cn(
                "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
                draft.active ? "bg-success" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "h-5 w-5 rounded-full bg-white transition-transform",
                  draft.active ? "translate-x-5" : "translate-x-0"
                )}
              />
            </span>
          </button>
        </form>

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          {confirmingDelete ? (
            <ConfirmFooterRow
              question="Delete this banner permanently?"
              cancelLabel="Keep"
              confirmLabel="Delete"
              pendingLabel="Deleting…"
              pending={deleting}
              onCancel={() => setConfirmingDelete(false)}
              onConfirm={handleDeleteConfirm}
            />
          ) : (
            <div className="flex items-center justify-between gap-2">
              {!isNew && onDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15 active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                  Delete
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
                  form="banner-form"
                  disabled={!isValid || saving}
                  className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {saving ? "Saving…" : isNew ? "Create banner" : "Save changes"}
                </button>
              </div>
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Live preview overlay for the banner editor — renders the title and
 * subtitle on top of the uploaded image with the same gradient-mask
 * treatment the customer-side carousel uses, so admins see exactly
 * what guests will see while they're typing.
 */
function BannerOverlay({
  title,
  subtitle,
}: {
  title: string | null;
  subtitle: string | null;
}) {
  if (!title && !subtitle) return null;
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white">
        {title && (
          <h3 className="text-xl font-bold leading-tight tracking-tight">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="mt-1 text-sm font-medium text-white/85">
            {subtitle}
          </p>
        )}
      </div>
    </>
  );
}
