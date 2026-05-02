/**
 * QR-sticker print helper. Used by the single-table print action in
 * TableQrModal and the bulk-print action on the Tables page so both
 * surfaces produce identical stickers (same template, same page size,
 * same margins). Page breaks are inserted between stickers for the
 * bulk path.
 */
import type { AdminTable } from "@/services/tables";

/**
 * Build the URL the QR points at. Token is included only if one exists,
 * keeping backwards compatibility with stickers printed before tokens
 * were introduced.
 */
export function buildScanUrl(table: AdminTable): string {
  const origin = window.location.origin;
  const params = new URLSearchParams({ t: table.id });
  if (table.qrToken) params.set("k", table.qrToken);
  return `${origin}/?${params.toString()}`;
}

interface StickerInput {
  table: AdminTable;
  /** Already-rendered SVG markup from the qrcode library. */
  svgMarkup: string;
}

/**
 * Generate the SVG markup for a single QR. Lazy-imports the qrcode
 * lib so the customer bundle stays lean.
 */
export async function renderQrSvg(table: AdminTable): Promise<string> {
  const qr = await import("qrcode");
  const url = buildScanUrl(table);
  return qr.toString(url, {
    type: "svg",
    margin: 1,
    width: 320,
    color: { dark: "#0a0a0a", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}

/**
 * "T1" + label "Table 1" is redundant — hide the label when it's just
 * the auto-generated default. Same logic as TableQrModal's preview.
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

const BRAND_ICON_SVG = `
<svg viewBox="0 0 568 568" fill="none" stroke="currentColor" stroke-width="40" stroke-linecap="round" stroke-linejoin="round">
  <path d="M138.5 122.334V235.501C138.5 253.284 153.05 267.834 170.833 267.834H235.5C244.075 267.834 252.299 264.427 258.363 258.364C264.427 252.3 267.833 244.076 267.833 235.501V122.334" />
  <path d="M203.395 122.105V445.894" />
  <path d="M429.501 332.501V122.334C408.063 122.334 387.503 130.85 372.344 146.01C357.184 161.169 348.668 181.729 348.668 203.167V300.167C348.668 317.951 363.218 332.501 381.001 332.501H429.501ZM429.501 332.501V445.667" />
</svg>`;

const SHARED_STYLES = `
@page { margin: 0; size: 80mm 110mm; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #0a0a0a;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.card {
  width: 80mm;
  height: 110mm;
  padding: 7mm;
  box-sizing: border-box;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  page-break-after: always;
}
.card:last-child { page-break-after: auto; }
.brand {
  display: inline-flex;
  align-items: center;
  gap: 1.6mm;
  padding: 1.2mm 2.4mm 1.2mm 1.2mm;
  border-radius: 999px;
  background: #0a0a0a;
  color: #fff;
  font-size: 8.5pt;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4mm;
  height: 4mm;
  border-radius: 1.2mm;
  background: #fff;
  color: #0a0a0a;
}
.brand-icon svg { width: 2.6mm; height: 2.6mm; }
.qr-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4mm;
  width: 100%;
}
.qr svg { width: 58mm; height: 58mm; display: block; }
.scan {
  font-size: 9pt;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: #525252;
  text-transform: uppercase;
}
.id-block { width: 100%; }
.id {
  font-size: 28pt;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
}
.label {
  margin-top: 1mm;
  font-size: 9pt;
  color: #525252;
}
.divider {
  width: 16mm;
  height: 0.6mm;
  background: #0a0a0a;
  border-radius: 999px;
  margin: 2mm auto 0;
}
.tagline {
  margin-top: 2mm;
  font-size: 7.5pt;
  letter-spacing: 0.16em;
  color: #525252;
  text-transform: uppercase;
}
`;

/** Renders one sticker as an HTML card. Caller wraps these in a doc body. */
function buildCardHtml(brandName: string, sticker: StickerInput): string {
  const safeLabel = (sticker.table.label || "").replace(/</g, "&lt;");
  const safeBrand = brandName.replace(/</g, "&lt;");
  const labelHtml =
    !isGenericLabel(sticker.table) && safeLabel
      ? `<div class="label">${safeLabel}</div>`
      : "";

  return `
<div class="card">
  <div class="brand">
    <span class="brand-icon">${BRAND_ICON_SVG}</span>
    <span>${safeBrand}</span>
  </div>
  <div class="qr-wrap">
    <div class="qr">${sticker.svgMarkup}</div>
    <div class="scan">Scan to order</div>
  </div>
  <div class="id-block">
    <div class="id">${sticker.table.id}</div>
    ${labelHtml}
    <div class="divider"></div>
    <div class="tagline">No app · Tap &amp; go</div>
  </div>
</div>`;
}

/**
 * Open a print window with one or more sticker cards. Each card lives
 * on its own page (page-break-after: always) so the printer feeds a
 * single sticker per sheet. Calls window.print() once on load; the
 * caller is responsible for marking tables as printed afterwards.
 *
 * Returns true if the window opened, false if the popup was blocked.
 */
export function openStickerPrintWindow(
  brandName: string,
  stickers: StickerInput[]
): boolean {
  const win = window.open("", "_blank", "width=400,height=560");
  if (!win) return false;

  const cards = stickers.map((s) => buildCardHtml(brandName, s)).join("\n");
  const titleSuffix =
    stickers.length === 1
      ? `· ${stickers[0].table.id}`
      : `· ${stickers.length} stickers`;

  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${brandName.replace(/</g, "&lt;")} ${titleSuffix}</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  ${cards}
  <script>
    window.onload = () => { window.focus(); window.print(); };
  </script>
</body>
</html>`);
  win.document.close();
  return true;
}
