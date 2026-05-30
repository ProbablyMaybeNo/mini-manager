import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { imports } from "@/db/schema";
import type { Import, ImportStatus } from "@/db/schema";

export interface ListImportsOptions {
  status?: ImportStatus;
  limit?: number;
}

/**
 * Single import row scoped to the caller. Returns `null` if it doesn't
 * exist or the caller doesn't own it — never throws on ownership mismatch.
 */
export async function getImport(
  userId: string,
  importId: string,
): Promise<Import | null> {
  const rows = await db
    .select()
    .from(imports)
    .where(and(eq(imports.id, importId), eq(imports.ownerId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Recent imports for the caller, newest first. Optional status filter and
 * limit (default 50) keep the sidebar payload bounded.
 */
export async function listImports(
  userId: string,
  opts: ListImportsOptions = {},
): Promise<ReadonlyArray<Import>> {
  const limit = opts.limit ?? 50;
  const whereClause = opts.status
    ? and(eq(imports.ownerId, userId), eq(imports.status, opts.status))
    : eq(imports.ownerId, userId);
  return db
    .select()
    .from(imports)
    .where(whereClause)
    .orderBy(desc(imports.createdAt))
    .limit(limit);
}
