/**
 * Subscription-paywall admin comp mechanism (fix 5, Ross's review pass) —
 * grantCompAccess / revokeCompAccess. Runs against a real in-memory libsql
 * DB with all migrations applied. Mirrors the admin-gate test pattern in
 * gallerySubmissions.test.ts (MM_ADMIN_EMAILS allowlist + verified email).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { users } from "@/db/schema";
import { getPlanForUser } from "@/lib/billing/plans";

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

const { grantCompAccess, revokeCompAccess } = await import("@/lib/actions/adminComp");
const { listCompedUsers } = await import("@/db/queries/users");

const ADMIN_EMAIL = "admin-comp@example.com";

async function seedAdmin(): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(users).values({
    id,
    email: ADMIN_EMAIL,
    username: `admin_${id.slice(0, 6)}`,
    name: "Admin",
    plan: "pro_lifetime",
    // E3: admin requires a VERIFIED email.
    emailVerified: new Date(),
  });
  return id;
}

async function seedTarget(username: string, plan = "free"): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(users).values({
    id,
    username,
    email: `${username}@example.com`,
    name: username,
    plan,
  });
  return id;
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  process.env.MM_ADMIN_EMAILS = ADMIN_EMAIL;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
  delete process.env.MM_ADMIN_EMAILS;
});

describe("grantCompAccess", () => {
  test("an admin can grant comp access by username", async () => {
    const targetId = await seedTarget("painter1");
    const adminId = await seedAdmin();
    state.userId = adminId;

    const res = await grantCompAccess({ username: "painter1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.id).toBe(targetId);
    expect(res.data.compGrantedAt).not.toBeNull();

    const [row] = await state.db!.select().from(users).where(eq(users.id, targetId));
    expect(row?.freeForeverGrantedAt).not.toBeNull();
    // The whole point — a comped account resolves as a subscriber (pro),
    // even though its `plan` column is still "free".
    expect(row?.plan).toBe("free");
    expect(getPlanForUser(row!)).toBe("pro_lifetime");
  });

  test("granting twice just refreshes the timestamp (idempotent)", async () => {
    await seedTarget("painter2");
    const adminId = await seedAdmin();
    state.userId = adminId;

    const first = await grantCompAccess({ username: "painter2" });
    const second = await grantCompAccess({ username: "painter2" });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  test("unknown username is refused with a clear error", async () => {
    const adminId = await seedAdmin();
    state.userId = adminId;
    const res = await grantCompAccess({ username: "does-not-exist" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no account found/i);
  });

  test("a NON-ADMIN cannot grant comp access", async () => {
    await seedTarget("painter3");
    // state.userId is still the original (non-admin) seeded test user.
    const res = await grantCompAccess({ username: "painter3" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not authorized/i);

    const rows = await state.db!.select().from(users).where(eq(users.username, "painter3"));
    expect(rows[0]?.freeForeverGrantedAt).toBeNull();
  });

  test("an admin allowlist email that is NOT verified cannot grant", async () => {
    await seedTarget("painter4");
    const id = nanoid(16);
    await state.db!.insert(users).values({
      id,
      email: ADMIN_EMAIL,
      username: `unverified_${id.slice(0, 6)}`,
      plan: "free",
      emailVerified: null,
    });
    state.userId = id;
    const res = await grantCompAccess({ username: "painter4" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not authorized/i);
  });
});

describe("revokeCompAccess", () => {
  test("an admin can revoke comp access", async () => {
    const targetId = await seedTarget("painter5");
    await state.db!
      .update(users)
      .set({ freeForeverGrantedAt: new Date() })
      .where(eq(users.id, targetId));

    const adminId = await seedAdmin();
    state.userId = adminId;
    const res = await revokeCompAccess({ username: "painter5" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.compGrantedAt).toBeNull();

    const [row] = await state.db!.select().from(users).where(eq(users.id, targetId));
    expect(row?.freeForeverGrantedAt).toBeNull();
    expect(getPlanForUser(row!)).toBe("free");
  });

  test("revoking a never-comped account is a harmless no-op", async () => {
    await seedTarget("painter6");
    const adminId = await seedAdmin();
    state.userId = adminId;
    const res = await revokeCompAccess({ username: "painter6" });
    expect(res.ok).toBe(true);
  });

  test("a NON-ADMIN cannot revoke comp access", async () => {
    const targetId = await seedTarget("painter7");
    await state.db!
      .update(users)
      .set({ freeForeverGrantedAt: new Date() })
      .where(eq(users.id, targetId));

    // state.userId is still the original (non-admin) seeded test user.
    const res = await revokeCompAccess({ username: "painter7" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not authorized/i);

    const rows = await state.db!.select().from(users).where(eq(users.id, targetId));
    expect(rows[0]?.freeForeverGrantedAt).not.toBeNull();
  });
});

describe("listCompedUsers", () => {
  test("lists granted accounts and drops them again after revoke", async () => {
    await seedTarget("painter8");
    await seedTarget("painter9");
    const adminId = await seedAdmin();
    state.userId = adminId;

    expect(await listCompedUsers()).toHaveLength(0);

    await grantCompAccess({ username: "painter8" });
    await grantCompAccess({ username: "painter9" });
    const comped = await listCompedUsers();
    expect(comped.map((c) => c.username).sort()).toEqual(["painter8", "painter9"]);

    await revokeCompAccess({ username: "painter8" });
    const afterRevoke = await listCompedUsers();
    expect(afterRevoke.map((c) => c.username)).toEqual(["painter9"]);
  });
});
