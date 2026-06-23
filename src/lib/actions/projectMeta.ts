"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { projects, recipes, recipeSlots, type ProjectType as DbProjectType } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { getPaintMetaMap } from "@/db/queries/recipes";
import type { ActionResult } from "@/lib/actions/projects";
import type { ProjectType as KitProjectType } from "@/lib/types";

/** DB project type → kit ProjectType (collapses the two extra DB types). */
const TYPE_MAP: Record<DbProjectType, KitProjectType> = {
  Army: "Army",
  Warband: "Warband",
  Unit: "Unit",
  Model: "Model",
  "Terrain Piece": "Terrain",
  Diorama: "Terrain",
};

/**
 * Project-metadata actions used by the rich project inspector — notes,
 * target date, and a reference image — plus a read-only `loadProjectDetail`
 * for the fields the dashboard tree doesn't carry. Every write is scoped by
 * `ownerId` and revalidates `/dashboard`.
 */

const idSchema = z.string().min(1).max(64);
const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");

/** YYYY-MM-DD → midnight-UTC Date (we treat targetDate as a day value). */
function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Date → YYYY-MM-DD (UTC) for round-tripping into a <input type="date">. */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Confirm the project belongs to the signed-in user before mutating. */
async function assertOwned(id: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  return rows.length > 0;
}

const notesSchema = z.object({
  id: idSchema,
  notes: z
    .string()
    .max(5_000, "Notes are too long")
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
});

export async function updateProjectNotes(
  raw: z.input<typeof notesSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = notesSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid notes" };
  }
  const { id, notes } = parsed.data;
  const userId = await currentUserId();
  if (!(await assertOwned(id, userId))) {
    return { ok: false, error: "Project not found" };
  }
  await db
    .update(projects)
    .set({ notesMd: notes, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));
  revalidatePath("/dashboard");
  return { ok: true, data: { id } };
}

const targetSchema = z.object({
  id: idSchema,
  date: dayString.nullish().transform((v) => (v ? v : null)),
});

export async function setProjectTargetDate(
  raw: z.input<typeof targetSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = targetSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid date" };
  }
  const { id, date } = parsed.data;
  const userId = await currentUserId();
  if (!(await assertOwned(id, userId))) {
    return { ok: false, error: "Project not found" };
  }
  await db
    .update(projects)
    .set({ targetDate: date ? parseDay(date) : null, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));
  revalidatePath("/dashboard");
  return { ok: true, data: { id } };
}

const refImageSchema = z.object({
  id: idSchema,
  url: z
    .string()
    .trim()
    .url("Enter a valid image URL")
    .max(2_000, "URL is too long")
    .nullish()
    .transform((v) => (v ? v : null)),
});

export async function setProjectReferenceImage(
  raw: z.input<typeof refImageSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = refImageSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid URL" };
  }
  const { id, url } = parsed.data;
  const userId = await currentUserId();
  if (!(await assertOwned(id, userId))) {
    return { ok: false, error: "Project not found" };
  }
  await db
    .update(projects)
    .set({ referenceImageUrl: url, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));
  revalidatePath("/dashboard");
  return { ok: true, data: { id } };
}

/**
 * Archive (or restore) a project. Archiving sets `archivedAt`; restoring
 * clears it. Archived projects stay in the tree (and keep cascading their
 * roll-up) — the flag just lets the UI fold completed work out of the way.
 * Owner-scoped.
 */
const archiveSchema = z.object({
  id: idSchema,
  archived: z.boolean(),
});

