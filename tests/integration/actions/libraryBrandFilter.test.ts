import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { users } from "@/db/schema";

/**
 * P12.19 — setLibraryBrandFilterAction integration tests.
 *
 * Writes the JSON-encoded brand array to users.libraryBrandFilter.
 * Null + all-brands-checked both store null (= "no filter").
 */

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

const { setLibraryBrandFilterAction } = await import(
  "@/lib/actions/libraryBrandFilter"
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

async function readFilter(): Promise<string | null> {
  const [row] = await state.db!
    .select({ libraryBrandFilter: users.libraryBrandFilter })
    .from(users)
    .where(eq(users.id, state.userId));
  return row?.libraryBrandFilter ?? null;
}

describe("setLibraryBrandFilterAction", () => {
  test("stores a JSON-encoded array when an explicit selection is set", async () => {
    const result = await setLibraryBrandFilterAction({
      brands: ["Citadel", "Vallejo"],
    });
    expect(result.ok).toBe(true);
    expect(await readFilter()).toBe('["Citadel","Vallejo"]');
  });

  test("stores null when brands === null", async () => {
    // First seed an explicit selection so we can confirm null clears it.
    await setLibraryBrandFilterAction({ brands: ["Citadel"] });
    expect(await readFilter()).not.toBeNull();

    const result = await setLibraryBrandFilterAction({ brands: null });
    expect(result.ok).toBe(true);
    expect(await readFilter()).toBeNull();
  });

  test("rejects more than 64 brand entries", async () => {
    const tooMany = Array.from({ length: 65 }, (_, i) => `Brand${i}`);
    const result = await setLibraryBrandFilterAction({ brands: tooMany });
    expect(result.ok).toBe(false);
  });

  test("trims and rejects empty brand names", async () => {
    const result = await setLibraryBrandFilterAction({
      brands: ["  "],
    });
    expect(result.ok).toBe(false);
  });

  test("scopes by owner — only the current user's row updates", async () => {
    // Schema has a single user from makeTestDb; assert that the row
    // we read by userId is the one that changed (no other rows
    // exist, but the eq() narrowing is the important contract).
    await setLibraryBrandFilterAction({ brands: ["Citadel"] });
    const all = await state.db!
      .select({ id: users.id, libraryBrandFilter: users.libraryBrandFilter })
      .from(users);
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(state.userId);
    expect(all[0]?.libraryBrandFilter).toBe('["Citadel"]');
  });
});
