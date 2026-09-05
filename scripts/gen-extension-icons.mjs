// Generate the browser extension's 16/48/128 icons from the master mark.
// Run whenever scripts/assets/extension-icon.png changes — the outputs are
// committed to source (extension/icons/), same arrangement as gen-icons.mjs.
//
//   node scripts/gen-extension-icons.mjs
//
// Why a plain MM disc and not the CRT brand mark: the mark's hairlines fall
// below one pixel at 16px and collapse into an unreadable smudge, and 16px is
// the toolbar — the size users actually meet the extension at. The disc reads
// at every size in both light and dark browser chrome. The CRT art earns its
// place on the store's promo tile instead (see extension/STORE_LISTING.md).
//
// Master: black "MM" (IBM Plex Mono 600, the app's own mono) on a
// #00f5ff disc — the --color-cyan token from globals.css, whose bright fill
// is specified to take dark text.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "scripts/assets/extension-icon.png");
const outDir = resolve(root, "extension/icons");

// The three sizes manifest.json declares, for both `icons` and
// `action.default_icon`.
const SIZES = [16, 48, 128];

async function main() {
  for (const size of SIZES) {
    const out = resolve(outDir, `icon${size}.png`);
    await sharp(src)
      // Transparent outside the disc: the browser paints its own toolbar
      // behind it, light or dark, and a baked-in backdrop would show as a
      // square tile against both.
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`wrote ${out} (${size}×${size})`);
  }
  console.log(
    "[gen-extension-icons] repackage for the store: node scripts/package-extension.mjs",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
