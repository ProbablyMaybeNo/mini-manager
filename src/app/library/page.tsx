import "server-only";

import { Suspense } from "react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { PaintCatalog } from "@/lib/paints/types";
import { LibraryPageClient } from "@/components/library/LibraryPageClient";

export const dynamic = "force-dynamic";

/**
 * Load the static paint catalog from disk on the server. We avoid `fetch`
 * because Next 16 / dev mode doesn't always have a localhost URL available
 * to the server when rendering — and the file lives in `public/` so a
 * direct read is faster anyway.
 */
async function loadPaintCatalog(): Promise<PaintCatalog> {
  const file = resolve(process.cwd(), "public", "data", "paints.json");
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as PaintCatalog;
}

export default async function LibraryPage() {
  const catalog = await loadPaintCatalog();

  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 md:px-8 pt-6 pb-4 border-b border-[var(--color-border)]">
        <h1 className="text-2xl">┌─ LIBRARY ─</h1>
        <p className="text-xs text-[var(--color-fg-muted)] mt-2 font-sans">
          {catalog.__row_count.toLocaleString()} paints across the cross-brand catalog.
          Filter by brand, line, type, or hue. Tap a row for swatch detail.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="p-8 text-sm font-mono text-[var(--color-fg-muted)]">
            Loading paint catalog…
          </div>
        }
      >
        <LibraryPageClient paints={catalog.paints} />
      </Suspense>
    </div>
  );
}
