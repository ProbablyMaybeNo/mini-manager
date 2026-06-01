"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";

export type SetLibraryBrandFilterResult =
  | { ok: true }
  | { ok: false; message: string };

const schema = z.object({
  /** Brand strings to keep visible. Empty array OR null both
   *  mean "all brands visible". The library page reads this column
   *  as the initial state. */
  brands: z.array(z.string().trim().min(1).max(120)).max(64).nullable(),
});

/**
 * P12.19 — write the painter's persistent library brand filter to
 * the user row. Null = "all brands"; an array = "only these
 * brands". The /library page reads this on load as the default
 * FilterRail selection.
 */
export async function setLibraryBrandFilterAction(
  raw: z.infer<typeof schema>,
): Promise<SetLibraryBrandFilterResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { brands } = parsed.data;
  const userId = await currentUserId();

  const encoded = brands === null ? null : JSON.stringify(brands);
  try {
    await db
      .update(users)
      .set({ libraryBrandFilter: encoded })
      .where(eq(users.id, userId));
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Failed to update library brand filter",
    };
  }
}

/**
 * Server-side: read the paint catalog from disk + return the
 * distinct sorted list of brand strings. Used by /user to render
 * the checkbox list. Cached via a module-level memo (one disk read
 * per process, refreshed when the file's mtime changes).
 */
let brandsCache: string[] | null = null;
let brandsCacheLoadedAt = -1;

export async function listAllBrands(): Promise<string[]> {
  const { readFile, stat } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const file = resolve(process.cwd(), "public", "data", "paints.json");
  const fileStat = await stat(file);
  const mtime = fileStat.mtimeMs;
  if (brandsCache && brandsCacheLoadedAt === mtime) return brandsCache;

  const raw = await readFile(file, "utf-8");
  const catalog = JSON.parse(raw) as { paints: Array<{ brand: string }> };
  const set = new Set<string>();
  for (const p of catalog.paints) {
    if (p.brand) set.add(p.brand);
  }
  const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
  brandsCache = sorted;
  brandsCacheLoadedAt = mtime;
  return sorted;
}
