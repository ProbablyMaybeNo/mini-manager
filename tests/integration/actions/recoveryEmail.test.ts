import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { users, verificationTokens } from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: "" as string,
  mailLog: [] as Array<{ to: string; subject: string; text: string }>,
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
vi.mock("@/lib/auth/sendVerificationEmail", () => ({
  sendVerificationEmail: async (mail: {
    to: string;
    subject: string;
    text: string;
  }) => {
    state.mailLog.push(mail);
  },
}));

const {
  setRecoveryEmail,
  resendRecoveryEmailVerification,
  removeRecoveryEmail,
  verifyRecoveryEmailToken,
} = await import("@/lib/auth/recoveryEmail");
const { tokenIdentifier, RECOVERY_EMAIL_TOKEN_SCOPE } = await import(
  "@/lib/auth/tokens"
);

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  state.mailLog = [];
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("setRecoveryEmail", () => {
  test("stores the email unverified + emits a verification token", async () => {
    const res = await setRecoveryEmail({ email: "  TEST@example.com  " });
    expect(res.ok).toBe(true);

    const userRow = (
      await state.db!.select().from(users).where(eq(users.id, state.userId))
    )[0]!;
    expect(userRow.recoveryEmail).toBe("test@example.com");
    expect(userRow.recoveryEmailVerified).toBeNull();

    const tokens = await state
      .db!.select()
      .from(verificationTokens)
      .where(
        eq(
          verificationTokens.identifier,
          tokenIdentifier(RECOVERY_EMAIL_TOKEN_SCOPE, state.userId),
        ),
      );
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.token).toMatch(/^[A-Za-z0-9_-]{40}$/);
    expect(tokens[0]!.expires.getTime()).toBeGreaterThan(Date.now());

    expect(state.mailLog).toHaveLength(1);
    expect(state.mailLog[0]!.to).toBe("test@example.com");
    expect(state.mailLog[0]!.text).toContain("token=");
  });

  test("rejects an invalid email format", async () => {
    const res = await setRecoveryEmail({ email: "not-an-email" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).toMatch(/valid email/i);
  });

  test("replacing the email drops the old token", async () => {
    await setRecoveryEmail({ email: "first@example.com" });
    await setRecoveryEmail({ email: "second@example.com" });

    const tokens = await state
      .db!.select()
      .from(verificationTokens)
      .where(
        eq(
          verificationTokens.identifier,
          tokenIdentifier(RECOVERY_EMAIL_TOKEN_SCOPE, state.userId),
        ),
      );
    // Single pending token at any time
    expect(tokens).toHaveLength(1);
    expect(state.mailLog).toHaveLength(2);
  });
});

describe("verifyRecoveryEmailToken (happy path)", () => {
  test("add → pending → click link → verified", async () => {
    await setRecoveryEmail({ email: "alice@example.com" });
    const token = state.mailLog[0]!.text.match(/token=([^\s]+)/)![1]!;

    const res = await verifyRecoveryEmailToken({ token });
    expect(res.ok).toBe(true);

    const userRow = (
      await state.db!.select().from(users).where(eq(users.id, state.userId))
    )[0]!;
    expect(userRow.recoveryEmailVerified).toBeInstanceOf(Date);

    // Token consumed
    const tokens = await state
      .db!.select()
      .from(verificationTokens)
      .where(
        eq(
          verificationTokens.identifier,
          tokenIdentifier(RECOVERY_EMAIL_TOKEN_SCOPE, state.userId),
        ),
      );
    expect(tokens).toHaveLength(0);
  });

  test("rejects an unknown token silently", async () => {
    const res = await verifyRecoveryEmailToken({
      token: "made-up-token-string",
    });
    expect(res.ok).toBe(false);
  });

  test("expired token returns ok:false and is cleaned up", async () => {
    await setRecoveryEmail({ email: "alice@example.com" });
    const token = state.mailLog[0]!.text.match(/token=([^\s]+)/)![1]!;

    // Backdate the token row
    await state
      .db!.update(verificationTokens)
      .set({ expires: new Date(Date.now() - 60_000) })
      .where(eq(verificationTokens.token, token));

    const res = await verifyRecoveryEmailToken({ token });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).toMatch(/expired/i);

    // Cleaned up
    const tokens = await state
      .db!.select()
      .from(verificationTokens);
    expect(tokens).toHaveLength(0);
  });
});

describe("resendRecoveryEmailVerification", () => {
  test("re-issues a token for an existing pending address", async () => {
    await setRecoveryEmail({ email: "alice@example.com" });
    state.mailLog = [];

    const res = await resendRecoveryEmailVerification();
    expect(res.ok).toBe(true);
    expect(state.mailLog).toHaveLength(1);
  });

  test("no-op + ok:false when no recovery email is on file", async () => {
    const res = await resendRecoveryEmailVerification();
    expect(res.ok).toBe(false);
  });
});

describe("removeRecoveryEmail", () => {
  test("clears the email + drops outstanding tokens", async () => {
    await setRecoveryEmail({ email: "alice@example.com" });
    await removeRecoveryEmail();

    const userRow = (
      await state.db!.select().from(users).where(eq(users.id, state.userId))
    )[0]!;
    expect(userRow.recoveryEmail).toBeNull();
    expect(userRow.recoveryEmailVerified).toBeNull();

    const tokens = await state
      .db!.select()
      .from(verificationTokens);
    expect(tokens).toHaveLength(0);
  });
});
