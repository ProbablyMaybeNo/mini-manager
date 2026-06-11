import "server-only";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Paint as CatalogPaint, PaintCatalog } from "@/lib/paints/types";

/**
 * Server-side cached read of the static paint catalog as a `paintId → Paint`
 * map. Mirrors the mtime-keyed cache in queries/recipes.ts#getPaintMetaMap so
 * recipe-slot / project-swatch resolution doesn't re-parse the ~1.6 MB / 7k-row
 * file on every render. Lives in the viewmodel layer (not queries) because it's
 * an adapter concern; the client never imports it (`server-only`).
 */
let cache: Map<string, CatalogPaint> | null = null;
let cacheMtimeMs = -1;

function catalogPath(): string {
  return resolve(process.cwd(), "public", "data", "paints.json");
}

export async function getCatalogById(): Promise<ReadonlyMap<string, CatalogPaint>> {
  const file = catalogPath();
  try {
    const mtimeMs = (await stat(file)).mtimeMs;
    if (cache && mtimeMs === cacheMtimeMs) return cache;
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as PaintCatalog;
    const map = new Map<string, CatalogPaint>();
    for (const p of parsed.paints) map.set(p.id, p);
    cache = map;
    cacheMtimeMs = mtimeMs;
    return map;
  } catch {
    if (cache) return cache;
    return new Map();
  }
}
