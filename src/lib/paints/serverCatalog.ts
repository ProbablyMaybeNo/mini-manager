import "server-only";

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Paint, PaintCatalog } from "./types";

/**
 * Server-side full-catalog reader.
 *
 * `db/queries/recipes.ts` already reads the static `paints.json` for a
 * `paintId -> {hex,label}` map, but the AI recipe grounding needs the WHOLE
 * `Paint` row (brand / line / type / hex) to filter candidates by brand and
 * spread them across paint types. This mirrors that file's mtime-keyed cache
 * — a `stat` (~0.008 ms) decides whether to skip the ~1.6 MB read + parse —
 * so repeated AI calls in one server process don't re-parse 7k rows.
 */

let catalogCache: Paint[] | null = null;
let catalogMtimeMs = -1;

function catalogPath(): string {
  return resolve(process.cwd(), "public", "data", "paints.json");
}

export async function getServerCatalog(): Promise<Paint[]> {
  const file = catalogPath();
  let mtimeMs = -1;
  try {
    mtimeMs = (await stat(file)).mtimeMs;
    if (catalogCache && mtimeMs === catalogMtimeMs) return catalogCache;
  } catch {
    if (catalogCache) return catalogCache;
  }

  const raw = await readFile(file, "utf8");
  const catalog = JSON.parse(raw) as PaintCatalog;
  catalogCache = catalog.paints;
  catalogMtimeMs = mtimeMs;
  return catalogCache;
}
