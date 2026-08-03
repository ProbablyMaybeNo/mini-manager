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

const {
  clearLimit,
  enforceDailyLimit,
  enforceWindowedLimit,
  bumpAndCount,
  fixedWindow,
  RateLimitBucket,
  utcDay,
} = await import("@/lib/rateLimit/quota");

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

/**
 * R2-19 — the short-window mode the auth paths use. The daily mode is wrong
 * for them: its subject is an IP or an attacker-chosen username, so a
 * day-long refusal is a day-long lockout of an innocent third party.
 */
describe("enforceWindowedLimit", () => {
  const WINDOW = 15 * 60_000;

  test("allows up to the limit, refuses the N+1th call in the window", async () => {
    const at = new Date("2026-08-02T10:00:00Z");
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(
        await enforceWindowedLimit(
          RateLimitBucket.PasswordReset,
          "alice",
          3,
          WINDOW,
          at,
        ),
      );
    }
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.count)).toEqual([1, 2, 3, 4]);
  });

  test("the next window resets the count — minutes, not a day", async () => {
    const at = new Date("2026-08-02T10:00:00Z");
    const nextWindow = new Date("2026-08-02T10:16:00Z");
    // Same UTC day, so the daily mode would still be refusing here.
    expect(utcDay(at)).toBe(utcDay(nextWindow));

    const first = await enforceWindowedLimit(
      RateLimitBucket.PasswordReset,
      "alice",
      1,
      WINDOW,
      at,
    );
    const second = await enforceWindowedLimit(
      RateLimitBucket.PasswordReset,
      "alice",
      1,
      WINDOW,
      at,
    );
    const later = await enforceWindowedLimit(
      RateLimitBucket.PasswordReset,
      "alice",
      1,
      WINDOW,
      nextWindow,
    );
    expect([first.allowed, second.allowed, later.allowed]).toEqual([
      true,
      false,
      true,
    ]);
  });

  test("meters each subject independently", async () => {
    const at = new Date("2026-08-02T10:00:00Z");
    await enforceWindowedLimit(RateLimitBucket.PasswordReset, "alice", 1, WINDOW, at);
    const aliceAgain = await enforceWindowedLimit(
      RateLimitBucket.PasswordReset,
      "alice",
      1,
      WINDOW,
      at,
    );
    const bob = await enforceWindowedLimit(
      RateLimitBucket.PasswordReset,
      "bob",
      1,
      WINDOW,
      at,
    );
    expect(aliceAgain.allowed).toBe(false);
    expect(bob.allowed).toBe(true);
  });

  test("two window sizes for one subject get separate counters", async () => {
    const at = new Date("2026-08-02T10:00:00Z");
    // The burst tier is exhausted...
    await enforceWindowedLimit(RateLimitBucket.PasswordReset, "alice", 1, 60_000, at);
    const burst = await enforceWindowedLimit(
      RateLimitBucket.PasswordReset,
      "alice",
      1,
      60_000,
      at,
    );
    // ...while the longer tier, same bucket + same subject, is untouched.
    const hourly = await enforceWindowedLimit(
      RateLimitBucket.PasswordReset,
      "alice",
      5,
      60 * 60_000,
      at,
    );
    expect(burst.allowed).toBe(false);
    expect(hourly.allowed).toBe(true);
    expect(hourly.count).toBe(1);
  });

  test("clearLimit wipes every tier for one subject and nobody else's", async () => {
    const at = new Date("2026-08-02T10:00:00Z");
    await enforceWindowedLimit(RateLimitBucket.SignIn, "alice|1.1.1.1", 1, 60_000, at);
    await enforceWindowedLimit(
      RateLimitBucket.SignIn,
      "alice|1.1.1.1",
      1,
      60 * 60_000,
      at,
    );
    await enforceWindowedLimit(RateLimitBucket.SignIn, "bob|1.1.1.1", 1, 60_000, at);

    await clearLimit(RateLimitBucket.SignIn, "alice|1.1.1.1");

    // Both of alice's tiers are back to a full allowance...
    const burst = await enforceWindowedLimit(
      RateLimitBucket.SignIn,
      "alice|1.1.1.1",
      1,
      60_000,
      at,
    );
    const sustained = await enforceWindowedLimit(
      RateLimitBucket.SignIn,
      "alice|1.1.1.1",
      1,
      60 * 60_000,
      at,
    );
    // ...and bob's tally is untouched.
    const bob = await enforceWindowedLimit(
      RateLimitBucket.SignIn,
      "bob|1.1.1.1",
      1,
      60_000,
      at,
    );
    expect([burst.allowed, sustained.allowed]).toEqual([true, true]);
    expect(bob.allowed).toBe(false);
  });

  test("fixedWindow encodes the window length so tiers cannot collide", () => {
    const at = new Date("2026-08-02T10:07:30Z");
    expect(fixedWindow(60_000, at)).not.toBe(fixedWindow(60 * 60_000, at));
    // Stable within the window, advances across it.
    expect(fixedWindow(15 * 60_000, new Date("2026-08-02T10:00:00Z"))).toBe(
      fixedWindow(15 * 60_000, new Date("2026-08-02T10:14:59Z")),
    );
    expect(fixedWindow(15 * 60_000, new Date("2026-08-02T10:00:00Z"))).not.toBe(
      fixedWindow(15 * 60_000, new Date("2026-08-02T10:15:00Z")),
    );
  });
});
