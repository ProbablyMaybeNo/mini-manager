"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

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

export interface ProjectDetail {
  id: string;
  notes: string | null;
  targetDate: string | null;
  faction: string | null;
  game: string | null;
  referenceImageUrl: string | null;
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
  };
}
