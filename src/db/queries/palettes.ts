import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { palettes, type Palette } from "@/db/schema";

/**
 * The hydrated palette shape — JSON columns decoded to arrays so callers
 * never have to remember to JSON.parse. The colorHexes / paintIds arrays
 * are always the same length; paintIds entries are nullable.
 */
export interface HydratedPalette
  extends Omit<Palette, "colorHexes" | "paintIds"> {
  colorHexes: ReadonlyArray<string>;
  paintIds: ReadonlyArray<string | null>;
}

function hydrate(row: Palette): HydratedPalette {
  let hexes: ReadonlyArray<string> = [];
  let ids: ReadonlyArray<string | null> = [];
  try {
    const parsedHexes = JSON.parse(row.colorHexes) as unknown;
    if (Array.isArray(parsedHexes)) {
      hexes = parsedHexes.filter((h): h is string => typeof h === "string");
    }
  } catch {
    /* malformed JSON → empty array */
  }
  try {
    const parsedIds = JSON.parse(row.paintIds) as unknown;
    if (Array.isArray(parsedIds)) {
      ids = parsedIds.map((v) => (typeof v === "string" ? v : null));
    }
  } catch {
    /* malformed JSON → empty array */
  }
  return {
    ...row,
    colorHexes: hexes,
    paintIds: ids,
  };
}

/**
 * List the painter's palettes most-recent-first.
 */
export async function listPalettes(
  userId: string,
): Promise<ReadonlyArray<HydratedPalette>> {
  const rows = await db
    .select()
    .from(palettes)
    .where(eq(palettes.ownerId, userId))
    .orderBy(desc(palettes.updatedAt));
  return rows.map(hydrate);
}

/**
 * Single-palette lookup with ownership enforcement. Returns null when
 * the id doesn't exist or belongs to another user — callers should
 * surface "not found" without leaking the distinction.
 */
export async function getPalette(
  userId: string,
  id: string,
): Promise<HydratedPalette | null> {
  const rows = await db
    .select()
    .from(palettes)
    .where(and(eq(palettes.id, id), eq(palettes.ownerId, userId)))
    .limit(1);
  const row = rows[0];
  return row ? hydrate(row) : null;
}
