import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

/**
 * P12.18 — Change-password server action.
 *
 * Verifies the current password, validates the new one against the
 * locked strength rules, rejects no-op changes, and writes the new
 * hash. All paths return inline result objects (no redirects).
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

const { changePasswordAction } = await import(
  "@/lib/actions/changePassword"
);

async function seedUserWithPassword(plain: string): Promise<void> {
  const hash = await hashPassword(plain);
  await state.db!
    .update(users)
    .set({ passwordHash: hash, username: "tester" })
    .where(eq(users.id, state.userId));
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

describe("changePasswordAction — happy path", () => {
  test("verifies the current password + writes the new hash", async () => {
    await seedUserWithPassword("oldpassword1");

    const result = await changePasswordAction({
      currentPassword: "oldpassword1",
      newPassword: "newpassword2",
      confirmPassword: "newpassword2",
    });
    expect(result.ok).toBe(true);

    const [row] = await state.db!
      .select({ hash: users.passwordHash })
      .from(users)
      .where(eq(users.id, state.userId));
    expect(row?.hash).not.toBeNull();
    // Old password no longer works; new one does.
    const oldOk = await verifyPassword("oldpassword1", row?.hash ?? "");
    const newOk = await verifyPassword("newpassword2", row?.hash ?? "");
    expect(oldOk).toBe(false);
    expect(newOk).toBe(true);
  });
});

describe("changePasswordAction — validation", () => {
  test("rejects when confirmation doesn't match", async () => {
    await seedUserWithPassword("oldpassword1");
    const result = await changePasswordAction({
      currentPassword: "oldpassword1",
      newPassword: "newpassword2",
      confirmPassword: "different",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/don't match/);
  });

  test("rejects when current password is wrong", async () => {
    await seedUserWithPassword("oldpassword1");
    const result = await changePasswordAction({
      currentPassword: "wrongpassword",
      newPassword: "newpassword2",
      confirmPassword: "newpassword2",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/incorrect/);
  });

  test("rejects when new password is too short", async () => {
    await seedUserWithPassword("oldpassword1");
    const result = await changePasswordAction({
      currentPassword: "oldpassword1",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/at least/);
  });

  test("rejects no-op changes (new == current)", async () => {
    await seedUserWithPassword("samepassword");
    const result = await changePasswordAction({
      currentPassword: "samepassword",
      newPassword: "samepassword",
      confirmPassword: "samepassword",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/different/);
  });

  test("rejects when user has no password set", async () => {
    // Default seeded user has passwordHash = null.
    const result = await changePasswordAction({
      currentPassword: "anything",
      newPassword: "newpassword2",
      confirmPassword: "newpassword2",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/no password set/);
  });

  test("empty current password fails validation", async () => {
    const result = await changePasswordAction({
      currentPassword: "",
      newPassword: "newpassword2",
      confirmPassword: "newpassword2",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/required/);
  });
});
