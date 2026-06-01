/**
 * P14.3 — Calendar widget server actions.
 *
 * Covers the three CRUD actions (createEvent / updateEvent / deleteEvent)
 * plus the `listEventsInMonth` query helper. Tests exercise the same
 * in-memory libsql DB the rest of the integration suite uses so the
 * Zod validation, ownership scoping, and month-range bucketing all
 * hit the real production code path.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { events } from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: "" as string,
}));

vi.mock("@/db/client", () => ({
  get db() {
    if (!state.db) throw new Error("Test DB not initialised in beforeEach");
    return state.db;
  },
}));

vi.mock("@/lib/auth-stub", () => ({
  currentUserId: async () => state.userId,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { createEvent, updateEvent, deleteEvent } = await import(
  "@/lib/actions/events"
);
const { listEventsInMonth, monthRange } = await import(
  "@/db/queries/events"
);

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("createEvent (P14.3)", () => {
  test("inserts a row with the parsed UTC date + kind + notes", async () => {
    const res = await createEvent({
      name: "AdeptiCon 2026",
      date: "2026-07-04",
      kind: "tournament",
      notes: "Bring the Crimson Fists list",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const rows = await state.db!.select().from(events);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("AdeptiCon 2026");
    expect(rows[0]!.kind).toBe("tournament");
    expect(rows[0]!.notes).toBe("Bring the Crimson Fists list");
    expect(rows[0]!.userId).toBe(state.userId);
    // Date parses to midnight UTC of the chosen day.
    expect(rows[0]!.eventDate.getUTCFullYear()).toBe(2026);
    expect(rows[0]!.eventDate.getUTCMonth()).toBe(6); // July (0-indexed)
    expect(rows[0]!.eventDate.getUTCDate()).toBe(4);
    expect(rows[0]!.eventDate.getUTCHours()).toBe(0);
  });

  test("rejects empty name", async () => {
    const res = await createEvent({
      name: "",
      date: "2026-07-04",
      kind: "tournament",
      notes: null,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Name is required/i);
  });

  test("rejects malformed date", async () => {
    const res = await createEvent({
      name: "Bad",
      date: "07/04/2026",
      kind: "deadline",
      notes: null,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/valid date/i);
  });

  test("normalises empty / whitespace notes to NULL", async () => {
    const res = await createEvent({
      name: "Sketch deadline",
      date: "2026-06-15",
      kind: "deadline",
      notes: "   ",
    });
    expect(res.ok).toBe(true);
    const rows = await state.db!.select().from(events);
    expect(rows[0]!.notes).toBeNull();
  });

  test("accepts every valid event kind", async () => {
    for (const kind of [
      "tournament",
      "deadline",
      "battle",
      "other",
    ] as const) {
      const res = await createEvent({
        name: `Test ${kind}`,
        date: "2026-05-15",
        kind,
        notes: null,
      });
      expect(res.ok).toBe(true);
    }
    const rows = await state.db!.select().from(events);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.kind).sort()).toEqual([
      "battle",
      "deadline",
      "other",
      "tournament",
    ]);
  });
});

describe("updateEvent (P14.3)", () => {
  test("rewrites name + date + kind + notes for an owner-scoped event", async () => {
    const created = await createEvent({
      name: "Original",
      date: "2026-06-15",
      kind: "tournament",
      notes: "old",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await updateEvent({
      id: created.data.id,
      name: "Renamed",
      date: "2026-08-20",
      kind: "battle",
      notes: "new",
    });
    expect(res.ok).toBe(true);

    const rows = await state
      .db!.select()
      .from(events)
      .where(eq(events.id, created.data.id));
    expect(rows[0]!.name).toBe("Renamed");
    expect(rows[0]!.kind).toBe("battle");
    expect(rows[0]!.notes).toBe("new");
    expect(rows[0]!.eventDate.getUTCMonth()).toBe(7); // August
    expect(rows[0]!.eventDate.getUTCDate()).toBe(20);
  });

  test("refuses to update another user's event", async () => {
    const otherUser = await seedExtraUser(state.db!);
    // Insert directly under the other user.
    await state.db!.insert(events).values({
      id: "evt_other",
      userId: otherUser,
      name: "Theirs",
      eventDate: new Date(Date.UTC(2026, 5, 1)),
      kind: "tournament",
    });

    const res = await updateEvent({
      id: "evt_other",
      name: "Hijacked",
      date: "2026-06-01",
      kind: "deadline",
      notes: null,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found/i);

    // Sanity: the other user's row is untouched.
    const rows = await state.db!.select().from(events).where(eq(events.id, "evt_other"));
    expect(rows[0]!.name).toBe("Theirs");
    expect(rows[0]!.kind).toBe("tournament");
  });

  test("returns 'not found' for a missing id", async () => {
    const res = await updateEvent({
      id: "nope",
      name: "Test",
      date: "2026-06-01",
      kind: "other",
      notes: null,
    });
    expect(res.ok).toBe(false);
  });
});

describe("deleteEvent (P14.3)", () => {
  test("removes an owner-scoped event row", async () => {
    const created = await createEvent({
      name: "Doomed",
      date: "2026-06-15",
      kind: "deadline",
      notes: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await deleteEvent({ id: created.data.id });
    expect(res.ok).toBe(true);

    const rows = await state.db!.select().from(events);
    expect(rows).toHaveLength(0);
  });

  test("refuses to delete another user's event", async () => {
    const otherUser = await seedExtraUser(state.db!);
    await state.db!.insert(events).values({
      id: "evt_safe",
      userId: otherUser,
      name: "Theirs",
      eventDate: new Date(Date.UTC(2026, 5, 1)),
      kind: "tournament",
    });

    const res = await deleteEvent({ id: "evt_safe" });
    expect(res.ok).toBe(false);

    const rows = await state.db!.select().from(events);
    expect(rows).toHaveLength(1);
  });
});

describe("listEventsInMonth (P14.3)", () => {
  test("returns only events inside the month range, ordered asc", async () => {
    // June, July, and August events. Query for July → 1 row.
    await createEvent({
      name: "Late May",
      date: "2026-05-30",
      kind: "tournament",
      notes: null,
    });
    await createEvent({
      name: "Early July",
      date: "2026-07-04",
      kind: "battle",
      notes: null,
    });
    await createEvent({
      name: "Late July",
      date: "2026-07-31",
      kind: "deadline",
      notes: null,
    });
    await createEvent({
      name: "Early August",
      date: "2026-08-01",
      kind: "other",
      notes: null,
    });

    const julyRows = await listEventsInMonth(state.userId, 2026, 6); // 0-indexed July
    expect(julyRows).toHaveLength(2);
    expect(julyRows[0]!.name).toBe("Early July");
    expect(julyRows[1]!.name).toBe("Late July");
  });

  test("ignores rows owned by other users", async () => {
    const otherUser = await seedExtraUser(state.db!);
    await state.db!.insert(events).values({
      userId: otherUser,
      name: "Not yours",
      eventDate: new Date(Date.UTC(2026, 6, 15)),
      kind: "tournament",
    });
    const rows = await listEventsInMonth(state.userId, 2026, 6);
    expect(rows).toHaveLength(0);
  });

  test("monthRange helper covers the whole calendar month", () => {
    const r = monthRange(2026, 6); // July
    expect(r.start.getUTCFullYear()).toBe(2026);
    expect(r.start.getUTCMonth()).toBe(6);
    expect(r.start.getUTCDate()).toBe(1);
    expect(r.end.getUTCFullYear()).toBe(2026);
    expect(r.end.getUTCMonth()).toBe(6);
    expect(r.end.getUTCDate()).toBe(31);
  });
});
