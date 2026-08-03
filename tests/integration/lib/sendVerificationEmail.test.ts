/**
 * R2-19 — the mail chokepoint backstop.
 *
 * `sendVerificationEmail` is the only module in `src/` that talks to a mail
 * provider, so the per-recipient cap it enforces is what stops a future email
 * feature shipping unthrottled by omission. These tests drive the REAL Resend
 * branch (key set, `fetch` stubbed) so the assertion is "the provider was not
 * called", not "a console line was not printed".
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

const { sendVerificationEmail } = await import(
  "@/lib/auth/sendVerificationEmail"
);

const sent = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

beforeEach(async () => {
  const { db } = await makeTestDb();
  state.db = db;
  sent.mockReset();
  sent.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", sent);
  process.env.AUTH_RESEND_KEY = "re_test_key";
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  state.db = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.AUTH_RESEND_KEY;
  delete process.env.MM_MAIL_WINDOW_LIMIT;
});

function mail(to: string) {
  return { to, subject: "Reset your Mini Mainframe password", text: "link" };
}

describe("sendVerificationEmail — per-recipient send budget", () => {
  test("sends up to the cap, then suppresses the provider call", async () => {
    process.env.MM_MAIL_WINDOW_LIMIT = "2";

    await sendVerificationEmail(mail("victim@example.com"));
    await sendVerificationEmail(mail("victim@example.com"));
    expect(sent).toHaveBeenCalledTimes(2);
    expect(sent.mock.calls[0]![0]).toBe("https://api.resend.com/emails");

    await sendVerificationEmail(mail("victim@example.com"));
    await sendVerificationEmail(mail("victim@example.com"));
    expect(sent).toHaveBeenCalledTimes(2);
  });

  test("suppression resolves rather than throwing — callers keep their contract", async () => {
    process.env.MM_MAIL_WINDOW_LIMIT = "1";
    await sendVerificationEmail(mail("victim@example.com"));

    // requestPasswordReset awaits this without a catch; a throw here would
    // turn its enumeration-safe ok:true into a visible server error.
    await expect(
      sendVerificationEmail(mail("victim@example.com")),
    ).resolves.toBeUndefined();
  });

  test("one flooded recipient does not block mail to anyone else", async () => {
    process.env.MM_MAIL_WINDOW_LIMIT = "1";

    await sendVerificationEmail(mail("victim@example.com"));
    await sendVerificationEmail(mail("victim@example.com"));
    expect(sent).toHaveBeenCalledTimes(1);

    await sendVerificationEmail(mail("someone-else@example.com"));
    expect(sent).toHaveBeenCalledTimes(2);
  });

  test("the budget key is normalised — re-casing the address does not reset it", async () => {
    process.env.MM_MAIL_WINDOW_LIMIT = "1";

    await sendVerificationEmail(mail("victim@example.com"));
    await sendVerificationEmail(mail("  Victim@Example.com  "));
    await sendVerificationEmail(mail("VICTIM@EXAMPLE.COM"));

    expect(sent).toHaveBeenCalledTimes(1);
  });

  test("the default cap leaves normal traffic alone", async () => {
    // One signup verification + one password reset for the same address in
    // the same quarter hour is ordinary behaviour, not abuse.
    await sendVerificationEmail(mail("normal@example.com"));
    await sendVerificationEmail(mail("normal@example.com"));
    expect(sent).toHaveBeenCalledTimes(2);
  });

  test("fails OPEN when the counter itself errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // A broken counter must not mean the app can never send mail again.
    state.db = {
      insert() {
        throw new Error("db is down");
      },
    } as unknown as TestDb;

    await sendVerificationEmail(mail("victim@example.com"));
    expect(sent).toHaveBeenCalledTimes(1);
  });
});
