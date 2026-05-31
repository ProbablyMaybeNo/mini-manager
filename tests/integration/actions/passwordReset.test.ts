import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { users, verificationTokens } from "@/db/schema";
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
  recoveryEmail?: string | null;
  recoveryEmailVerified?: boolean;
}): Promise<string> {
  const userId = nanoid(16);
  const hash = await hashPassword(opts.password);
  await state.db!.insert(users).values({
    id: userId,
    username: opts.username,
    passwordHash: hash,
    recoveryEmail: opts.recoveryEmail ?? null,
    recoveryEmailVerified:
      opts.recoveryEmailVerified ? new Date() : null,
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
  test("happy path — verified recovery email gets a token + mail", async () => {
    await seedUser({
      username: "alice",
      password: "oldpassword123",
      recoveryEmail: "alice@example.com",
      recoveryEmailVerified: true,
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

  test("unknown username returns ok + no mail (enumeration safety)", async () => {
    const res = await requestPasswordReset({ username: "ghostuser" });
    expect(res.ok).toBe(true);
    expect(state.mailLog).toHaveLength(0);
  });

  test("known username without recovery email returns ok + no mail", async () => {
    await seedUser({ username: "bob", password: "oldpassword123" });

    const res = await requestPasswordReset({ username: "bob" });
    expect(res.ok).toBe(true);
    expect(state.mailLog).toHaveLength(0);
  });

  test("known username with unverified recovery email returns ok + no mail", async () => {
    await seedUser({
      username: "carol",
      password: "oldpassword123",
      recoveryEmail: "carol@example.com",
      recoveryEmailVerified: false,
    });

    const res = await requestPasswordReset({ username: "carol" });
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
      recoveryEmail: "alice@example.com",
      recoveryEmailVerified: true,
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

describe("applyPasswordReset", () => {
  async function setupTokenFor(username: string): Promise<string> {
    await seedUser({
      username,
      password: "oldpassword123",
      recoveryEmail: `${username}@example.com`,
      recoveryEmailVerified: true,
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
});
