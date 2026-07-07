/**
 * Client-side paint catalog loader with an IndexedDB read-through cache.
 *
 * First call: fetch /data/paints.json, write rows to Dexie, return.
 * Subsequent calls in the same browser: hit Dexie, return without a
 * network round-trip — assuming the cached `exportedAt` matches what the
 * JSON ships with.
 *
 * SSR-safe: every call is wrapped in `typeof window` guards so server
 * components and tests that import this module never touch IndexedDB.
 */
import type { Paint, PaintCatalog } from "./types";
import type { PaintCatalogDb } from "./dexie";

const CATALOG_URL = "/data/paints.json";

/** In-memory cache so multiple components on a page share one promise. */
let inFlight: Promise<Paint[]> | null = null;
/** Resolved rows kept for the session so repeat navigations are instant —
 *  no Dexie read and no network round-trip once the catalog has loaded once. */
let memo: Paint[] | null = null;

export async function loadPaints(): Promise<Paint[]> {
  if (typeof window === "undefined") {
    // Server-side: defer to the static fetch. Server components have their
    // own caching via Next.js's fetch cache; we don't try to be cute here.
    return fetchCatalog().then((c) => c.paints);
  }
  if (memo) return memo;
  if (inFlight) return inFlight;
  inFlight = loadFromCacheOrNetwork();
  try {
    memo = await inFlight;
    return memo;
  } finally {
    inFlight = null;
  }
}

async function loadFromCacheOrNetwork(): Promise<Paint[]> {
  // Lazy-load Dexie only on the client to keep it out of any SSR bundle.
  const { getPaintCatalogDb } = await import("./dexie");
  const db = getPaintCatalogDb();

  try {
    const meta = await db.meta.get("paints");
    if (meta) {
      // Cache exists. Confirm it lines up with the shipped catalog by
      // peeking at the JSON's __exported_at without downloading the full
      // payload — we do a HEAD-style range read on the first ~120 bytes,
      // which is enough to contain the timestamp the writer puts at the
      // very front of the file.
      const shippedExportedAt = await peekExportedAt();
      if (shippedExportedAt !== null && shippedExportedAt === meta.exportedAt) {
        const rows = await db.paints.toArray();
        if (rows.length === meta.rowCount) {
          return rows;
        }
      }
    }
  } catch (err) {
    // Dexie failures should never block the user. Fall through to network.
    console.warn("[paints] dexie read failed, falling back to network", err);
  }

  const catalog = await fetchCatalog();
  // Persist to IndexedDB OFF the critical path: hand the rows to the UI now,
  // then write the cache in the background. The previous code awaited a single
  // bulkPut of all ~7,144 rows before returning — that structured-clone
  // serialization runs synchronously on the main thread, a multi-second long
  // task that blocked the first navigation into any catalog route (a 5s+ INP
  // pinned on the nav click that triggered the load).
  void persistCatalog(db, catalog);
  return catalog.paints;
}

const WRITE_BATCH = 500;

/**
 * Write the catalog into Dexie without ever holding the main thread for long.
 * Rows go in in WRITE_BATCH-sized chunks with a macrotask yield between each,
 * so paint and input can interleave. `meta` is written last, so an interrupted
 * write (tab closed mid-flight) reads back as a cache miss and re-fetches next
 * time rather than serving a half-populated catalog.
 */
async function persistCatalog(db: PaintCatalogDb, catalog: PaintCatalog): Promise<void> {
  try {
    await db.meta.delete("paints");
    await db.paints.clear();
    const rows = catalog.paints;
    for (let i = 0; i < rows.length; i += WRITE_BATCH) {
      await db.paints.bulkPut(rows.slice(i, i + WRITE_BATCH));
      await new Promise<void>((resolve) => setTimeout(resolve));
    }
    await db.meta.put({
      key: "paints",
      exportedAt: catalog.__exported_at,
      rowCount: catalog.__row_count,
    });
  } catch (err) {
    console.warn("[paints] dexie background write failed; cache skipped", err);
  }
}

async function fetchCatalog(): Promise<PaintCatalog> {
  const res = await fetch(CATALOG_URL, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`Paint catalog fetch failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as PaintCatalog;
}

/**
 * Read the first chunk of paints.json to extract `__exported_at` without
 * paying for the full 2-3MB transfer. Returns null on any error so the
 * caller can fall back to a full fetch.
 */
async function peekExportedAt(): Promise<number | null> {
  try {
    const res = await fetch(CATALOG_URL, {
      headers: { Range: "bytes=0-200" },
      cache: "no-store",
    });
    if (!res.ok && res.status !== 206) return null;
    const text = await res.text();
    const match = text.match(/"__exported_at"\s*:\s*(\d+)/);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
