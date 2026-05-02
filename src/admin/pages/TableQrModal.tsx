import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Printer,
  RotateCw,
} from "lucide-react";
import { BrandMark } from "@/components/common/BrandMark";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";
import { ConfirmFooterRow } from "../components/ConfirmFooterRow";
import { openStickerPrintWindow, renderQrSvg } from "../qrPrint";
import type { AdminTable } from "../useAdminTables";

interface TableQrModalProps {
  open: boolean;
  table: AdminTable | null;
  onClose: () => void;
  onRotate: (id: string) => Promise<string>;
  /** Mark the sticker as freshly printed so the reprint badge clears. */
  onMarkPrinted: (id: string, qrToken: string) => Promise<void>;
}

export function TableQrModal({
  open,
  table,
  onClose,
  onRotate,
  onMarkPrinted,
}: TableQrModalProps) {
  const { settings } = useRestaurantSettings();
  const brandName = settings.name;
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [rotating, setRotating] = useState(false);

  // Reset transient state on open / close so a second open starts clean
  useEffect(() => {
    if (!open) {
      setConfirmingRotate(false);
      setRotating(false);
      setError(null);
    }
  }, [open]);

  // Re-render the QR whenever the table or its token changes
  useEffect(() => {
    if (!open || !table) {
      setSvgMarkup(null);
      return;
    }

    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const svg = await renderQrSvg(table);
        if (!cancelled) setSvgMarkup(svg);
      } catch (err) {
        console.error("[qr] render failed:", err);
        if (!cancelled) setError("Couldn't render the QR code.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, table]);

  const handleRotate = async () => {
    if (!table || rotating) return;
    setRotating(true);
    try {
      await onRotate(table.id);
      toast.success("Token rotated. Reprint this sticker.");
      setConfirmingRotate(false);
    } catch {
      // toast already raised in the hook on failure
    } finally {
      setRotating(false);
    }
  };

  const handleDownload = () => {
    if (!svgMarkup || !table) return;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `servio-${table.id}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!table || !svgMarkup) return;
    const opened = openStickerPrintWindow(brandName, [
      { table, svgMarkup },
    ]);
    if (!opened) {
      toast.error("Browser blocked the print window.");
      return;
    }
    // Optimistically mark as printed when the print window opens. We
    // can't reliably tell whether the user actually printed vs. cancelled,
    // but triggering the print intent + getting the badge to clear is
    // the right default — operator can rotate manually to re-flag if
    // they cancelled and need to redo it.
    if (table.qrToken) {
      void onMarkPrinted(table.id, table.qrToken);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !rotating) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!rotating}
        className="w-[calc(100%-2rem)] gap-0 rounded-3xl p-0 sm:w-full sm:max-w-md"
      >
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            QR code
          </DialogDescription>
          <DialogTitle className="text-xl font-bold leading-tight">
            {table ? `Table ${table.id}` : "—"}
          </DialogTitle>
          {table && (
            <p className="mt-1 text-xs text-muted-foreground">
              Print and stick this on the table — guests scan it to start an
              order.
            </p>
          )}
        </DialogHeader>

        {table && (
          <div className="flex flex-col items-center gap-4 px-5 py-5">
            {/*
              Sticker preview. Aspect ratio matches the printed output
              (80 × 110mm = 8 / 11) so what the operator sees here is
              what comes out of the printer. Layout mirrors the print
              template: brand chip top, QR with scan-to-order eyebrow
              centred, table id + tagline anchored bottom.
            */}
            <div className="flex w-[240px] flex-col items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 shadow-md shadow-black/5 aspect-[8/11]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-background">
                <BrandMark
                  variant="ghost"
                  className="h-3.5 w-3.5 bg-background text-foreground"
                />
                <span className="truncate">{brandName}</span>
              </span>

              <div className="flex flex-col items-center gap-2">
                <div className="flex aspect-square w-[150px] items-center justify-center">
                  {svgMarkup ? (
                    <div
                      // The qrcode lib bakes width/height attributes onto
                      // the <svg> root. Force descendant svg to fill the
                      // slot so the QR doesn't overflow at its intrinsic
                      // 320×320 size.
                      className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: svgMarkup }}
                    />
                  ) : error ? (
                    <p className="text-[10px] text-destructive">{error}</p>
                  ) : (
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
                  )}
                </div>
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Scan to order
                </p>
              </div>

              <div className="w-full text-center">
                <p className="text-2xl font-extrabold leading-none tracking-tight">
                  {table.id}
                </p>
                {!isGenericLabel(table) && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {table.label}
                  </p>
                )}
                <span
                  aria-hidden
                  className="mx-auto mt-2 block h-[2px] w-10 rounded-full bg-foreground"
                />
                <p className="mt-1.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                  No app · Tap &amp; go
                </p>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={!svgMarkup}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                <Printer className="h-3.5 w-3.5" strokeWidth={2.4} />
                Print sticker
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!svgMarkup}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground active:scale-95 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2.4} />
                Download SVG
              </button>
            </div>

            <div className="flex w-full flex-col items-center gap-1.5 text-center">
              <p className="font-mono text-[10px] text-muted-foreground/80 break-all">
                {previewEncodedUrl(table)}
              </p>
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <span>
                  {table.qrToken
                    ? "Trouble with the QR?"
                    : "No token yet — the URL is guessable."}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmingRotate(true)}
                  className="inline-flex items-center gap-1 font-semibold text-destructive/80 underline-offset-2 hover:text-destructive hover:underline"
                >
                  <RotateCw className="h-3 w-3" strokeWidth={2.4} />
                  {table.qrToken ? "Rotate token" : "Generate token"}
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          {confirmingRotate && table ? (
            <ConfirmFooterRow
              question={
                <>
                  {table.qrToken ? "Rotate token for " : "Generate token for "}
                  <span className="font-bold">{table.id}</span>?
                  {table.qrToken &&
                    " The current printed sticker will stop working."}
                </>
              }
              cancelLabel="Cancel"
              confirmLabel={table.qrToken ? "Rotate" : "Generate"}
              pendingLabel={table.qrToken ? "Rotating…" : "Generating…"}
              pending={rotating}
              onCancel={() => setConfirmingRotate(false)}
              onConfirm={handleRotate}
            />
          ) : (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
              >
                Done
              </button>
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "T1" + label "Table 1" is redundant — hide the label when it's just
 * the auto-generated default. Anything custom ("Booth 3", "Bar 2") still
 * renders so the operator sees the descriptor on the preview.
 */
function isGenericLabel(table: AdminTable): boolean {
  if (!table.label) return true;
  const numericTail = table.id.replace(/^[A-Z]+/i, "");
  const candidates = [
    `Table ${numericTail}`,
    `Table ${table.id}`,
    table.id,
  ].map((s) => s.toLowerCase().trim());
  return candidates.includes(table.label.toLowerCase().trim());
}

/**
 * Truncated URL preview for the modal — the operator sees enough to
 * verify the host and table id without the whole hex token taking up
 * three lines. Falls back to "no token" when null.
 */
function previewEncodedUrl(table: AdminTable): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  if (!table.qrToken) return `${origin}/?t=${table.id}`;
  const tokenPreview = `${table.qrToken.slice(0, 6)}…`;
  return `${origin}/?t=${table.id}&k=${tokenPreview}`;
}
