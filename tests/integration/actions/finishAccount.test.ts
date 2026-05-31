import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { users } from "@/db/schema";

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
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

const { finishAccount } = await import("@/lib/auth/finishAccount");

beforeEach(async () => {
  const { db } = await makeTestDb();
  state.db = db;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

/** Helper to seed a legacy magic-link user (email, no passwordHash). */
async function seedLegacyUser(opts?: {
  email?: string;
  recoveryEmail?: string | null;
  recoveryEmailVerified?: Date | null;
}): Promise<string> {
  const userId = nanoid(16);
  await state.db!.insert(users).values({
    id: userId,
    email: opts?.email ?? `legacy-${userId}@example.com`,
    name: "Legacy User",
    recoveryEmail: opts?.recoveryEmail ?? null,
    recoveryEmailVerified: opts?.recoveryEmailVerified ?? null,
  });
  state.userId = userId;
  return userId;
}

describe("finishAccount", () => {
  test("moves email → recoveryEmail (verified) and sets username + passwordHash", async () => {
    const userId = await seedLegacyUser({ email: "dogfood@example.com" });

    const res = await finishAccount({
      username: "dogfooduser",
      password: "longenoughpw",
    });
    expect(res.ok).toBe(true);

    const row = (
      await state.db!.select().from(users).where(eq(users.id, userId))
    )[0]!;
    expect(row.username).toBe("dogfooduser");
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(row.email).toBeNull();
    expect(row.recoveryEmail).toBe("dogfood@example.com");
    expect(row.recoveryEmailVerified).toBeInstanceOf(Date);
  });

  test("uses the credentials to sign in afterwards", async () => {
    await seedLegacyUser();
    await finishAccount({
      username: "alice",
      password: "longenoughpw",
    });

    const { signInWithCredentials } = await import("@/lib/auth/signUp");
    const res = await signInWithCredentials({
      username: "alice",
      password: "longenoughpw",
    });
    expect(res.ok).toBe(true);
  });

  test("idempotent — calling on an already-complete account returns ok", async () => {
    const userId = await seedLegacyUser();
    await finishAccount({
      username: "alice",
      password: "longenoughpw",
    });

    const res2 = await finishAccount({
      username: "alice",
      password: "longenoughpw",
    });
    expect(res2.ok).toBe(true);

    // No duplicate user, no extra rows
    const all = await state.db!.select().from(users).where(eq(users.id, userId));
    expect(all).toHaveLength(1);
  });

  test("rejects a username taken by someone else", async () => {
    // Seed another user with the chosen username
    await state.db!.insert(users).values({
      id: nanoid(16),
      username: "taken",
      passwordHash: "$2a$10$some-fake-hash-here",
    });

    await seedLegacyUser();
    const res = await finishAccount({
      username: "taken",
      password: "longenoughpw",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.field).toBe("username");
    expect(res.message).toMatch(/already taken/i);
  });

  test("rejects an invalid username", async () => {
    await seedLegacyUser();
    const res = await finishAccount({
      username: "!!",
      password: "longenoughpw",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.field).toBe("username");
  });

  test("rejects a weak password", async () => {
    await seedLegacyUser();
    const res = await finishAccount({
      username: "alice",
      password: "short",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.field).toBe("password");
  });

  test("preserves a pre-existing recoveryEmail over the email column", async () => {
    const userId = await seedLegacyUser({
      email: "old@example.com",
      recoveryEmail: "preferred@example.com",
      recoveryEmailVerified: new Date("2026-01-01"),
    });

    await finishAccount({ username: "alice", password: "longenoughpw" });

    const row = (
      await state.db!.select().from(users).where(eq(users.id, userId))
    )[0]!;
    expect(row.recoveryEmail).toBe("preferred@example.com");
    expect(row.recoveryEmailVerified?.toISOString()).toBe(
      new Date("2026-01-01").toISOString(),
    );
    expect(row.email).toBeNull();
  });
});
