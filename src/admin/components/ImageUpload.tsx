import {
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  Image as ImageIcon,
  Link2,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  uploadMenuImage,
  MenuImageError,
} from "@/lib/menuImageUpload";

interface ImageUploadProps {
  /** Current image URL (Supabase Storage URL or external URL). Empty = no image. */
  value: string;
  onChange: (url: string) => void;
  /** Where to store the upload — "items" or "banners" subfolder of the bucket. */
  prefix: "items" | "banners";
  /** Tailwind class controlling the preview/dropzone aspect (e.g. "aspect-[4/3]"). */
  aspectClass?: string;
  /** Optional content rendered absolutely on top of the preview image (e.g. banner title overlay). */
  previewOverlay?: ReactNode;
  /** Optional class applied to the preview/dropzone wrapper. */
  className?: string;
}

type Mode = "preview" | "uploading" | "url-input" | "error";

/**
 * Drag-and-drop / click-to-pick image input that uploads to Supabase
 * Storage and then writes the resulting public URL back via onChange.
 *
 * Empty state: a dashed dropzone inviting a file or showing a "paste
 * URL" escape hatch for admins who want to use an external image.
 * With a value: a preview with Replace + Remove actions. During upload:
 * a spinner overlay on the dropzone or current preview.
 */
export function ImageUpload({
  value,
  onChange,
  prefix,
  aspectClass = "aspect-[16/9]",
  previewOverlay,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("preview");
  const [error, setError] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFile = async (file: File) => {
    setMode("uploading");
    setError(null);
    try {
      const url = await uploadMenuImage(file, prefix);
      onChange(url);
      setMode("preview");
    } catch (err) {
      const msg =
        err instanceof MenuImageError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Upload failed — try again.";
      setError(msg);
      setMode("error");
    }
  };

  const onPick = () => {
    if (mode === "uploading") return;
    inputRef.current?.click();
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (mode === "uploading") return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (mode !== "uploading") setIsDraggingOver(true);
  };

  const onDragLeave = () => setIsDraggingOver(false);

  const startUrlMode = () => {
    setDraftUrl(value);
    setMode("url-input");
    setError(null);
  };

  const commitUrl = () => {
    const trimmed = draftUrl.trim();
    if (trimmed) onChange(trimmed);
    setMode("preview");
  };

  const cancelUrl = () => {
    setDraftUrl("");
    setMode(value ? "preview" : "preview");
  };

  const remove = () => {
    onChange("");
    setMode("preview");
    setError(null);
  };

  // --- URL input mode --------------------------------------------------
  if (mode === "url-input") {
    return (
      <div className="space-y-2">
        <Input
          type="url"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="https://… or /images/…"
          autoFocus
          className="h-10 rounded-xl"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitUrl();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelUrl();
            }
          }}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={commitUrl}
            disabled={!draftUrl.trim()}
            className="rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use this URL
          </button>
          <button
            type="button"
            onClick={cancelUrl}
            className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-muted active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // --- Empty / dropzone state -----------------------------------------
  if (!value) {
    return (
      <div className="space-y-2">
        <div
          onClick={onPick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPick();
            }
          }}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-center transition-colors",
            aspectClass,
            isDraggingOver
              ? "border-info bg-info/10"
              : "border-border bg-muted hover:border-foreground/40 hover:bg-muted/70",
            mode === "uploading" && "pointer-events-none opacity-70",
            className
          )}
        >
          {mode === "uploading" ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-foreground/60" strokeWidth={2} />
              <p className="text-xs font-semibold text-muted-foreground">
                Uploading…
              </p>
            </>
          ) : (
            <>
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl transition-colors",
                  isDraggingOver
                    ? "bg-info/20 text-info"
                    : "bg-card text-foreground/60"
                )}
              >
                <Upload className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">
                  {isDraggingOver
                    ? "Drop to upload"
                    : "Drop an image or click to pick"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  PNG, JPEG, WebP — up to 5 MB
                </p>
              </div>
            </>
          )}
        </div>

        {error && (
          <ErrorRow message={error} onDismiss={() => setError(null)} />
        )}

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={startUrlMode}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Link2 className="h-3 w-3" strokeWidth={2.4} />
            Or paste a URL
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            // Reset so picking the same file twice still fires onChange.
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  // --- Preview state ---------------------------------------------------
  return (
    <div className="space-y-2">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "group relative w-full overflow-hidden rounded-2xl border bg-muted transition-colors",
          aspectClass,
          isDraggingOver ? "border-info ring-2 ring-info/40" : "border-border",
          className
        )}
      >
        <img
          src={value}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
          }}
        />
        {previewOverlay}

        {mode === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-background" strokeWidth={2} />
          </div>
        )}

        {/* Action overlay — visible on hover/focus-within/drag, plus an
            always-visible tap target on touch devices via the chip
            position. */}
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPick}
            disabled={mode === "uploading"}
            title="Replace image"
            className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-3 w-3" strokeWidth={2.4} />
            Replace
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={mode === "uploading"}
            title="Remove image"
            aria-label="Remove image"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm backdrop-blur-sm transition-colors hover:bg-background active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {error && <ErrorRow message={error} onDismiss={() => setError(null)} />}

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={startUrlMode}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Link2 className="h-3 w-3" strokeWidth={2.4} />
          Use a URL instead
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ErrorRow({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      className="flex w-full items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/15"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{message}</span>
      <span className="text-[10px] opacity-60">Dismiss</span>
    </button>
  );
}

export const ImageUploadEmptyIcon = ImageIcon;
