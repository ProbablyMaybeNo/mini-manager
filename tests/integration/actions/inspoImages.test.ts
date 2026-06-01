/**
 * P14.7 — Inspo gallery server actions.
 *
 * Pins the four CRUD actions (addInspoImage, toggleInspoDisplay,
 * deleteInspoImage, reorderInspoImages) + the two query helpers.
 *
 * Locked behaviour: the action layer NEVER fetches the URL. The
 * URL-shape Zod refinement only checks scheme + parseability; nothing
 * else.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { inspoImages } from "@/db/schema";

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

const {
  addInspoImage,
  toggleInspoDisplay,
  deleteInspoImage,
  reorderInspoImages,
} = await import("@/lib/actions/inspoImages");
const { listDisplayedInspoImages, listAllInspoImages } = await import(
  "@/db/queries/inspoImages"
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

describe("addInspoImage (P14.7)", () => {
  test("accepts a valid https URL + optional alt text", async () => {
    const res = await addInspoImage({
      url: "https://www.pinterest.com/pin/12345",
      altText: "Crimson Fists reference",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const rows = await state.db!.select().from(inspoImages);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.url).toBe("https://www.pinterest.com/pin/12345");
    expect(rows[0]!.altText).toBe("Crimson Fists reference");
    expect(rows[0]!.isDisplayed).toBe(true);
    expect(rows[0]!.positionIndex).toBe(0);
    expect(rows[0]!.userId).toBe(state.userId);
  });

  test("accepts http URLs (some references live on plain http)", async () => {
    const res = await addInspoImage({
      url: "http://example.com/img.jpg",
      altText: null,
    });
    expect(res.ok).toBe(true);
  });

  test("rejects malformed URLs", async () => {
    const res = await addInspoImage({
      url: "not-a-url",
      altText: null,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/valid http/i);
  });

  test("rejects non-http(s) URLs (no javascript:, data:, ftp:)", async () => {
    for (const url of [
      "javascript:alert(1)",
      "data:image/png;base64,abc",
      "ftp://example.com/img.jpg",
      "file:///etc/passwd",
    ]) {
      const res = await addInspoImage({ url, altText: null });
      expect(res.ok, `expected reject for ${url}`).toBe(false);
    }
  });

  test("rejects empty URL", async () => {
    const res = await addInspoImage({ url: "", altText: null });
    expect(res.ok).toBe(false);
  });

  test("rejects > 2048 char URL", async () => {
    const tooLong = "https://example.com/" + "a".repeat(2050);
    const res = await addInspoImage({ url: tooLong, altText: null });
    expect(res.ok).toBe(false);
  });

  test("normalises empty / whitespace alt text to NULL", async () => {
    const res = await addInspoImage({
      url: "https://example.com/x.jpg",
      altText: "   ",
    });
    expect(res.ok).toBe(true);
    const rows = await state.db!.select().from(inspoImages);
    expect(rows[0]!.altText).toBeNull();
  });

  test("assigns ascending positionIndex per add", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await addInspoImage({
        url: `https://example.com/${i}.jpg`,
        altText: null,
      });
      expect(res.ok).toBe(true);
    }
    const rows = await state
      .db!.select()
      .from(inspoImages)
      .orderBy(asc(inspoImages.positionIndex));
    expect(rows.map((r) => r.positionIndex)).toEqual([0, 1, 2]);
  });

  test("does not fetch the URL on add (locked rule)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await addInspoImage({
      url: "https://example.com/should-not-fetch.jpg",
      altText: null,
    });
    expect(res.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("toggleInspoDisplay (P14.7)", () => {
  test("flips an owner-scoped row's isDisplayed", async () => {
    const created = await addInspoImage({
      url: "https://example.com/a.jpg",
      altText: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    let res = await toggleInspoDisplay({
      id: created.data.id,
      isDisplayed: false,
    });
    expect(res.ok).toBe(true);
    let rows = await state
      .db!.select()
      .from(inspoImages)
      .where(eq(inspoImages.id, created.data.id));
    expect(rows[0]!.isDisplayed).toBe(false);

    res = await toggleInspoDisplay({
      id: created.data.id,
      isDisplayed: true,
    });
    expect(res.ok).toBe(true);
    rows = await state
      .db!.select()
      .from(inspoImages)
      .where(eq(inspoImages.id, created.data.id));
    expect(rows[0]!.isDisplayed).toBe(true);
  });

  test("refuses to toggle another user's row", async () => {
    const otherUser = await seedExtraUser(state.db!);
    await state.db!.insert(inspoImages).values({
      id: "inspo_other",
      userId: otherUser,
      url: "https://example.com/x.jpg",
      isDisplayed: true,
      positionIndex: 0,
    });

    const res = await toggleInspoDisplay({
      id: "inspo_other",
      isDisplayed: false,
    });
    expect(res.ok).toBe(false);

    const rows = await state
      .db!.select()
      .from(inspoImages)
      .where(eq(inspoImages.id, "inspo_other"));
    expect(rows[0]!.isDisplayed).toBe(true);
  });
});

describe("deleteInspoImage (P14.7)", () => {
  test("removes an owner-scoped row", async () => {
    const created = await addInspoImage({
      url: "https://example.com/a.jpg",
      altText: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const res = await deleteInspoImage({ id: created.data.id });
    expect(res.ok).toBe(true);

    const rows = await state.db!.select().from(inspoImages);
    expect(rows).toHaveLength(0);
  });

  test("refuses to delete another user's row", async () => {
    const otherUser = await seedExtraUser(state.db!);
    await state.db!.insert(inspoImages).values({
      id: "inspo_safe",
      userId: otherUser,
      url: "https://example.com/x.jpg",
      isDisplayed: true,
      positionIndex: 0,
    });
    const res = await deleteInspoImage({ id: "inspo_safe" });
    expect(res.ok).toBe(false);
    const rows = await state.db!.select().from(inspoImages);
    expect(rows).toHaveLength(1);
  });
});

describe("reorderInspoImages (P14.7)", () => {
  async function seedThree(): Promise<{ a: string; b: string; c: string }> {
    const a = await addInspoImage({
      url: "https://example.com/a.jpg",
      altText: null,
    });
    const b = await addInspoImage({
      url: "https://example.com/b.jpg",
      altText: null,
    });
    const c = await addInspoImage({
      url: "https://example.com/c.jpg",
      altText: null,
    });
    if (!a.ok || !b.ok || !c.ok) throw new Error("seed failed");
    return { a: a.data.id, b: b.data.id, c: c.data.id };
  }

  test("writes new positionIndex values in the supplied order", async () => {
    const { a, b, c } = await seedThree();
    const res = await reorderInspoImages({ orderedIds: [c, a, b] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.updated).toBe(3);

    const rows = await listDisplayedInspoImages(state.userId);
    expect(rows.map((r) => r.id)).toEqual([c, a, b]);
  });

  test("rejects an ordering that includes another user's row", async () => {
    const { a } = await seedThree();
    const otherUser = await seedExtraUser(state.db!);
    await state.db!.insert(inspoImages).values({
      id: "inspo_alien",
      userId: otherUser,
      url: "https://example.com/x.jpg",
      isDisplayed: true,
      positionIndex: 0,
    });

    const res = await reorderInspoImages({
      orderedIds: [a, "inspo_alien"],
    });
    expect(res.ok).toBe(false);
  });

  test("rejects empty / oversized ordering lists", async () => {
    let res = await reorderInspoImages({ orderedIds: [] });
    expect(res.ok).toBe(false);

    const tooMany = Array.from({ length: 501 }, (_, i) => `id_${i}`);
    res = await reorderInspoImages({ orderedIds: tooMany });
    expect(res.ok).toBe(false);
  });
});

describe("query helpers (P14.7)", () => {
  test("listDisplayedInspoImages returns only rows where isDisplayed = true, in position order", async () => {
    const a = await addInspoImage({
      url: "https://example.com/a.jpg",
      altText: null,
    });
    const b = await addInspoImage({
      url: "https://example.com/b.jpg",
      altText: null,
    });
    const c = await addInspoImage({
      url: "https://example.com/c.jpg",
      altText: null,
    });
    if (!a.ok || !b.ok || !c.ok) throw new Error("seed failed");

    await toggleInspoDisplay({ id: b.data.id, isDisplayed: false });

    const rows = await listDisplayedInspoImages(state.userId);
    expect(rows.map((r) => r.id)).toEqual([a.data.id, c.data.id]);
  });

  test("listAllInspoImages returns displayed before hidden, both in position order", async () => {
    const a = await addInspoImage({
      url: "https://example.com/a.jpg",
      altText: null,
    });
    const b = await addInspoImage({
      url: "https://example.com/b.jpg",
      altText: null,
    });
    const c = await addInspoImage({
      url: "https://example.com/c.jpg",
      altText: null,
    });
    if (!a.ok || !b.ok || !c.ok) throw new Error("seed failed");

    // Hide the FIRST row — it should now sort to the bottom.
    await toggleInspoDisplay({ id: a.data.id, isDisplayed: false });

    const rows = await listAllInspoImages(state.userId);
    expect(rows.map((r) => r.id)).toEqual([
      b.data.id,
      c.data.id,
      a.data.id,
    ]);
  });

  test("query helpers ignore rows owned by other users", async () => {
    const otherUser = await seedExtraUser(state.db!);
    await state.db!.insert(inspoImages).values({
      userId: otherUser,
      url: "https://example.com/not-yours.jpg",
      isDisplayed: true,
      positionIndex: 0,
    });

    const displayed = await listDisplayedInspoImages(state.userId);
    expect(displayed).toHaveLength(0);
    const all = await listAllInspoImages(state.userId);
    expect(all).toHaveLength(0);
  });
});
