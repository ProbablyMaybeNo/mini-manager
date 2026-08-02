/**
 * Replace the Liquitex block in the static paint catalog with the freshly
 * scraped manufacturer data.
 *
 * Run: `npm run db:patch-liquitex`
 *
 * Reads:  `../Antigravity/apps/Webscraper/data/paints_raw/liquitex.jsonl`
 *         (overridable via LIQUITEX_JSONL).
 * Writes: `public/data/paints.json` in place (overridable via OUT_FILE).
 *
 * This is a surgical patch rather than a full `db:export-paints` run. A
 * full re-export would regenerate all 7,144 rows from a source DB that has
 * since grown to ~9,500, shifting ids that `scripts/seedGallery.ts` and
 * `scripts/seed-showcase.mts` hardcode. Touching one brand keeps every
 * other row byte-identical.
 *
 * The catalog's 105 pre-existing Liquitex rows came from minimatch and
 * carried no line and several plainly wrong swatches (Burnt Umber was
 * #F1F1F1). They are dropped wholesale. Where a replacement colour has the
 * same name, it inherits the old row's id so any collection entry, recipe
 * slot or wishlist item already pointing at it still resolves — those
 * tables store `paint_id` as bare text with no foreign key, so a changed
 * id would silently orphan the reference.
 *
 * Each Liquitex range becomes its own brand — "Liquitex Heavy Body",
 * "Liquitex Basics" and so on — following the Vallejo rows already in the
 * catalog. Liquitex reuse colour names heavily across ranges (537 colours,
 * 177 distinct names, eight different Titanium Whites), and no component
 * renders `line`, so a single brand would put up to eight indistinguishable
 * rows behind one search. `line` is still populated for whenever a Lines
 * facet gets built.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  HexConfidence,
  Paint,
  PaintCatalog,
  PaintType,
} from "../src/lib/paints/types.ts";

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
  "liquitex.jsonl",
);
const JSONL_PATH = process.env.LIQUITEX_JSONL ?? DEFAULT_JSONL;
const OUT_FILE = process.env.OUT_FILE ?? resolve(appRoot, "public", "data", "paints.json");

/** Every brand this script owns starts with this. */
const BRAND_PREFIX = "Liquitex";
/**
 * First id for colours with no predecessor. The upstream Webscraper DB
 * currently tops out in the 22,000s, so starting here leaves room for it
 * to grow without ever colliding with a hand-assigned Liquitex row.
 */
const ID_BASE = 30000;

/**
 * Display order for the line facet — flagship professional ranges first,
 * then the student ranges. Also the tie-break when an old row's name
 * matches colours in more than one line.
 */
const LINE_ORDER = [
  "Heavy Body",
  "Soft Body",
  "Acrylic Gouache",
  "Acrylic Ink",
  "Spray Paint",
  "Bio-based Heavy",
  "Basics",
  "Basics Fluid",
];

/** One line of the scraper's JSONL output — only the fields we read. */
interface ScrapedRow {
  company: string;
  type: string;
  name: string;
  hex: string;
  source_url: string;
  confidence: string;
  sku: string;
  line: string;
}

function mapType(raw: string): PaintType {
  if (raw === "Ink") return "Ink";
  if (raw === "Metallic") return "Metallic";
  return "Paint";
}

function mapConfidence(raw: string): HexConfidence {
  if (raw === "high") return "high";
  if (raw === "low") return "low";
  return "medium";
}

function normaliseHex(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-f]{6}$/i.test(withHash) ? withHash.toUpperCase() : "";
}

function readScraped(): ScrapedRow[] {
  if (!existsSync(JSONL_PATH)) {
    throw new Error(
      `Liquitex JSONL not found at ${JSONL_PATH}. ` +
        `Run scripts/scrape_liquitex.py in the Webscraper repo first, ` +
        `or set LIQUITEX_JSONL to override.`,
    );
  }
  return readFileSync(JSONL_PATH, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as ScrapedRow);
}

function lineRank(line: string): number {
  const i = LINE_ORDER.indexOf(line);
  return i === -1 ? LINE_ORDER.length : i;
}

/**
 * Match key for carrying an old row's id across. Strips everything but
 * alphanumerics, the same way `merge_manufacturer_data.py` keys the
 * Webscraper side. The three names containing an apostrophe — Hooker's
 * Green, Hooker's Green Deep, Turner's Yellow — reached the old catalog
 * through a lossy encoding and read back as mojibake, so anything
 * comparing the punctuation itself would fail to pair them up.
 */
function matchKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function main(): void {
  console.log(`[patch-liquitex] reading ${JSONL_PATH}`);
  const scraped = readScraped();
  console.log(`[patch-liquitex] scraped rows: ${scraped.length}`);

  const catalog = JSON.parse(readFileSync(OUT_FILE, "utf8")) as PaintCatalog;
  const isOurs = (p: Paint): boolean => p.brand.startsWith(BRAND_PREFIX);
  const others = catalog.paints.filter((p) => !isOurs(p));
  const previous = catalog.paints.filter(isOurs);
  console.log(
    `[patch-liquitex] catalog: ${catalog.paints.length} rows, ` +
      `${previous.length} existing ${BRAND_PREFIX}`,
  );

  // Sort so id assignment is deterministic across re-runs: line order
  // first, then colour name.
  const ordered = [...scraped].sort(
    (a, b) => lineRank(a.line) - lineRank(b.line) || a.name.localeCompare(b.name),
  );

  const reusableIds = new Map<string, string>();
  for (const p of previous) reusableIds.set(matchKey(p.name), p.id);

  const taken = new Set(others.map((p) => p.id));
  let nextId = ID_BASE;
  const allocate = (): string => {
    while (taken.has(String(nextId))) nextId++;
    const id = String(nextId);
    taken.add(id);
    return id;
  };

  const paints: Paint[] = [];
  let skippedNoHex = 0;
  let reused = 0;
  const byLine = new Map<string, number>();
  const byConfidence = new Map<HexConfidence, number>();

  for (const row of ordered) {
    const hex = normaliseHex(row.hex);
    if (!hex) {
      // Matches export-paints.ts: a row with no swatch can't render.
      skippedNoHex++;
      continue;
    }

    // First colour of a given name claims the old id; later lines sharing
    // that name get fresh ones. LINE_ORDER puts Heavy Body first, which is
    // where the original minimatch list came from.
    const key = matchKey(row.name);
    let id: string;
    const inherited = reusableIds.get(key);
    if (inherited !== undefined && !taken.has(inherited)) {
      id = inherited;
      taken.add(id);
      reused++;
    } else {
      id = allocate();
    }

    const confidence = mapConfidence(row.confidence);
    const paint: Paint = {
      id,
      brand: row.company,
      line: row.line,
      name: row.name,
      type: mapType(row.type),
      hex,
      hexConfidence: confidence,
      hexSource: "liquitex_swatch",
      sourceUrl: row.source_url,
    };
    if (row.sku) paint.sku = row.sku;
    paints.push(paint);

    byLine.set(row.line, (byLine.get(row.line) ?? 0) + 1);
    byConfidence.set(confidence, (byConfidence.get(confidence) ?? 0) + 1);
  }

  const merged = [...others, ...paints];
  const next: PaintCatalog = {
    // Clients revalidate their IndexedDB copy off this timestamp via a
    // 200-byte range request. Leaving it unchanged would serve every
    // existing user the stale catalog forever.
    __exported_at: Date.now(),
    __row_count: merged.length,
    paints: merged,
  };

  const ids = new Set(merged.map((p) => p.id));
  if (ids.size !== merged.length) {
    throw new Error(
      `duplicate ids after patch: ${merged.length} rows, ${ids.size} unique`,
    );
  }

  writeFileSync(OUT_FILE, JSON.stringify(next), "utf8");

  console.log(
    `[patch-liquitex] wrote ${OUT_FILE}\n` +
      `  ${BRAND_PREFIX}: ${previous.length} -> ${paints.length} ` +
      `(${reused} kept their id, ${skippedNoHex} skipped for missing hex)\n` +
      `  catalog:  ${catalog.paints.length} -> ${merged.length} rows`,
  );
  console.log("[patch-liquitex] by brand:");
  for (const line of LINE_ORDER) {
    const n = byLine.get(line);
    if (n) console.log(`  ${`${BRAND_PREFIX} ${line}`.padEnd(28)} ${n}`);
  }
  console.log("[patch-liquitex] by hex confidence:");
  for (const level of ["high", "medium", "low"] as const) {
    const n = byConfidence.get(level);
    if (n) console.log(`  ${level.padEnd(18)} ${n}`);
  }
}

main();
