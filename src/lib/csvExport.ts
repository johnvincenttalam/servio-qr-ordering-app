/**
 * Tiny CSV helpers — escape per RFC 4180, build a CSV string from a
 * header + rows array, and trigger a browser download via Blob URL.
 *
 * No external dependency. Excel detects UTF-8 correctly when the
 * file starts with a BOM, so downloadCsv prepends one.
 */

/**
 * Escape a single cell value for CSV. Wraps in quotes when the value
 * contains a comma, quote, or newline; doubles internal quotes per
 * the spec. null / undefined render as the empty string so missing
 * fields don't print "undefined".
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialise a header row + body rows into a single CSV string.
 * Cell-by-cell escape; CRLF terminators (RFC 4180 / Excel-friendly).
 */
export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const bodyLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...bodyLines].join("\r\n");
}

/**
 * Trigger a browser download of the given CSV text under the given
 * filename. Prepends a UTF-8 BOM so Excel renders accented chars
 * correctly out of the box.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
