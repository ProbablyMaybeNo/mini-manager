/**
 * Export the canonical paint catalog from the Webscraper SQLite DB into
 * the static asset consumed by the library page.
 *
 * Run: `npm run db:export-paints`
 *
 * Reads:  `../Webscraper/data/webscraper.db` (resolved relative to the
 *         monorepo root — overridable via WEBSCRAPER_DB env var).
 * Writes: `app/public/data/paints.json` (overridable via OUT_FILE).
 *
 * The script shells out to `py -3.13` for the actual DB read so we don't
 * need a new node SQLite dependency. The Python interpreter ships with
 * sqlite3 in the stdlib and we already use it for the Webscraper backend.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Paint, PaintCatalog, PaintType, HexConfidence } from "../src/lib/paints/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const projectRoot = resolve(appRoot, "..");

const DEFAULT_DB = resolve(projectRoot, "..", "Webscraper", "data", "webscraper.db");
const DB_PATH = process.env.WEBSCRAPER_DB ?? DEFAULT_DB;
const OUT_FILE = process.env.OUT_FILE ?? resolve(appRoot, "public", "data", "paints.json");

/** Source-DB type strings → canonical PaintType. */
const TYPE_MAP: Record<string, PaintType> = {
  "": "Paint",
  Paint: "Paint",
  Wash: "Wash",
  Metallic: "Metallic",
  Contrast: "Contrast",
  Air: "Air",
  Primer: "Primer",
  Varnish: "Varnish",
  Pigment: "Pigment",
  Effect: "Effect",
  Ink: "Ink",
  Lacquer: "Lacquer",
  Enamel: "Paint", // technique difference, not a category for our purposes
  Oil: "Paint",
  Medium: "Effect",
};

/** Source-DB `hex_source` → HexConfidence. */
function mapConfidence(source: string | null, confidence: string | null): HexConfidence {
  if (source === "stahly_swatch") return "high";
  // The Webscraper schema already buckets confidence as 'high' | 'med'.
  if (confidence === "high") return "high";
  if (source === "minimatch_original") return "medium";
  if (confidence === "med") return "medium";
  return "low";
}

/** Source-DB row contract — only the columns we actually read. */
interface SourceRow {
  id: number;
  company: string;
  type: string | null;
  name: string;
  hex: string | null;
  swatch_hex: string | null;
  source_url: string;
  hex_source: string | null;
  confidence: string | null;
}

function readSourceRows(): SourceRow[] {
  if (!existsSync(DB_PATH)) {
    throw new Error(
      `Webscraper DB not found at ${DB_PATH}. Set WEBSCRAPER_DB to override.`,
    );
  }

  // Inline Python: SELECT, JSON-encode rows, write to stdout. Keeps the
  // boundary tiny and avoids spawning sqlite3 (which isn't reliably on PATH
  // on Windows).
  const py = String.raw`
import json, sqlite3, sys
con = sqlite3.connect(sys.argv[1])
con.row_factory = sqlite3.Row
cur = con.execute("""
  SELECT id, company, type, name, hex, swatch_hex, source_url,
         hex_source, confidence
  FROM paints
""")
rows = [dict(r) for r in cur.fetchall()]
sys.stdout.write(json.dumps(rows))
`;

  const stdout = execFileSync("py", ["-3.13", "-c", py, DB_PATH], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout) as SourceRow[];
}

function normaliseHex(raw: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;
}

function rowToPaint(row: SourceRow): Paint | null {
  const hex = normaliseHex(row.hex ?? row.swatch_hex);
  if (!hex) return null; // skip rows with no usable swatch — they can't render
  const typeKey = (row.type ?? "").trim();
  const type = TYPE_MAP[typeKey] ?? "Paint";
  const paint: Paint = {
    id: String(row.id),
    brand: row.company.trim(),
    name: row.name.trim(),
    type,
    hex,
    hexConfidence: mapConfidence(row.hex_source, row.confidence),
    hexSource: row.hex_source ?? "",
    sourceUrl: row.source_url,
  };
  return paint;
}

function brandBreakdown(paints: Paint[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const p of paints) {
    counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function main(): void {
  console.log(`[export-paints] reading from ${DB_PATH}`);
  const rows = readSourceRows();
  console.log(`[export-paints] source rows: ${rows.length}`);

  const paints: Paint[] = [];
  let skipped = 0;
  for (const row of rows) {
    const p = rowToPaint(row);
    if (p) paints.push(p);
    else skipped++;
  }
  console.log(`[export-paints] kept ${paints.length}, skipped ${skipped} (missing hex)`);

  const catalog: PaintCatalog = {
    __exported_at: Date.now(),
    __row_count: paints.length,
    paints,
  };

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(catalog), "utf8");
  console.log(`[export-paints] wrote ${OUT_FILE}`);

  console.log("[export-paints] top brands:");
  for (const [brand, n] of brandBreakdown(paints).slice(0, 12)) {
    console.log(`  ${brand.padEnd(28)} ${n}`);
  }
}

main();
