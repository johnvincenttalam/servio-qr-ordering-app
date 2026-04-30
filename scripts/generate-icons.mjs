// One-shot script: render PWA icons (and notification icons) from the brand mark.
// Black rounded square background + white lucide "Utensils" stroke, matching the splash.
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

function buildSvg(size) {
  const radius = Math.round(size * 0.22);
  // Icon fills 50% of canvas. The lucide path is on a 24-unit grid,
  // so scale = (size * 0.5) / 24 maps the 24-grid to half the canvas.
  const iconSize = size * 0.5;
  const scale = iconSize / 24;
  const iconOffset = (size - iconSize) / 2;
  const stroke = 2.2; // in 24-unit grid coords; scaled along with the path

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#1a1a1a"/>
  <g transform="translate(${iconOffset} ${iconOffset}) scale(${scale})"
     fill="none" stroke="#fafaf7" stroke-width="${stroke}"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
    <path d="M7 2v20"/>
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
  </g>
</svg>`;
}

async function render(size, filename) {
  const svg = buildSvg(size);
  const out = resolve(outDir, filename);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log(`✓ ${filename}  (${size}×${size})`);
}

// Notification badge: monochrome silhouette (white on transparent),
// because Android/Chrome desaturate the badge anyway.
function buildBadgeSvg(size) {
  const iconSize = size * 0.7;
  const scale = iconSize / 24;
  const iconOffset = (size - iconSize) / 2;
  const stroke = 2.4;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${iconOffset} ${iconOffset}) scale(${scale})"
     fill="none" stroke="#ffffff" stroke-width="${stroke}"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
    <path d="M7 2v20"/>
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
  </g>
</svg>`;
}

async function renderBadge(size, filename) {
  const svg = buildBadgeSvg(size);
  const out = resolve(outDir, filename);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log(`✓ ${filename}  (${size}×${size}, badge)`);
}

await render(192, "icon-192.png");
await render(512, "icon-512.png");
await renderBadge(96, "badge-96.png");

console.log(`\nWrote icons to ${outDir}`);
