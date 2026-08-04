// Generate favicon + apple-icon + PWA manifest PNGs from the brand logo.
// Run once whenever scripts/assets/logo.png changes — the outputs are
// committed to source. The Next 16 app router conventions pick up
// src/app/icon.{png,svg} and src/app/apple-icon.png automatically; the
// PWA manifest (public/manifest.json) references the public/icons/* set.
//
// R3-3 — the source lives HERE, not in public/. Nothing ever requested
// /brand/logo.png, so serving a 1.5MB original was pure deploy weight; it is
// build-time input to this script and nothing else.
//
//   node scripts/gen-icons.mjs
//
// Closes UX-012 (favicon) + P15.1 (PWA install icons).

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "scripts/assets/logo.png");
const iconOut = resolve(root, "src/app/icon.png");
const appleOut = resolve(root, "src/app/apple-icon.png");
const pwaDir = resolve(root, "public/icons");

// Matches viewport.themeColor in src/app/layout.tsx and the manifest
// background_color — keeps the icon backdrop flush with the app chrome.
const BG = { r: 5, g: 6, b: 7, alpha: 1 };

async function gen(out, size) {
  await mkdir(dirname(out), { recursive: true });
  await sharp(src)
    .resize(size, size, { fit: "contain", background: BG })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`wrote ${out} (${size}×${size})`);
}

// Maskable icon: Android masks to a circle/squircle, so the glyph must sit
// inside an 80% safe zone (10% padding all sides) or it gets clipped.
async function genMaskable(out, size) {
  await mkdir(dirname(out), { recursive: true });
  const inner = Math.round(size * 0.8);
  const logo = await sharp(src)
    .resize(inner, inner, { fit: "contain", background: BG })
    .png()
    .toBuffer();
  const pad = Math.round((size - inner) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, top: pad, left: pad }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`wrote ${out} (${size}×${size}, maskable)`);
}

// Favicon + iOS home-screen (Next app-router conventions)
await gen(iconOut, 32);
await gen(appleOut, 180);

// PWA manifest set
await gen(resolve(pwaDir, "icon-192.png"), 192);
await gen(resolve(pwaDir, "icon-512.png"), 512);
await genMaskable(resolve(pwaDir, "icon-maskable-512.png"), 512);
// 180px apple-touch served from /icons too, referenced by the layout
// apple-touch-icon link (mirrors src/app/apple-icon.png for explicitness).
await gen(resolve(pwaDir, "apple-touch-icon.png"), 180);

console.log("done — icons regenerated");
