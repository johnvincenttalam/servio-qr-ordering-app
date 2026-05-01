import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Camera, ImageOff, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AvatarError } from "@/lib/avatarUpload";
import type { StaffMember } from "../useAdminStaff";

interface StaffEditorProps {
  open: boolean;
  member: StaffMember | null;
  onClose: () => void;
  onSaveName: (userId: string, name: string | null) => Promise<void>;
  onUploadAvatar: (userId: string, file: File) => Promise<void>;
  onRemoveAvatar: (userId: string) => Promise<void>;
}

export function StaffEditor({
  open,
  member,
  onClose,
  onSaveName,
  onUploadAvatar,
  onRemoveAvatar,
}: StaffEditorProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form whenever a different member is opened (or modal closes)
  useEffect(() => {
    setName(member?.displayName ?? "");
    setPreviewUrl(null);
    setError(null);
    setSaving(false);
    setUploading(false);
  }, [member, open]);

  if (!member) return null;

  const initial = (
    member.displayName?.[0] ??
    member.email[0] ??
    "?"
  ).toUpperCase();

  const visibleAvatar = previewUrl ?? member.avatarUrl;

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setError(null);
    setUploading(true);

    // Show an instant local preview so the user sees their pick before the
    // upload + crop pipeline finishes.
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    try {
      await onUploadAvatar(member.userId, file);
      toast.success("Avatar updated");
    } catch (err) {
      const message =
        err instanceof AvatarError || err instanceof Error
          ? err.message
          : "Couldn't upload";
      setError(message);
      setPreviewUrl(null);
    } finally {
      URL.revokeObjectURL(localUrl);
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!member.avatarUrl && !previewUrl) return;
    setError(null);
    setUploading(true);
    try {
      await onRemoveAvatar(member.userId);
      setPreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const trimmed = name.trim();
      const next = trimmed.length > 0 ? trimmed : null;
      if (next !== (member.displayName ?? null)) {
        await onSaveName(member.userId, next);
      }
      toast.success("Saved");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const inFlight = saving || uploading;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !inFlight) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!inFlight}
        className="w-[calc(100%-2rem)] gap-0 rounded-3xl p-0 sm:w-full sm:max-w-md"
      >
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Edit
          </DialogDescription>
          <DialogTitle className="text-xl font-bold leading-tight">
            {member.email}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Avatar
            </label>
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-bold text-foreground/70",
                  uploading && "animate-pulse"
                )}
              >
                {visibleAvatar ? (
                  <img
                    src={visibleAvatar}
                    alt={member.email}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handlePickFile}
                  disabled={inFlight}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <Camera className="h-3.5 w-3.5" strokeWidth={2.4} />
                  {member.avatarUrl ? "Replace" : "Upload"}
                </button>
                {(member.avatarUrl || previewUrl) && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={inFlight}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-50"
                  >
                    <ImageOff className="h-3.5 w-3.5" strokeWidth={2.4} />
                    Remove
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground">
                  PNG, JPEG, WebP · max 2 MB · auto-cropped to a square
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="staff-display-name"
              className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Display name{" "}
              <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">
                shown in the sidebar
              </span>
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2.2}
              />
              <Input
                id="staff-display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={member.email.split("@")[0]}
                maxLength={60}
                className="h-11 rounded-xl pl-9"
                autoFocus
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
              disabled={inFlight}
              className="rounded-full px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={inFlight}
              className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
