/**
 * Best-effort backfill: link existing Collection paint rows
 * (`wishlist_item`, kind='paint', paint_id IS NULL) to a catalog paint by
 * matching (company + title) then (title alone), so painters who added
 * paints to their Collection BEFORE the Library ↔ Collection sync shipped
 * (batch/library-collection-sync) get the same "shows up in both places"
 * behaviour retroactively.
 *
 * NOT required for the feature to work — new rows link automatically via
 * `reconcilePaintOwnership` going forward. This is a one-off catch-up for
 * pre-existing rows, and it's deliberately conservative: it only links a
 * row when the match is UNAMBIGUOUS (exactly one catalog candidate), and
 * it never creates two linked rows for the same (owner, paintId) pair —
 * ties within the run, or against a row that's already linked, are logged
 * as skipped rather than guessed at.
 *
 * NOT wired into build / prebuild — run it explicitly, and review the
 * matched/unmatched counts before trusting the result:
 *
 *   Local:
 *     npm run db:backfill-paintids
 *
 *   Dry run (no writes, just the report):
 *     npm run db:backfill-paintids -- --dry-run
 *
 *   Production (once — against the remote libsql/Turso DB):
 *     DATABASE_URL="libsql://<your-db>.turso.io" \
 *     DATABASE_AUTH_TOKEN="<token>" \
 *     npm run db:backfill-paintids
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq, isNull } from "drizzle-orm";

import * as schema from "@/db/schema";
import type { Paint, PaintCatalog } from "@/lib/paints/types";

/** Lowercase, trim, collapse whitespace — the same normalisation
 *  `db/queries/collections.ts`'s paint↔recipe matcher uses. */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

async function loadCatalog(): Promise<Paint[]> {
  const file = resolve(process.cwd(), "public", "data", "paints.json");
  const raw = await readFile(file, "utf8");
  const catalog = JSON.parse(raw) as PaintCatalog;
  return catalog.paints;
}

/** `${company}|${title}` (normalised) -> candidate paints, plus a
 *  title-only index for the fallback pass. */
function buildIndexes(paints: readonly Paint[]) {
  const byCompanyTitle = new Map<string, Paint[]>();
  const byTitle = new Map<string, Paint[]>();
  for (const p of paints) {
    const nameKey = norm(p.name);
    const arr1 = byTitle.get(nameKey) ?? [];
    arr1.push(p);
    byTitle.set(nameKey, arr1);

    const compositeKey = `${norm(p.brand)}|${nameKey}`;
    const arr2 = byCompanyTitle.get(compositeKey) ?? [];
    arr2.push(p);
    byCompanyTitle.set(compositeKey, arr2);
  }
  return { byCompanyTitle, byTitle };
}

/** Resolve exactly one confident catalog match, or null if there isn't one. */
function matchOne(
  row: { title: string; company: string | null },
  indexes: ReturnType<typeof buildIndexes>,
): Paint | null {
  const title = norm(row.title);
  if (!title) return null;

  if (row.company) {
    const composite = indexes.byCompanyTitle.get(`${norm(row.company)}|${title}`);
    if (composite && composite.length === 1) return composite[0]!;
  }

  const byTitle = indexes.byTitle.get(title);
  if (byTitle && byTitle.length === 1) return byTitle[0]!;

  return null;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL ?? "file:./data/local.db";
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  const db = drizzle(client, { schema });

  console.log(`[backfill-paintids] running against ${url}${dryRun ? " (dry run)" : ""}`);

  const catalog = await loadCatalog();
  const indexes = buildIndexes(catalog);
  console.log(`[backfill-paintids] catalog loaded: ${catalog.length} paints`);

  const allPaintRows = await db
    .select({
      id: schema.wishlistItems.id,
      ownerId: schema.wishlistItems.ownerId,
      title: schema.wishlistItems.title,
      company: schema.wishlistItems.company,
      paintId: schema.wishlistItems.paintId,
    })
    .from(schema.wishlistItems)
    .where(eq(schema.wishlistItems.kind, "paint"));

  // Seed the "already claimed" set from rows that are already linked, so
  // the backfill never creates a second linked row for a pair some earlier
  // run (or `reconcilePaintOwnership`) already linked.
  const claimedPairs = new Set<string>();
  for (const row of allPaintRows) {
    if (row.paintId) claimedPairs.add(`${row.ownerId}|${row.paintId}`);
  }

  const unlinked = allPaintRows.filter((r) => r.paintId === null);
  console.log(`[backfill-paintids] ${unlinked.length} unlinked paint rows to consider`);

  let matched = 0;
  let skippedDuplicate = 0;
  let skippedNoMatch = 0;

  for (const row of unlinked) {
    const candidate = matchOne(row, indexes);
    if (!candidate) {
      skippedNoMatch += 1;
      continue;
    }
    const pairKey = `${row.ownerId}|${candidate.id}`;
    if (claimedPairs.has(pairKey)) {
      skippedDuplicate += 1;
      continue;
    }
    claimedPairs.add(pairKey);
    matched += 1;
    if (!dryRun) {
      await db
        .update(schema.wishlistItems)
        .set({ paintId: candidate.id })
        .where(
          and(eq(schema.wishlistItems.id, row.id), isNull(schema.wishlistItems.paintId)),
        );
    }
  }

  console.log("[backfill-paintids] done");
  console.log(`  matched:            ${matched}`);
  console.log(`  skipped (dup):      ${skippedDuplicate}`);
  console.log(`  skipped (no match): ${skippedNoMatch}`);
  if (dryRun) console.log("  (dry run — no rows were written)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-paintids] failed:", err);
    process.exit(1);
  });
