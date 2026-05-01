import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Download,
  Printer,
  RotateCw,
  Utensils,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmFooterRow } from "../components/ConfirmFooterRow";
import type { AdminTable } from "../useAdminTables";

interface TableQrModalProps {
  open: boolean;
  table: AdminTable | null;
  onClose: () => void;
  onRotate: (id: string) => Promise<string>;
}

/**
 * Build the URL the QR points at. Token is included only if one exists,
 * keeping backwards compatibility with stickers printed before tokens
 * were introduced.
 */
function buildScanUrl(table: AdminTable): string {
  const origin = window.location.origin;
  const params = new URLSearchParams({ t: table.id });
  if (table.qrToken) params.set("k", table.qrToken);
  return `${origin}/?${params.toString()}`;
}

export function TableQrModal({
  open,
  table,
  onClose,
  onRotate,
}: TableQrModalProps) {
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
        // Lazy-load qrcode so it doesn't bloat the customer bundle
        const qr = await import("qrcode");
        const url = buildScanUrl(table);
        const svg = await qr.toString(url, {
          type: "svg",
          margin: 1,
          width: 320,
          color: { dark: "#0a0a0a", light: "#ffffff" },
          errorCorrectionLevel: "M",
        });
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
    const win = window.open("", "_blank", "width=400,height=560");
    if (!win) {
      toast.error("Browser blocked the print window.");
      return;
    }
    const safeLabel = (table.label || "").replace(/</g, "&lt;");
    win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SERVIO · ${table.id}</title>
  <style>
    @page { margin: 0; size: 80mm 110mm; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #0a0a0a;
    }
    .card {
      width: 80mm;
      padding: 8mm;
      box-sizing: border-box;
      text-align: center;
    }
    .brand {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.2em;
      color: #525252;
      text-transform: uppercase;
      margin-bottom: 2mm;
    }
    .qr { display: flex; justify-content: center; }
    .qr svg { width: 60mm; height: 60mm; }
    .id {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-top: 4mm;
    }
    .label {
      font-size: 12px;
      color: #525252;
      margin-top: 1mm;
    }
    .scan {
      font-size: 10px;
      color: #525252;
      margin-top: 4mm;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">SERVIO</div>
    <div class="qr">${svgMarkup}</div>
    <div class="id">${table.id}</div>
    <div class="label">${safeLabel}</div>
    <div class="scan">Scan to order</div>
  </div>
  <script>
    window.onload = () => { window.focus(); window.print(); };
  </script>
</body>
</html>`);
    win.document.close();
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
        </DialogHeader>

        {table && (
          <div className="flex flex-col items-center gap-4 px-5 py-6">
            <div className="flex w-full max-w-[280px] flex-col items-center gap-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground text-background">
                  <Utensils className="h-3 w-3" strokeWidth={2.6} />
                </span>
                SERVIO
              </div>

              <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-border bg-background p-3">
                {svgMarkup ? (
                  <div
                    className="h-full w-full"
                    // We trust this output: it's generated client-side
                    // by the qrcode lib from a URL we built ourselves.
                    dangerouslySetInnerHTML={{ __html: svgMarkup }}
                  />
                ) : error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : (
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
                )}
              </div>

              <div>
                <p className="text-2xl font-extrabold leading-none tracking-tight">
                  {table.id}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {table.label}
                </p>
              </div>
            </div>

            <div className="flex w-full items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={!svgMarkup}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
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
                SVG
              </button>
            </div>

            {!table.qrToken && (
              <div className="flex w-full items-start gap-2 rounded-2xl border border-warning/40 bg-warning/15 p-3 text-[11px] text-foreground">
                <AlertCircle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  strokeWidth={2.4}
                />
                <p>
                  This table has no QR token yet — the URL is guessable.
                  Generate one below to lock this sticker to a fresh code.
                </p>
              </div>
            )}
          </div>
        )}

        <footer className="border-t border-border bg-muted/40 px-5 py-3">
          {confirmingRotate && table ? (
            <ConfirmFooterRow
              question={
                <>
                  Rotate token for{" "}
                  <span className="font-bold">{table.id}</span>? Existing
                  printed stickers will stop working.
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
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setConfirmingRotate(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground active:scale-95"
              >
                <RotateCw className="h-3.5 w-3.5" strokeWidth={2.2} />
                {table?.qrToken ? "Rotate token" : "Generate token"}
              </button>
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
