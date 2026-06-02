/**
 * P15.x — Per-paint notes action + query.
 *
 * Covers the upsert / clear / owner-scoping contract of `setPaintNote`
 * and the bounded, user-scoped read of `getPaintNotesMap`. Per-paint
 * notes are keyed on (user_id, paint_id), so a note follows the paint
 * everywhere it's pinned — never leaking across painters.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { paintNotes } from "@/db/schema";

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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { setPaintNote } = await import("@/lib/actions/paintNotes");
const { getPaintNotesMap } = await import("@/db/queries/paintNotes");

const PAINT_A = "citadel-mephiston-red";
const PAINT_B = "citadel-macragge-blue";

async function notesFor(userId: string) {
  return state.db!
    .select()
    .from(paintNotes)
    .where(eq(paintNotes.userId, userId));
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("setPaintNote", () => {
  test("inserts a note on first set", async () => {
    const res = await setPaintNote(PAINT_A, "2 thin coats, then Nuln Oil");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ paintId: PAINT_A, cleared: false });

    const rows = await notesFor(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.paintId).toBe(PAINT_A);
    expect(rows[0]!.note).toBe("2 thin coats, then Nuln Oil");
  });

  test("upserts the existing row rather than duplicating", async () => {
    await setPaintNote(PAINT_A, "first note");
    const res = await setPaintNote(PAINT_A, "revised note");
    expect(res.ok).toBe(true);

    const rows = await notesFor(state.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.note).toBe("revised note");
  });

  test("trims surrounding whitespace before saving", async () => {
    await setPaintNote(PAINT_A, "  edge highlight only  ");
    const rows = await notesFor(state.userId);
    expect(rows[0]!.note).toBe("edge highlight only");
  });

  test("an empty note clears (deletes) the row", async () => {
    await setPaintNote(PAINT_A, "scratch note");
    const res = await setPaintNote(PAINT_A, "");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ paintId: PAINT_A, cleared: true });

    expect(await notesFor(state.userId)).toHaveLength(0);
  });

  test("a whitespace-only note clears the row", async () => {
    await setPaintNote(PAINT_A, "scratch note");
    const res = await setPaintNote(PAINT_A, "   ");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.cleared).toBe(true);
    expect(await notesFor(state.userId)).toHaveLength(0);
  });

  test("clearing a paint that never had a note is a no-op success", async () => {
    const res = await setPaintNote(PAINT_A, "");
    expect(res.ok).toBe(true);
    expect(await notesFor(state.userId)).toHaveLength(0);
  });

  test("rejects an empty paint id", async () => {
    const res = await setPaintNote("", "note");
    expect(res.ok).toBe(false);
  });

  test("rejects an over-long note", async () => {
    const res = await setPaintNote(PAINT_A, "x".repeat(2_001));
    expect(res.ok).toBe(false);
  });

  test("notes are owner-scoped — two painters keep independent notes", async () => {
    const other = await seedExtraUser(state.db!, "rival");

    await setPaintNote(PAINT_A, "mine");
    // Switch identity, write the same paint, and confirm no cross-write.
    state.userId = other;
    await setPaintNote(PAINT_A, "theirs");

    const ownerRow = await state.db!
      .select()
      .from(paintNotes)
      .where(
        and(eq(paintNotes.paintId, PAINT_A), eq(paintNotes.userId, other)),
      );
    expect(ownerRow[0]!.note).toBe("theirs");

    // The original painter's note is untouched.
    const allForA = await state.db!
      .select()
      .from(paintNotes)
      .where(eq(paintNotes.paintId, PAINT_A));
    expect(allForA).toHaveLength(2);
  });
});

describe("getPaintNotesMap", () => {
  test("returns an empty map for an empty paint-id list", async () => {
    await setPaintNote(PAINT_A, "note");
    const map = await getPaintNotesMap(state.userId, []);
    expect(map.size).toBe(0);
  });

  test("resolves only the requested paints for this user", async () => {
    await setPaintNote(PAINT_A, "note A");
    await setPaintNote(PAINT_B, "note B");

    const map = await getPaintNotesMap(state.userId, [PAINT_A]);
    expect(map.get(PAINT_A)).toBe("note A");
    expect(map.has(PAINT_B)).toBe(false);
  });

  test("does not leak another painter's notes", async () => {
    const mine = state.userId;
    const other = await seedExtraUser(state.db!, "rival");

    state.userId = other;
    await setPaintNote(PAINT_A, "their secret mix");

    // Read as the original painter — they have no note for PAINT_A.
    state.userId = mine;
    const map = await getPaintNotesMap(mine, [PAINT_A]);
    expect(map.has(PAINT_A)).toBe(false);
  });

  test("maps multiple paints in one bounded read", async () => {
    await setPaintNote(PAINT_A, "A");
    await setPaintNote(PAINT_B, "B");
    const map = await getPaintNotesMap(state.userId, [PAINT_A, PAINT_B]);
    expect(map.get(PAINT_A)).toBe("A");
    expect(map.get(PAINT_B)).toBe("B");
    expect(map.size).toBe(2);
  });
});
