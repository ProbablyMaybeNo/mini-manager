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
// Mutable request-headers stub so tests can set x-forwarded-for for the
// signup IP rate-limit path (E7). Default is empty ⇒ no IP ⇒ limit skipped.
const headerStore = vi.hoisted(() => ({ current: new Headers() }));
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
  headers: async () => headerStore.current,
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
  headerStore.current = new Headers();
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

  describe("IP signup rate limit (E7)", () => {
    afterEach(() => {
      delete process.env.MM_SIGNUP_DAILY_LIMIT;
    });

    test("refuses the N+1th signup from the same IP in a day", async () => {
      process.env.MM_SIGNUP_DAILY_LIMIT = "2";
      headerStore.current = new Headers({ "x-forwarded-for": "203.0.113.7" });

      const a = await signUpWithCredentials({
        username: "ipuser1",
        password: "hunter222",
        email: "ipuser1@test.dev",
      });
      const b = await signUpWithCredentials({
        username: "ipuser2",
        password: "hunter222",
        email: "ipuser2@test.dev",
      });
      const c = await signUpWithCredentials({
        username: "ipuser3",
        password: "hunter222",
        email: "ipuser3@test.dev",
      });

      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      expect(c.ok).toBe(false);
      if (c.ok) return;
      expect(c.field).toBe("form");
      expect(c.message).toMatch(/too many sign-ups/i);

      // The blocked attempt created no account.
      const rows = await state
        .db!.select()
        .from(users)
        .where(eq(users.username, "ipuser3"));
      expect(rows).toHaveLength(0);
    });

    test("a different IP is metered separately", async () => {
      process.env.MM_SIGNUP_DAILY_LIMIT = "1";
      headerStore.current = new Headers({ "x-forwarded-for": "198.51.100.1" });
      const first = await signUpWithCredentials({
        username: "netauser",
        password: "hunter222",
        email: "netauser@test.dev",
      });
      expect(first.ok).toBe(true);

      // Same network, second signup ⇒ blocked.
      const blocked = await signUpWithCredentials({
        username: "netauser2",
        password: "hunter222",
        email: "netauser2@test.dev",
      });
      expect(blocked.ok).toBe(false);

      // A different IP still gets its own allowance.
      headerStore.current = new Headers({ "x-forwarded-for": "198.51.100.2" });
      const other = await signUpWithCredentials({
        username: "netbuser",
        password: "hunter222",
        email: "netbuser@test.dev",
      });
      expect(other.ok).toBe(true);
    });
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

  /**
   * R2-18. Moderate severity and the reasons matter: bcrypt at cost 10 is a
   * real natural throttle and there is no enumeration oracle to protect.
   * What is left is credential stuffing (one request per known pair, which
   * the hash cost does nothing about) and the billed invocation behind every
   * attempt.
   */
  describe("attempt limiting (R2-18)", () => {
    afterEach(() => {
      delete process.env.MM_SIGNIN_BURST_LIMIT;
      delete process.env.MM_SIGNIN_HOURLY_LIMIT;
    });

    async function seedAlice(): Promise<void> {
      await signUpWithCredentials({
        username: "alice42",
        password: "hunter222",
        email: "alice42@test.dev",
      });
      cookieStore.store.clear();
    }

    test("repeated failures for one username start being refused", async () => {
      process.env.MM_SIGNIN_BURST_LIMIT = "3";
      headerStore.current = new Headers({ "x-forwarded-for": "203.0.113.9" });
      await seedAlice();

      for (let i = 0; i < 3; i++) {
        const res = await signInWithCredentials({
          username: "alice42",
          password: "wrong-password",
        });
        expect(res.ok).toBe(false);
      }

      // Over the cap now — and even the RIGHT password is refused, which is
      // the point: the attacker cannot keep testing pairs.
      const blocked = await signInWithCredentials({
        username: "alice42",
        password: "hunter222",
      });
      expect(blocked.ok).toBe(false);
      if (blocked.ok) return;
      // The refusal is the SAME generic string as a wrong password. A
      // distinct "too many attempts" would tell a stuffing run when to
      // rotate hosts, and is the one thing this path has never leaked.
      expect(blocked.message).toBe("Wrong username or password");
      expect(cookieStore.get(SESSION_COOKIE)?.value).toBeFalsy();
    });

    test("the correct password still succeeds immediately from a clean IP", async () => {
      process.env.MM_SIGNIN_BURST_LIMIT = "2";
      headerStore.current = new Headers({ "x-forwarded-for": "203.0.113.9" });
      await seedAlice();

      // Attacker burns the budget for their own host.
      await signInWithCredentials({ username: "alice42", password: "nope1" });
      await signInWithCredentials({ username: "alice42", password: "nope2" });
      const attacker = await signInWithCredentials({
        username: "alice42",
        password: "hunter222",
      });
      expect(attacker.ok).toBe(false);

      // The real owner, elsewhere, is unaffected — an attacker must not be
      // able to lock someone out of their own account by failing for them.
      headerStore.current = new Headers({ "x-forwarded-for": "198.51.100.44" });
      const owner = await signInWithCredentials({
        username: "alice42",
        password: "hunter222",
      });
      expect(owner.ok).toBe(true);
      expect(cookieStore.get(SESSION_COOKIE)?.value).toBeTruthy();
    });

    test("a user sharing an IP with a failing one is not locked out", async () => {
      process.env.MM_SIGNIN_BURST_LIMIT = "2";
      // One office / CGNAT address for everybody.
      headerStore.current = new Headers({ "x-forwarded-for": "198.51.100.7" });
      await seedAlice();
      await signUpWithCredentials({
        username: "bob77",
        password: "hunter333",
        email: "bob77@test.dev",
      });
      cookieStore.store.clear();

      // alice42 is being hammered from this address.
      await signInWithCredentials({ username: "alice42", password: "nope1" });
      await signInWithCredentials({ username: "alice42", password: "nope2" });
      const aliceBlocked = await signInWithCredentials({
        username: "alice42",
        password: "hunter222",
      });
      expect(aliceBlocked.ok).toBe(false);

      // bob77 shares the IP and is completely unaffected — and would not be
      // for the rest of the UTC day either, which is what reusing the daily
      // signup limiter here would have meant.
      const bob = await signInWithCredentials({
        username: "bob77",
        password: "hunter333",
      });
      expect(bob.ok).toBe(true);
    });

    test("a successful sign-in clears the tally", async () => {
      process.env.MM_SIGNIN_BURST_LIMIT = "3";
      headerStore.current = new Headers({ "x-forwarded-for": "203.0.113.11" });
      await seedAlice();

      // Two typos, then the real password — the successes must not count.
      await signInWithCredentials({ username: "alice42", password: "typo1" });
      await signInWithCredentials({ username: "alice42", password: "typo2" });
      expect(
        (await signInWithCredentials({ username: "alice42", password: "hunter222" }))
          .ok,
      ).toBe(true);

      // Budget is back to full: three more attempts are available.
      for (let i = 0; i < 3; i++) {
        await signInWithCredentials({ username: "alice42", password: "typo" });
      }
      const stillWorks = await signInWithCredentials({
        username: "alice42",
        password: "hunter222",
      });
      // The 4th attempt in this fresh window is the one over the cap, so the
      // tally clearly restarted rather than carrying the earlier failures.
      expect(stillWorks.ok).toBe(false);
    });

    test("the sustained tier keeps biting after the burst tier refills", async () => {
      process.env.MM_SIGNIN_BURST_LIMIT = "1000";
      process.env.MM_SIGNIN_HOURLY_LIMIT = "3";
      headerStore.current = new Headers({ "x-forwarded-for": "203.0.113.12" });
      await seedAlice();

      for (let i = 0; i < 3; i++) {
        await signInWithCredentials({ username: "alice42", password: "nope" });
      }
      const blocked = await signInWithCredentials({
        username: "alice42",
        password: "hunter222",
      });
      expect(blocked.ok).toBe(false);
    });

    test("without proxy headers the limiter still applies", async () => {
      process.env.MM_SIGNIN_BURST_LIMIT = "2";
      headerStore.current = new Headers();
      await seedAlice();

      await signInWithCredentials({ username: "alice42", password: "nope1" });
      await signInWithCredentials({ username: "alice42", password: "nope2" });
      const blocked = await signInWithCredentials({
        username: "alice42",
        password: "hunter222",
      });
      // Unlike the signup limiter, an unknown IP does not mean unmetered —
      // there is still a username to key on, so abuse stays bounded.
      expect(blocked.ok).toBe(false);
    });
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
