/**
 * POST /api/feedback — tester feedback widget route.
 *
 * Covers the auth gate (no session → 401), zod validation (empty message →
 * 400), and the happy path (valid body inserts one owner-scoped row and
 * returns `{ ok: true, id }`).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { feedback } from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: null as string | null,
}));

vi.mock("@/db/client", () => ({
  get db() {
    if (!state.db) throw new Error("Test DB not initialised in beforeEach");
    return state.db;
  },
}));
// The route resolves identity via the NextAuth session helper. Mock it so
// `state.userId === null` simulates a signed-out caller.
vi.mock("@/auth", () => ({
  auth: async () =>
    state.userId ? { user: { id: state.userId } } : null,
}));

const { POST } = await import("@/app/api/feedback/route");

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = null;
});

describe("POST /api/feedback", () => {
  test("returns 401 when there is no session", async () => {
    state.userId = null;
    const res = await POST(postRequest({ message: "broken button" }));
    expect(res.status).toBe(401);
    // Nothing should have been written.
    const rows = await state.db!.select().from(feedback);
    expect(rows).toHaveLength(0);
  });

  test("inserts a row for a valid authed submission", async () => {
    const res = await POST(
      postRequest({
        message: "  The collection grid overlaps the rail on iPad  ",
        category: "bug",
        pageUrl: "/collection",
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; id: string };
    expect(json.ok).toBe(true);
    expect(typeof json.id).toBe("string");

    const rows = await state.db!
      .select()
      .from(feedback)
      .where(eq(feedback.userId, state.userId!));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.userId).toBe(state.userId);
    // Message is trimmed by the zod schema.
    expect(row.message).toBe("The collection grid overlaps the rail on iPad");
    expect(row.category).toBe("bug");
    expect(row.pageUrl).toBe("/collection");
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  test("defaults the category to 'other' when omitted", async () => {
    const res = await POST(postRequest({ message: "just a thought" }));
    expect(res.status).toBe(200);
    const rows = await state.db!.select().from(feedback);
    expect(rows[0]!.category).toBe("other");
    expect(rows[0]!.pageUrl).toBeNull();
  });

  test("rejects an empty message with 400 and writes nothing", async () => {
    const res = await POST(postRequest({ message: "   " }));
    expect(res.status).toBe(400);
    const rows = await state.db!.select().from(feedback);
    expect(rows).toHaveLength(0);
  });

  test("rejects a non-JSON body with 400", async () => {
    const req = new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
