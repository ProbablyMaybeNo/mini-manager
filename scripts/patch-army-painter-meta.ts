/**
 * Add line and sku to the Army Painter rows in the static paint catalog.
 *
 * Run: `npm run db:patch-army-painter`
 *
 * Reads:  `../Antigravity/apps/Webscraper/data/paints_raw/army_painter.jsonl`
 *         (overridable via ARMY_PAINTER_JSONL).
 * Writes: `public/data/paints.json` in place (overridable via OUT_FILE).
 *
 * Metadata only. The catalog's Army Painter hexes come from Stahly
 * hand-painted swatch charts (164 rows, high confidence) and minimatch
 * (397), and both beat anything derivable from thearmypainter.com —
 * every product image in their Shopify feed is a dropper bottle carrying
 * a large red brand banner and a white label, with no swatch or drawdown
 * asset anywhere. Measured against the Stahly rows, extracting from those
 * photos lands a median 100+ RGB units off. So this script never touches
 * hex, and never touches type, brand, id, name or sourceUrl either.
 *
 * What it does add is what the catalog has none of: the range each paint
 * belongs to, and its SKU. The library's text filter matches against
 * `name + brand + line` (src/mock/filterPaints.ts), so until now a search
 * for "speedpaint" or "warpaints air" returned nothing.
 *
 * A colour sold in more than one range — Matt White exists as both
 * Warpaints Fanatic and Warpaints Air — is resolved using the type the
 * catalog already carries, which is why this runs off type rather than
 * guessing. Their SKUs differ, so picking the wrong one would attach a
 * wrong code.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Paint, PaintCatalog, PaintType } from "../src/lib/paints/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const workspaceRoot = resolve(appRoot, "..");

const DEFAULT_JSONL = resolve(
  workspaceRoot,
  "Antigravity",
  "apps",
  "Webscraper",
  "data",
  "paints_raw",
  "army_painter.jsonl",
);
const JSONL_PATH = process.env.ARMY_PAINTER_JSONL ?? DEFAULT_JSONL;
const OUT_FILE = process.env.OUT_FILE ?? resolve(appRoot, "public", "data", "paints.json");

const BRAND_MATCH = "army painter";

/** Which range a catalog row belongs to when its name is sold in several. */
const LINE_FOR_TYPE: Partial<Record<PaintType, string>> = {
  Air: "Warpaints Air",
  Contrast: "Speedpaint",
};
const DEFAULT_LINE = "Warpaints Fanatic";

interface ScrapedRow {
  name: string;
  sku: string;
  line: string;
}

/** Same key the Webscraper merge uses: alphanumerics only. */
function matchKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function readScraped(): ScrapedRow[] {
  if (!existsSync(JSONL_PATH)) {
    throw new Error(
      `Army Painter JSONL not found at ${JSONL_PATH}. Run ` +
        `scripts/scrape_army_painter.py in the Webscraper repo first, ` +
        `or set ARMY_PAINTER_JSONL to override.`,
    );
  }
  return readFileSync(JSONL_PATH, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as ScrapedRow);
}

function main(): void {
  console.log(`[patch-army-painter] reading ${JSONL_PATH}`);
  const scraped = readScraped();
  console.log(`[patch-army-painter] scraped rows: ${scraped.length}`);

  const byName = new Map<string, ScrapedRow[]>();
  for (const row of scraped) {
    const key = matchKey(row.name);
    const bucket = byName.get(key);
    if (bucket) bucket.push(row);
    else byName.set(key, [row]);
  }

  const catalog = JSON.parse(readFileSync(OUT_FILE, "utf8")) as PaintCatalog;

  let seen = 0;
  let enriched = 0;
  let unmatched = 0;
  let disambiguated = 0;
  const byLine = new Map<string, number>();

  const paints: Paint[] = catalog.paints.map((p) => {
    if (!p.brand.toLowerCase().includes(BRAND_MATCH)) return p;
    seen++;

    const candidates = byName.get(matchKey(p.name));
    if (!candidates || candidates.length === 0) {
      unmatched++;
      return p;
    }

    let row = candidates[0];
    if (candidates.length > 1) {
      const wanted = LINE_FOR_TYPE[p.type] ?? DEFAULT_LINE;
      row = candidates.find((c) => c.line === wanted) ?? candidates[0];
      disambiguated++;
    }
    if (!row.line && !row.sku) {
      unmatched++;
      return p;
    }

    enriched++;
    if (row.line) byLine.set(row.line, (byLine.get(row.line) ?? 0) + 1);

    const next: Paint = { ...p };
    if (row.line) next.line = row.line;
    if (row.sku) next.sku = row.sku;
    return next;
  });

  if (paints.length !== catalog.paints.length) {
    throw new Error("row count changed — this script must only enrich in place");
  }

  const next: PaintCatalog = {
    __exported_at: Date.now(),
    __row_count: paints.length,
    paints,
  };
  writeFileSync(OUT_FILE, JSON.stringify(next), "utf8");

  console.log(
    `[patch-army-painter] wrote ${OUT_FILE}\n` +
      `  Army Painter rows: ${seen}\n` +
      `  enriched:          ${enriched} (${disambiguated} needed the type to pick a range)\n` +
      `  left alone:        ${unmatched} (no longer sold — older Warpaints, inks, mediums)`,
  );
  console.log("[patch-army-painter] by line:");
  for (const [line, n] of [...byLine.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${line.padEnd(20)} ${n}`);
  }
}

main();
