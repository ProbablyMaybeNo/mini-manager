import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Route-level tests for POST /api/billing/portal. The auth session, DB, and
 * Stripe env are mocked so we can drive the REAL handler logic — the auth
 * gate and the "no Stripe customer" gate — without a session, a database, or
 * a live Stripe call.
 *
 * Contract under test (mirrors /api/billing/checkout's graceful failures):
 *   401 — no authenticated session.
 *   409 — authenticated, but the user row has no stripeCustomerId. A clear
 *         JSON error, NOT a thrown 500 / empty-customer Stripe call.
 */

const authMock = vi.fn<() => Promise<{ user?: { id?: string } } | null>>();

// A chainable Drizzle stub: select().from().where().limit() resolves to the
// row array we stage per-test. Each method returns the same object so the
// builder chain in the route resolves to `rows`.
const dbRows = { value: [] as Array<{ stripeCustomerId: string | null }> };
const dbMock = {
  select: vi.fn(() => dbMock),
  from: vi.fn(() => dbMock),
  where: vi.fn(() => dbMock),
  limit: vi.fn(async () => dbRows.value),
};

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/db/client", () => ({ db: dbMock }));
// Stripe is "configured" for these tests so the route gets past the 503 gate
// and reaches the customer-id check. We never reach a real Stripe call in the
// 401 / 409 paths.
vi.mock("@/lib/billing/env", () => ({
  stripeSecretKey: () => "sk_test_123",
}));

// Imported AFTER the mocks are registered.
const { POST } = await import("@/app/api/billing/portal/route");

function req(): Request {
  return new Request("https://app.test/api/billing/portal", {
    method: "POST",
    headers: { host: "app.test" },
  });
}

beforeEach(() => {
  authMock.mockReset();
  dbRows.value = [];
});

describe("POST /api/billing/portal", () => {
  test("401 when there is no authenticated session", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("auth_required");
    // The DB must not be touched on the unauth path.
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  test("409 with a clear error when the user has no stripeCustomerId", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    dbRows.value = [{ stripeCustomerId: null }];
    const res = await POST(req());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("No billing account found");
  });

  test("404 when the user row is missing entirely", async () => {
    authMock.mockResolvedValue({ user: { id: "ghost" } });
    dbRows.value = [];
    const res = await POST(req());
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("User not found");
  });
});
