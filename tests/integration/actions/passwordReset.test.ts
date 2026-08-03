import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { sessions, users, verificationTokens } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  mailLog: [] as Array<{ to: string; subject: string; text: string }>,
}));

const cookieStore = vi.hoisted(() => {
  const store = new Map<string, { value: string }>();
  return {
    store,
    get: (name: string) => {
      const e = store.get(name);
      return e ? { value: e.value } : undefined;
    },
    set: (name: string, value: string) => {
      store.set(name, { value });
    },
    delete: (name: string) => {
      store.delete(name);
    },
  };
});

vi.mock("@/db/client", () => ({
  get db() {
    if (!state.db) throw new Error("Test DB not initialised in beforeEach");
    return state.db;
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));
vi.mock("@/lib/auth/sendVerificationEmail", () => ({
  sendVerificationEmail: async (mail: {
    to: string;
    subject: string;
    text: string;
  }) => {
    state.mailLog.push(mail);
  },
}));

const { requestPasswordReset, applyPasswordReset } = await import(
  "@/lib/auth/passwordReset"
);

async function seedUser(opts: {
  username: string;
  password: string;
  email?: string | null;
  emailVerified?: boolean;
}): Promise<string> {
  const userId = nanoid(16);
  const hash = await hashPassword(opts.password);
  await state.db!.insert(users).values({
    id: userId,
    username: opts.username,
    passwordHash: hash,
    email: opts.email ?? null,
    emailVerified: opts.emailVerified ? new Date() : null,
  });
  return userId;
}

beforeEach(async () => {
  const { db } = await makeTestDb();
  state.db = db;
  state.mailLog = [];
  cookieStore.store.clear();
});

afterEach(() => {
  state.db = null;
});

describe("requestPasswordReset", () => {
  test("happy path — a normal signup email gets a token + mail", async () => {
    await seedUser({
      username: "alice",
      password: "oldpassword123",
      email: "alice@example.com",
    });

    const res = await requestPasswordReset({ username: "alice" });
    expect(res.ok).toBe(true);
    expect(state.mailLog).toHaveLength(1);
    expect(state.mailLog[0]!.to).toBe("alice@example.com");
    expect(state.mailLog[0]!.text).toContain("/sign-in/reset?token=");

    const tokens = await state
      .db!.select()
      .from(verificationTokens);
    expect(tokens).toHaveLength(1);
  });

  test("unverified signup email still gets a reset (no lockout)", async () => {
    await seedUser({
      username: "carol",
      password: "oldpassword123",
      email: "carol@example.com",
      emailVerified: false,
    });

    const res = await requestPasswordReset({ username: "carol" });
    expect(res.ok).toBe(true);
    expect(state.mailLog).toHaveLength(1);
    expect(state.mailLog[0]!.to).toBe("carol@example.com");
  });

  test("unknown username returns ok + no mail (enumeration safety)", async () => {
    const res = await requestPasswordReset({ username: "ghostuser" });
    expect(res.ok).toBe(true);
    expect(state.mailLog).toHaveLength(0);
  });

  test("known username without an email on file returns ok + no mail", async () => {
    await seedUser({ username: "bob", password: "oldpassword123" });

    const res = await requestPasswordReset({ username: "bob" });
    expect(res.ok).toBe(true);
    expect(state.mailLog).toHaveLength(0);
  });

  test("malformed username returns ok silently", async () => {
    const res = await requestPasswordReset({ username: "!" });
    expect(res.ok).toBe(true);
    expect(state.mailLog).toHaveLength(0);
  });

  test("re-issuing replaces the prior token", async () => {
    await seedUser({
      username: "alice",
      password: "oldpassword123",
      email: "alice@example.com",
    });

    await requestPasswordReset({ username: "alice" });
    await requestPasswordReset({ username: "alice" });

    const tokens = await state
      .db!.select()
      .from(verificationTokens);
    expect(tokens).toHaveLength(1);
    expect(state.mailLog).toHaveLength(2);
  });
});

/**
 * R2-19 — the request path is unauthenticated and sends mail, and every
 * successful call deletes the previous token. Unthrottled that is denial of
 * account recovery: hammer a victim's username and the link they are trying
 * to click is destroyed under them, indefinitely.
 */
describe("requestPasswordReset — R2-19 throttle", () => {
  afterEach(() => {
    delete process.env.MM_RESET_WINDOW_LIMIT;
  });

  test("suppresses the N+1th request for one username — still silent ok:true", async () => {
    process.env.MM_RESET_WINDOW_LIMIT = "2";
    await seedUser({
      username: "alice",
      password: "oldpassword123",
      email: "alice@example.com",
    });

    const first = await requestPasswordReset({ username: "alice" });
    const second = await requestPasswordReset({ username: "alice" });
    const third = await requestPasswordReset({ username: "alice" });

    // The throttled call is INDISTINGUISHABLE from the allowed ones: same
    // shape, same ok:true, no "too many requests" copy. Anything else here
    // is the username-enumeration oracle the silent-ok design exists to
    // deny — a probe would learn which usernames are worth throttling.
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(third).toEqual({ ok: true });
    expect(state.mailLog).toHaveLength(2);
  });

  test("a suppressed request does NOT destroy the reset already in flight", async () => {
    process.env.MM_RESET_WINDOW_LIMIT = "1";
    await seedUser({
      username: "alice",
      password: "oldpassword123",
      email: "alice@example.com",
    });

    // The victim's own request lands and they are holding this link.
    await requestPasswordReset({ username: "alice" });
    const issued = (await state.db!.select().from(verificationTokens))[0]!;

    // The attacker keeps hammering the same username.
    await requestPasswordReset({ username: "alice" });
    await requestPasswordReset({ username: "alice" });
    await requestPasswordReset({ username: "alice" });

    const after = await state.db!.select().from(verificationTokens);
    expect(after).toHaveLength(1);
    // Same token — the victim's link still works.
    expect(after[0]!.token).toBe(issued.token);
    expect(state.mailLog).toHaveLength(1);

    // And it is genuinely still usable, not merely still present.
    const applied = await applyPasswordReset({
      token: issued.token,
      password: "freshpassword456",
    });
    expect(applied.ok).toBe(true);
  });

  test("throttling one username does not touch another user's reset", async () => {
    process.env.MM_RESET_WINDOW_LIMIT = "1";
    await seedUser({
      username: "alice",
      password: "oldpassword123",
      email: "alice@example.com",
    });
    await seedUser({
      username: "bob",
      password: "oldpassword123",
      email: "bob@example.com",
    });

    await requestPasswordReset({ username: "alice" });
    await requestPasswordReset({ username: "alice" });
    const bob = await requestPasswordReset({ username: "bob" });

    expect(bob).toEqual({ ok: true });
    expect(state.mailLog.map((m) => m.to)).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
  });

  test("casing and padding cannot mint a fresh allowance for the same target", async () => {
    process.env.MM_RESET_WINDOW_LIMIT = "1";
    await seedUser({
      username: "alice",
      password: "oldpassword123",
      email: "alice@example.com",
    });

    await requestPasswordReset({ username: "alice" });
    await requestPasswordReset({ username: "  ALICE  " });
    await requestPasswordReset({ username: "Alice" });

    expect(state.mailLog).toHaveLength(1);
  });

  test("throttling an unknown username stays silent too", async () => {
    process.env.MM_RESET_WINDOW_LIMIT = "1";
    const first = await requestPasswordReset({ username: "ghostuser" });
    const second = await requestPasswordReset({ username: "ghostuser" });

    // A real account and a nonexistent one answer identically whether or
    // not the throttle has engaged.
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(state.mailLog).toHaveLength(0);
  });
});

describe("applyPasswordReset", () => {
  async function setupTokenFor(username: string): Promise<string> {
    await seedUser({
      username,
      password: "oldpassword123",
      email: `${username}@example.com`,
    });
    await requestPasswordReset({ username });
    const token = state.mailLog[0]!.text.match(/token=([^\s]+)/)![1]!;
    state.mailLog = [];
    return token;
  }

  test("updates the hash + consumes the token + mints a session", async () => {
    const token = await setupTokenFor("alice");

    const res = await applyPasswordReset({
      token,
      password: "freshpassword456",
    });
    expect(res.ok).toBe(true);

    // Old password must no longer verify
    const { verifyPassword } = await import("@/lib/auth/password");
    const userRow = (
      await state.db!.select().from(users).where(eq(users.username, "alice"))
    )[0]!;
    expect(await verifyPassword("oldpassword123", userRow.passwordHash!)).toBe(
      false,
    );
    expect(await verifyPassword("freshpassword456", userRow.passwordHash!)).toBe(
      true,
    );

    // Token consumed
    const tokens = await state
      .db!.select()
      .from(verificationTokens);
    expect(tokens).toHaveLength(0);

    // Session cookie minted
    expect(cookieStore.get("authjs.session-token")?.value).toBeTruthy();
  });

  test("rejects an unknown token", async () => {
    const res = await applyPasswordReset({
      token: "no-such-token",
      password: "freshpassword456",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).toMatch(/invalid or expired/i);
  });

  test("expired token returns ok:false and cleans up", async () => {
    const token = await setupTokenFor("alice");
    // Backdate
    await state
      .db!.update(verificationTokens)
      .set({ expires: new Date(Date.now() - 60_000) })
      .where(eq(verificationTokens.token, token));

    const res = await applyPasswordReset({
      token,
      password: "freshpassword456",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).toMatch(/expired/i);

    // Cleaned up
    const tokens = await state
      .db!.select()
      .from(verificationTokens);
    expect(tokens).toHaveLength(0);
  });

  test("rejects a weak new password", async () => {
    const token = await setupTokenFor("alice");

    const res = await applyPasswordReset({ token, password: "short" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).toMatch(/at least|short|8/i);

    // Token survives so the user can retry
    const tokens = await state
      .db!.select()
      .from(verificationTokens);
    expect(tokens).toHaveLength(1);
  });

  test("revokes all pre-existing sessions on reset", async () => {
    const token = await setupTokenFor("alice");
    const alice = (
      await state.db!.select().from(users).where(eq(users.username, "alice"))
    )[0]!;
    // A second, pre-existing session — e.g. an attacker's stolen cookie.
    await state.db!.insert(sessions).values({
      sessionToken: "stolen-session-token",
      userId: alice.id,
      expires: new Date(Date.now() + 60 * 60 * 1000),
    });

    const res = await applyPasswordReset({
      token,
      password: "freshpassword456",
    });
    expect(res.ok).toBe(true);

    const rows = await state
      .db!.select()
      .from(sessions)
      .where(eq(sessions.userId, alice.id));
    // The stolen session is gone; exactly the freshly-minted one remains.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sessionToken).not.toBe("stolen-session-token");
  });
});
