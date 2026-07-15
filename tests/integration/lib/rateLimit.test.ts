/**
 * E7 — the shared DB-counter quota primitive behind the AI route, the gallery
 * submit action, and the signup limiter. Runs against a real in-memory libsql
 * DB with all migrations applied.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { makeTestDb, type TestDb } from "../_helpers/testDb";

const state = vi.hoisted(() => ({ db: null as TestDb | null }));

vi.mock("@/db/client", () => ({
  get db() {
    if (!state.db) throw new Error("Test DB not initialised in beforeEach");
    return state.db;
  },
}));

const { enforceDailyLimit, bumpAndCount, RateLimitBucket, utcDay } = await import(
  "@/lib/rateLimit/quota"
);

beforeEach(async () => {
  const { db } = await makeTestDb();
  state.db = db;
});

afterEach(() => {
  state.db = null;
});

describe("enforceDailyLimit", () => {
  test("allows up to the limit, refuses the N+1th call", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(
        await enforceDailyLimit(RateLimitBucket.RecipeAi, "user-1", 3),
      );
    }
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.count)).toEqual([1, 2, 3, 4]);
    expect(results[3]!.limit).toBe(3);
  });

  test("meters each subject independently", async () => {
    await enforceDailyLimit(RateLimitBucket.RecipeAi, "user-a", 1);
    const aSecond = await enforceDailyLimit(RateLimitBucket.RecipeAi, "user-a", 1);
    const bFirst = await enforceDailyLimit(RateLimitBucket.RecipeAi, "user-b", 1);
    expect(aSecond.allowed).toBe(false);
    expect(bFirst.allowed).toBe(true);
  });

  test("meters each bucket independently", async () => {
    await enforceDailyLimit(RateLimitBucket.RecipeAi, "user-1", 1);
    const aiSecond = await enforceDailyLimit(RateLimitBucket.RecipeAi, "user-1", 1);
    const gallery = await enforceDailyLimit(
      RateLimitBucket.GallerySubmit,
      "user-1",
      1,
    );
    expect(aiSecond.allowed).toBe(false);
    expect(gallery.allowed).toBe(true);
  });

  test("a new day resets the count", async () => {
    const today = new Date("2026-07-15T10:00:00Z");
    const tomorrow = new Date("2026-07-16T10:00:00Z");
    const t1 = await enforceDailyLimit(RateLimitBucket.RecipeAi, "user-1", 1, today);
    const t2 = await enforceDailyLimit(RateLimitBucket.RecipeAi, "user-1", 1, today);
    const nextDay = await enforceDailyLimit(
      RateLimitBucket.RecipeAi,
      "user-1",
      1,
      tomorrow,
    );
    expect(t1.allowed).toBe(true);
    expect(t2.allowed).toBe(false);
    expect(nextDay.allowed).toBe(true);
    expect(utcDay(today)).toBe("2026-07-15");
    expect(utcDay(tomorrow)).toBe("2026-07-16");
  });

  test("bumpAndCount increments atomically and returns the new count", async () => {
    expect(await bumpAndCount(RateLimitBucket.Signup, "1.2.3.4")).toBe(1);
    expect(await bumpAndCount(RateLimitBucket.Signup, "1.2.3.4")).toBe(2);
  });
});
