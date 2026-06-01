"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { events, eventKinds } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * P14.3 — Calendar widget server actions.
 *
 * Three CRUD actions backing the dashboard calendar:
 *   - createEvent  → inline add-event form below the month grid.
 *   - updateEvent  → edit affordance inside the day-expansion list.
 *   - deleteEvent  → delete affordance inside the day-expansion list.
 *
 * Every action validates input with Zod, scopes by `ownerId`, and
 * revalidates `/projects` so the calendar re-renders the new state.
 * Date strings come in as `YYYY-MM-DD` from the form's `<input
 * type="date">` and are normalised to a midnight-UTC `Date` — the
 * calendar treats `event_date` as a day-local value with no
 * meaningful time component.
 */

/** ISO-day shape (`YYYY-MM-DD`) emitted by `<input type="date">`. */
const dayStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");

function parseEventDate(day: string): Date {
  // Lock to midnight UTC so the calendar's day-index is stable across
  // timezones — the schema stores ms-since-epoch.
  const [yearStr, monthStr, dayStr] = day.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const dayNum = Number(dayStr);
  return new Date(Date.UTC(year, month - 1, dayNum, 0, 0, 0, 0));
}

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
  date: dayStringSchema,
  kind: z.enum(eventKinds),
  notes: z
    .string()
    .max(2_000, "Notes are too long")
    .trim()
    .nullish()
    .transform((v) => (v == null || v === "" ? null : v)),
});

export type CreateEventInput = z.infer<typeof createSchema>;

export async function createEvent(
  raw: CreateEventInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid event" };
  }
  const { name, date, kind, notes } = parsed.data;
  const userId = await currentUserId();

  try {
    const inserted = await db
      .insert(events)
      .values({
        userId,
        name,
        eventDate: parseEventDate(date),
        kind,
        notes: notes ?? null,
      })
      .returning({ id: events.id });

    const row = inserted[0];
    if (!row) return { ok: false, error: "Failed to create event" };

    revalidatePath("/projects");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create event",
    };
  }
}

const updateSchema = z.object({
  id: z.string().min(1).max(64),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
  date: dayStringSchema,
  kind: z.enum(eventKinds),
  notes: z
    .string()
    .max(2_000, "Notes are too long")
    .trim()
    .nullish()
    .transform((v) => (v == null || v === "" ? null : v)),
});

export type UpdateEventInput = z.infer<typeof updateSchema>;

export async function updateEvent(
  raw: UpdateEventInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid event" };
  }
  const { id, name, date, kind, notes } = parsed.data;
  const userId = await currentUserId();

  const owned = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .limit(1);
  if (!owned[0]) return { ok: false, error: "Event not found" };

  try {
    await db
      .update(events)
      .set({
        name,
        eventDate: parseEventDate(date),
        kind,
        notes: notes ?? null,
      })
      .where(eq(events.id, id));
    revalidatePath("/projects");
    return { ok: true, data: { id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update event",
    };
  }
}

const deleteSchema = z.object({
  id: z.string().min(1).max(64),
});

export async function deleteEvent(
  raw: z.infer<typeof deleteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid id",
    };
  }
  const { id } = parsed.data;
  const userId = await currentUserId();

  const owned = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .limit(1);
  if (!owned[0]) return { ok: false, error: "Event not found" };

  try {
    await db.delete(events).where(eq(events.id, id));
    revalidatePath("/projects");
    return { ok: true, data: { id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete event",
    };
  }
}
