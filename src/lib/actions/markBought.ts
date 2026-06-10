"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  projects,
  projectTypes,
  wishlistItems,
  type Project,
  type WishlistItem,
} from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { logActivity } from "@/lib/activityLog";
import type { ActionResult } from "@/lib/actions/projects";
import { bumpCounter } from "@/lib/actions/counters";

/* ============================================================
   Two chained actions:
   - markBoughtAsNewProject — creates a Project from the kit and
     stamps the wishlist row as Bought.
   - markBoughtAsExistingUnit — bumps owned_count on a target Unit
     by the chosen delta and stamps Bought.
   Each runs the whole sequence server-side so the client only does
   one round-trip.
   ============================================================ */

const newProjectSchema = z.object({
  wishlistItemId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  type: z.enum(projectTypes),
  count: z.number().int().min(0).max(9999),
  parentId: z.string().min(1).max(64).nullish(),
});

const existingUnitSchema = z.object({
  wishlistItemId: z.string().min(1).max(64),
  projectId: z.string().min(1).max(64),
  delta: z.number().int().min(1).max(999),
});

async function loadWishlistItemOwned(
  userId: string,
  wishlistItemId: string,
): Promise<WishlistItem | null> {
  const rows = await db
    .select()
    .from(wishlistItems)
    .where(
      and(
        eq(wishlistItems.id, wishlistItemId),
        eq(wishlistItems.ownerId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function stampBought(wishlistItemId: string): Promise<void> {
  await db
    .update(wishlistItems)
    .set({ status: "PURCHASED", dateResolved: new Date() })
    .where(eq(wishlistItems.id, wishlistItemId));
}

export async function markBoughtAsNewProject(
  raw: z.infer<typeof newProjectSchema>,
): Promise<ActionResult<{ projectId: string }>> {
  const parsed = newProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await currentUserId();
  const { wishlistItemId, name, type, count, parentId } = parsed.data;

  const item = await loadWishlistItemOwned(userId, wishlistItemId);
  if (!item) return { ok: false, error: "Wishlist item not found" };

  // Validate parent (same rules as createProject). P13.4 — Unit is now
  // a valid parent type; sub-projects must themselves be Unit.
  let finalParentId: string | null = null;
  if (parentId) {
    const parentRows = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, parentId), eq(projects.ownerId, userId)))
      .limit(1);
    const parent = parentRows[0];
    if (!parent) return { ok: false, error: "Parent project not found" };
    if (parent.parentId !== null) {
      return {
        ok: false,
        error: "Maximum 3 levels of nesting: Army → Unit → Unit.",
      };
    }
    if (
      parent.type !== "Army" &&
      parent.type !== "Warband" &&
      parent.type !== "Unit"
    ) {
      return {
        ok: false,
        error: "Only Army, Warband, or Unit parents can contain sub-projects.",
      };
    }
    if (type !== "Unit") {
      return { ok: false, error: "Sub-projects must be of type Unit." };
    }
    finalParentId = parent.id;
  }

  const finalCount = count;

  let newRow: Pick<Project, "id"> | undefined;
  try {
    const inserted = await db
      .insert(projects)
      .values({
        ownerId: userId,
        parentId: finalParentId,
        type,
        name,
        count: finalCount,
      })
      .returning({ id: projects.id });
    newRow = inserted[0];
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create project",
    };
  }
  if (!newRow) return { ok: false, error: "Project insert returned no row" };

  await stampBought(wishlistItemId);

  // P14.1 — feed the PLANNER activity stream. Wishlist row id pins
  // the activity row to the original kit purchase.
  await logActivity(userId, "paint_added", wishlistItemId);

  revalidatePath("/projects");
  revalidatePath(`/projects/${newRow.id}`);
  revalidatePath("/collection");
  return { ok: true, data: { projectId: newRow.id } };
}

export async function markBoughtAsExistingUnit(
  raw: z.infer<typeof existingUnitSchema>,
): Promise<ActionResult<{ projectId: string; ownedCount: number }>> {
  const parsed = existingUnitSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await currentUserId();
  const { wishlistItemId, projectId, delta } = parsed.data;

  const item = await loadWishlistItemOwned(userId, wishlistItemId);
  if (!item) return { ok: false, error: "Wishlist item not found" };

  // Ownership check + grab current ownedCount so we know the new value.
  const targetRows = await db
    .select({ id: projects.id, ownedCount: projects.ownedCount, count: projects.count })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  const target = targetRows[0];
  if (!target) return { ok: false, error: "Target project not found" };
  if (target.ownedCount + delta > target.count) {
    return {
      ok: false,
      error: `Adding ${delta} would exceed the project's roster cap (${target.count}). Increase the project count first or pick a smaller delta.`,
    };
  }

  // bumpCounter only handles +1 / -1; loop here for the delta.
  let newOwned = target.ownedCount;
  for (let i = 0; i < delta; i++) {
    const result = await bumpCounter({ projectId, stage: "owned", delta: 1 });
    if (result.ok === false) {
      return { ok: false, error: result.error };
    }
    newOwned = result.data.ownedCount;
  }

  await stampBought(wishlistItemId);

  // P14.1 — feed the PLANNER activity stream.
  await logActivity(userId, "paint_added", wishlistItemId);

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/collection");
  return { ok: true, data: { projectId, ownedCount: newOwned } };
}
