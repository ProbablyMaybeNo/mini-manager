/**
 * Add the Ionic block to the static paint catalog from the freshly scraped
 * manufacturer data.
 *
 * Run: `npm run db:patch-ionic`
 *
 * Reads:  `../Antigravity/apps/Webscraper/data/paints_raw/ionic.jsonl`
 *         (overridable via IONIC_JSONL).
 * Writes: `public/data/paints.json` in place (overridable via OUT_FILE).
 *
 * Surgical patch, same reasoning as `patch-liquitex-paints.ts`: a full
 * `db:export-paints` run would regenerate every row from a source DB that has
 * drifted well past the catalog, shifting ids that `scripts/seedGallery.ts`
 * and `scripts/seed-showcase.mts` hardcode. Touching one brand keeps every
 * other row byte-identical.
 *
 * Unlike Liquitex, the catalog has NO pre-existing Ionic rows — this is a
 * brand-new 39th brand, not a replacement. The id-inheritance path below is
 * therefore dead on the first run and only earns its keep on a re-scrape,
 * where it keeps collection entries, recipe slots and wishlist items pointing
 * at the same paint (those tables store `paint_id` as bare text with no
 * foreign key, so a changed id silently orphans the reference).
 *
 * Each Ionic range becomes its own brand — "Ionic Smart Colors" and "Ionic
 * Real Heavy Metal" — which is what the scraper already emits in `company`,
 * following the locked multi-range brand model (Vallejo, Liquitex). `line` is
 * populated too, for whenever a Lines facet gets built.
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
  "ionic.jsonl",
);
const JSONL_PATH = process.env.IONIC_JSONL ?? DEFAULT_JSONL;
const OUT_FILE = process.env.OUT_FILE ?? resolve(appRoot, "public", "data", "paints.json");

/** Every brand this script owns starts with this. */
const BRAND_PREFIX = "Ionic";
/**
 * First id for colours with no predecessor. Liquitex occupies 30000–30431,
 * so this leaves a clear gap without ever colliding with a hand-assigned row.
 */
const ID_BASE = 31000;

/** Display order for the line facet, and the id-inheritance tie-break. */
const LINE_ORDER = ["Smart Colors", "Real Heavy Metal"];

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
  if (raw === "Wash") return "Wash";
  if (raw === "Metallic") return "Metallic";
  if (raw === "Ink") return "Ink";
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
      `Ionic JSONL not found at ${JSONL_PATH}. ` +
        `Run the ionic scraper in the Webscraper repo first, ` +
        `or set IONIC_JSONL to override.`,
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
 * Match key for carrying an old row's id across a re-scrape. Strips
 * everything but alphanumerics, the same way `merge_manufacturer_data.py`
 * keys the Webscraper side, so punctuation drift between runs can't orphan
 * a paint reference.
 */
function matchKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function main(): void {
  console.log(`[patch-ionic] reading ${JSONL_PATH}`);
  const scraped = readScraped();
  console.log(`[patch-ionic] scraped rows: ${scraped.length}`);

  const catalog = JSON.parse(readFileSync(OUT_FILE, "utf8")) as PaintCatalog;
  const isOurs = (p: Paint): boolean => p.brand.startsWith(BRAND_PREFIX);
  const others = catalog.paints.filter((p) => !isOurs(p));
  const previous = catalog.paints.filter(isOurs);
  console.log(
    `[patch-ionic] catalog: ${catalog.paints.length} rows, ` +
      `${previous.length} existing ${BRAND_PREFIX}`,
  );

  // Sort so id assignment is deterministic across re-runs: line order first,
  // then colour name.
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
  const byBrand = new Map<string, number>();
  const byConfidence = new Map<HexConfidence, number>();

  for (const row of ordered) {
    const hex = normaliseHex(row.hex);
    if (!hex) {
      // Matches export-paints.ts: a row with no swatch can't render.
      skippedNoHex++;
      continue;
    }

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
      hexSource: "ionic_swatch",
      sourceUrl: row.source_url,
    };
    if (row.sku) paint.sku = row.sku;
    paints.push(paint);

    byBrand.set(row.company, (byBrand.get(row.company) ?? 0) + 1);
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
    `[patch-ionic] wrote ${OUT_FILE}\n` +
      `  ${BRAND_PREFIX}: ${previous.length} -> ${paints.length} ` +
      `(${reused} kept their id, ${skippedNoHex} skipped for missing hex)\n` +
      `  catalog:  ${catalog.paints.length} -> ${merged.length} rows`,
  );
  console.log("[patch-ionic] by brand:");
  for (const line of LINE_ORDER) {
    const n = byBrand.get(`${BRAND_PREFIX} ${line}`);
    if (n) console.log(`  ${`${BRAND_PREFIX} ${line}`.padEnd(28)} ${n}`);
  }
  console.log("[patch-ionic] by hex confidence:");
  for (const level of ["high", "medium", "low"] as const) {
    const n = byConfidence.get(level);
    if (n) console.log(`  ${level.padEnd(18)} ${n}`);
  }
}

main();
