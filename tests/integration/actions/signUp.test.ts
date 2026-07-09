import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { users } from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
}));

vi.mock("@/db/client", () => ({
  get db() {
    if (!state.db) throw new Error("Test DB not initialised in beforeEach");
    return state.db;
  },
}));

// Stub next/headers cookies() — createSession() writes a cookie, which
// throws outside a request scope in real Next runtime. We capture the
// set calls so a couple of assertions can verify the cookie name without
// needing a full request.
const cookieStore = vi.hoisted(() => {
  const store = new Map<string, { value: string; options?: unknown }>();
  return {
    store,
    get: (name: string) => {
      const entry = store.get(name);
      return entry ? { value: entry.value } : undefined;
    },
    set: (name: string, value: string, options?: unknown) => {
      store.set(name, { value, options });
    },
    delete: (name: string) => {
      store.delete(name);
    },
  };
});
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

const { signUpWithCredentials, signInWithCredentials } = await import(
  "@/lib/auth/signUp"
);
const { SESSION_COOKIE } = await import("@/lib/auth/session");
const { ACQUISITION_COOKIE } = await import("@/lib/acquisition");

beforeEach(async () => {
  const { db } = await makeTestDb();
  state.db = db;
  cookieStore.store.clear();
});

afterEach(() => {
  state.db = null;
});

describe("signUpWithCredentials", () => {
  test("creates a user row + writes the session cookie", async () => {
    const res = await signUpWithCredentials({
      username: "alice42",
      password: "hunter222",
      email: "alice42@test.dev",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const rows = await state
      .db!.select()
      .from(users)
      .where(eq(users.id, res.userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.username).toBe("alice42");
    expect(rows[0]!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(rows[0]!.plan).toBe("free");
    expect(rows[0]!.email).toBe("alice42@test.dev");

    // Cookie has been set under the NextAuth name.
    expect(cookieStore.get(SESSION_COOKIE)?.value).toBeTruthy();
  });

  test("normalises username to lowercase before insert", async () => {
    const res = await signUpWithCredentials({
      username: "  ALICE42  ",
      password: "hunter222",
      email: "alice-caps@test.dev",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.username).toBe("alice42");

    const rows = await state
      .db!.select()
      .from(users)
      .where(eq(users.id, res.userId));
    expect(rows[0]!.username).toBe("alice42");
  });

  test("rejects a duplicate username (case-insensitive)", async () => {
    await signUpWithCredentials({
      username: "alice42",
      password: "hunter222",
      email: "alice42@test.dev",
    });
    cookieStore.store.clear();

    const dup = await signUpWithCredentials({
      username: "Alice42",
      password: "different-pw",
      email: "alice-dup@test.dev",
    });
    expect(dup.ok).toBe(false);
    if (dup.ok) return;
    expect(dup.field).toBe("username");
    expect(dup.message).toMatch(/already taken/i);
  });

  test("rejects a weak password", async () => {
    const res = await signUpWithCredentials({
      username: "bob",
      password: "short",
      email: "bob@test.dev",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.field).toBe("password");
  });

  test("rejects a reserved username", async () => {
    const res = await signUpWithCredentials({
      username: "admin",
      password: "longenoughpw",
      email: "admin@test.dev",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.field).toBe("username");
    expect(res.message).toMatch(/reserved/i);
  });

  test("rejects invalid characters in username", async () => {
    const res = await signUpWithCredentials({
      username: "alice.42",
      password: "longenoughpw",
      email: "alice-dot@test.dev",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.field).toBe("username");
  });

  test("stamps acquisitionRef onto the new user when mm_ref cookie is set", async () => {
    cookieStore.store.set(ACQUISITION_COOKIE, {
      value: JSON.stringify({ ref: "reddit-minipainting-0709" }),
    });

    const res = await signUpWithCredentials({
      username: "trackedsam",
      password: "hunter222",
      email: "trackedsam@test.dev",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const rows = await state
      .db!.select()
      .from(users)
      .where(eq(users.id, res.userId));
    expect(rows[0]!.acquisitionRef).toBe(
      JSON.stringify({ ref: "reddit-minipainting-0709" }),
    );
  });

  test("leaves acquisitionRef null when no mm_ref cookie is present", async () => {
    cookieStore.store.delete(ACQUISITION_COOKIE);

    const res = await signUpWithCredentials({
      username: "organicsam",
      password: "hunter222",
      email: "organicsam@test.dev",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const rows = await state
      .db!.select()
      .from(users)
      .where(eq(users.id, res.userId));
    expect(rows[0]!.acquisitionRef).toBeNull();
  });
});

describe("signInWithCredentials", () => {
  test("verifies correct password + mints a session", async () => {
    await signUpWithCredentials({
      username: "alice42",
      password: "hunter222",
      email: "alice42@test.dev",
    });
    cookieStore.store.clear();

    const res = await signInWithCredentials({
      username: "alice42",
      password: "hunter222",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.username).toBe("alice42");
    expect(cookieStore.get(SESSION_COOKIE)?.value).toBeTruthy();
  });

  test("accepts username casing variations", async () => {
    await signUpWithCredentials({
      username: "alice42",
      password: "hunter222",
      email: "alice42@test.dev",
    });

    const res = await signInWithCredentials({
      username: "  ALICE42  ",
      password: "hunter222",
    });
    expect(res.ok).toBe(true);
  });

  test("rejects wrong password with a generic message", async () => {
    await signUpWithCredentials({
      username: "alice42",
      password: "hunter222",
      email: "alice42@test.dev",
    });

    const res = await signInWithCredentials({
      username: "alice42",
      password: "wrong-password",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).toMatch(/wrong username or password/i);
  });

  test("rejects unknown username with the same generic message", async () => {
    const res = await signInWithCredentials({
      username: "nosuchuser",
      password: "anythinglong",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).toMatch(/wrong username or password/i);
  });

  test("rejects sign-in for accounts with no passwordHash (legacy magic-link)", async () => {
    // Seed a legacy magic-link user (email + no passwordHash) — these
    // accounts must NOT be sign-inable via credentials until they
    // complete the P9.7 migration shim.
    const userId = nanoid(16);
    await state.db!.insert(users).values({
      id: userId,
      username: "legacy",
      email: "legacy@example.com",
    });

    const res = await signInWithCredentials({
      username: "legacy",
      password: "anythinglong",
    });
    expect(res.ok).toBe(false);
  });
});
