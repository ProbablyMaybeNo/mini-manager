/**
 * Minimal Dexie wrapper for the paint catalog cache. One table, two
 * blob entries: the paint rows themselves and a single metadata row
 * recording the export timestamp the JSON shipped with.
 *
 * Browser-only — the loader.ts guards `typeof window` before touching
 * anything in here so server components can still import the types.
 */
import Dexie, { type Table } from "dexie";

import type { Paint } from "./types";

/** Mirrors Paint (Dexie indexes by id). */
type PaintRow = Paint;

interface CacheMeta {
  key: "paints";
  exportedAt: number;
  rowCount: number;
}

export class PaintCatalogDb extends Dexie {
  paints!: Table<PaintRow, string>;
  meta!: Table<CacheMeta, "paints">;

  constructor() {
    super("mini-manager-paints");
    this.version(1).stores({
      paints: "id, brand, type",
      meta: "key",
    });
  }
}

let _db: PaintCatalogDb | null = null;
export function getPaintCatalogDb(): PaintCatalogDb {
  if (!_db) _db = new PaintCatalogDb();
  return _db;
}
