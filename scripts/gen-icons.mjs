/* eslint-disable no-console */
// Generate favicon + apple-icon PNGs from the brand logo. Run once
// whenever public/brand/logo.png changes — the outputs are committed
// to source under src/app/. The Next 16 app router conventions pick
// up src/app/icon.{png,svg} and src/app/apple-icon.png automatically.
//
//   node scripts/gen-icons.mjs
//
// Closes UX-012 (favicon was the old placeholder MM SVG).

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "public/brand/logo.png");
const iconOut = resolve(root, "src/app/icon.png");
const appleOut = resolve(root, "src/app/apple-icon.png");

async function gen(out, size) {
  await mkdir(dirname(out), { recursive: true });
  await sharp(src)
    .resize(size, size, {
      fit: "contain",
      background: { r: 5, g: 6, b: 7, alpha: 1 }, // matches --color-bg
    })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`wrote ${out} (${size}×${size})`);
}

await gen(iconOut, 32);
await gen(appleOut, 180);
console.log("done — icons regenerated");