export async function setProjectArchived(
  raw: z.input<typeof archiveSchema>,
): Promise<ActionResult<{ id: string; archived: boolean }>> {
  const parsed = archiveSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }
  const { id, archived } = parsed.data;
  const userId = await currentUserId();
  if (!(await assertOwned(id, userId))) {
    return { ok: false, error: "Project not found" };
  }
  await db
    .update(projects)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${id}`);
  return { ok: true, data: { id, archived } };
}

export interface ProjectDetail {
  id: string;
  notes: string | null;
  targetDate: string | null;
  faction: string | null;
  game: string | null;
  referenceImageUrl: string | null;
  archived: boolean;
}

/** Load the inspector-only fields not present on the dashboard project tree. */
export async function loadProjectDetail(
  id: string,
): Promise<ProjectDetail | null> {
  const userId = await currentUserId();
  const rows = await db
    .select({
      id: projects.id,
      notesMd: projects.notesMd,
      targetDate: projects.targetDate,
      faction: projects.faction,
      game: projects.game,
      referenceImageUrl: projects.referenceImageUrl,
      archivedAt: projects.archivedAt,
    })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    notes: row.notesMd ?? null,
    targetDate: row.targetDate ? isoDay(row.targetDate) : null,
    faction: row.faction ?? null,
    game: row.game ?? null,
    referenceImageUrl: row.referenceImageUrl ?? null,
    archived: row.archivedAt != null,
  };
}

/* ============================================================
   loadProjectRecipeCards — every recipe attached to a project OR
   any of its sub-projects, with the attached node's name + type and
   a resolved palette (hex + "Brand Name") so the panel can render
   readable swatch squares. Owner-scoped; two SQL reads + the cached
   paint catalog.
============================================================ */

export interface ProjectRecipeCard {
  id: string;
  name: string;
  /** The project/sub-project this recipe is attached to. */
  attachedProjectId: string;
  attachedProjectName: string;
  /** App-facing project type ("Terrain Piece"/"Diorama" collapse to "Terrain"). */
  attachedProjectType: KitProjectType;
  /** Resolved swatches in slot order (hex + readable paint label). */
  palette: { hex: string; label: string }[];
  slotCount: number;
}

export async function loadProjectRecipeCards(
  rootId: string,
): Promise<ProjectRecipeCard[]> {
  const userId = await currentUserId();

  // The owner's whole tree → the root + descendant id/name/type set.
  const all = await db
    .select({
      id: projects.id,
      parentId: projects.parentId,
      name: projects.name,
      type: projects.type,
    })
    .from(projects)
    .where(eq(projects.ownerId, userId));
  if (!all.some((p) => p.id === rootId)) return [];

  const childrenByParent = new Map<string, typeof all>();
  for (const p of all) {
    if (!p.parentId) continue;
    const arr = childrenByParent.get(p.parentId) ?? [];
    arr.push(p);
    childrenByParent.set(p.parentId, arr);
  }
  const meta = new Map(all.map((p) => [p.id, p] as const));
  const ids: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const head = stack.pop();
    if (head === undefined) break;
    ids.push(head);
    for (const c of childrenByParent.get(head) ?? []) stack.push(c.id);
  }

  const recipeRows = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.ownerId, userId), inArray(recipes.attachedProjectId, ids)))
    .orderBy(desc(recipes.updatedAt));
  if (recipeRows.length === 0) return [];

  const recipeIds = recipeRows.map((r) => r.id);
  const slotRows = await db
    .select()
    .from(recipeSlots)
    .where(inArray(recipeSlots.recipeId, recipeIds))
    .orderBy(asc(recipeSlots.recipeId), asc(recipeSlots.position));
  const slotsByRecipe = new Map<string, typeof slotRows>();
  for (const s of slotRows) {
    const arr = slotsByRecipe.get(s.recipeId) ?? [];
    arr.push(s);
    slotsByRecipe.set(s.recipeId, arr);
  }

  const paintMeta = await getPaintMetaMap();

  return recipeRows.flatMap((r) => {
    const attachedId = r.attachedProjectId;
    if (!attachedId) return [];
    const node = meta.get(attachedId);
    if (!node) return [];
    const slots = slotsByRecipe.get(r.id) ?? [];
    const palette: { hex: string; label: string }[] = [];
    for (const slot of slots) {
      if (slot.paintId) {
        const m = paintMeta.get(slot.paintId);
        if (m) palette.push({ hex: m.hex, label: m.label });
      } else if (slot.customColorHex) {
        palette.push({ hex: slot.customColorHex, label: slot.customColorHex });
      }
      if (palette.length >= 14) break;
    }
    return [
      {
        id: r.id,
        name: r.name,
        attachedProjectId: attachedId,
        attachedProjectName: node.name,
        attachedProjectType: TYPE_MAP[node.type] ?? "Model",
        palette,
        slotCount: slots.length,
      },
    ];
  });
}
