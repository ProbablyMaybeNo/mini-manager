import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Route-level tests for POST /api/billing/sponsor-checkout — the one-off
 * "Feed the Mainframe" tip (fix 7). Auth, DB, and Stripe are mocked so we
 * drive the REAL handler logic (amount validation, the auth gate, the
 * dynamic price_data + sponsor metadata shape) without a session, a
 * database, or a live Stripe call.
 *
 * Contract under test:
 *   400 — amount missing/malformed/below the $1 minimum.
 *   401 — no authenticated session.
 *   200 — a Checkout session with `mode: "payment"`, a DYNAMIC
 *         `price_data` line item (no pre-created Stripe price, unlike the
 *         monthly plan checkout), and `metadata.kind === "sponsor"`.
 *   502 — Stripe rejects the request.
 */

const authMock = vi.fn<() => Promise<{ user?: { id?: string } } | null>>();

interface UserRow {
  id: string;
  email: string | null;
  username: string | null;
  stripeCustomerId: string | null;
}

const dbRows = { value: [] as UserRow[] };
const dbMock = {
  select: vi.fn(() => dbMock),
  from: vi.fn(() => dbMock),
  where: vi.fn(() => dbMock),
  limit: vi.fn(async () => dbRows.value),
  update: vi.fn(() => dbMock),
  set: vi.fn(() => dbMock),
};

const createSessionMock = vi.fn();
const createCustomerMock = vi.fn();

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/db/client", () => ({ db: dbMock }));
vi.mock("@/lib/billing/env", () => ({
  stripeSecretKey: () => "sk_test_123",
}));
vi.mock("stripe", () => ({
  default: class FakeStripe {
    checkout = { sessions: { create: createSessionMock } };
    customers = { create: createCustomerMock };
  },
}));

const { POST } = await import("@/app/api/billing/sponsor-checkout/route");

function req(body: unknown): Request {
  return new Request("https://app.test/api/billing/sponsor-checkout", {
    method: "POST",
    headers: { host: "app.test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authMock.mockReset();
  dbRows.value = [];
  createSessionMock.mockReset();
  createCustomerMock.mockReset();
  dbMock.select.mockClear();
  dbMock.update.mockClear();
  dbMock.set.mockClear();
});

describe("POST /api/billing/sponsor-checkout", () => {
  test("400 when the amount is below the $1 minimum", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    const res = await POST(req({ amountCents: 50 }));
    expect(res.status).toBe(400);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  test("400 for a malformed body", async () => {
    const res = await POST(
      new Request("https://app.test/x", { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
  });

  test("401 when there is no authenticated session — amount is valid but unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(req({ amountCents: 500 }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("auth_required");
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  test("creates a dynamic price_data session with the exact amount + sponsor metadata", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1" } });
    dbRows.value = [
      { id: "user_1", email: "a@example.com", username: "painter", stripeCustomerId: "cus_existing" },
    ];
    createSessionMock.mockResolvedValue({ url: "https://checkout.stripe.com/session_x" });

    const res = await POST(req({ amountCents: 500 }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url?: string };
    expect(body.url).toBe("https://checkout.stripe.com/session_x");

    expect(createSessionMock).toHaveBeenCalledOnce();
    const args = createSessionMock.mock.calls[0]![0] as {
      mode: string;
      customer: string;
      line_items: Array<{
        price_data: {
          currency: string;
          unit_amount: number;
          product_data: { name: string };
        };
      }>;
      metadata: Record<string, string>;
      success_url: string;
      cancel_url: string;
    };
    expect(args.mode).toBe("payment");
    expect(args.customer).toBe("cus_existing");
    expect(args.line_items[0]!.price_data.unit_amount).toBe(500);
    expect(args.line_items[0]!.price_data.currency).toBe("usd");
    expect(args.line_items[0]!.price_data.product_data.name).toBe(
      "Mini Mainframe Sponsorship",
    );
    // No `priceKey` here (unlike the plan checkout) — kind:"sponsor" is the
    // only discriminator the webhook needs.
    expect(args.metadata).toEqual({ userId: "user_1", kind: "sponsor" });
    expect(args.success_url).toContain("/user?sponsored=1");
    expect(args.cancel_url).toContain("/user");
    expect(args.cancel_url).not.toContain("sponsored=1");
    // Already had a Stripe customer — no new one created.
    expect(createCustomerMock).not.toHaveBeenCalled();
  });

  test("creates + persists a new Stripe customer on first checkout", async () => {
    authMock.mockResolvedValue({ user: { id: "user_2" } });
    dbRows.value = [
      { id: "user_2", email: "b@example.com", username: "newpainter", stripeCustomerId: null },
    ];
    createCustomerMock.mockResolvedValue({ id: "cus_new" });
    createSessionMock.mockResolvedValue({ url: "https://checkout.stripe.com/session_y" });

    const res = await POST(req({ amountCents: 1000 }));
    expect(res.status).toBe(200);
    expect(createCustomerMock).toHaveBeenCalledOnce();
    expect(dbMock.update).toHaveBeenCalled();
    const sessionArgs = createSessionMock.mock.calls[0]![0] as { customer: string };
    expect(sessionArgs.customer).toBe("cus_new");
  });

  test("404 when the user row is missing entirely", async () => {
    authMock.mockResolvedValue({ user: { id: "ghost" } });
    dbRows.value = [];
    const res = await POST(req({ amountCents: 500 }));
    expect(res.status).toBe(404);
  });

  test("502 when Stripe rejects the request", async () => {
    authMock.mockResolvedValue({ user: { id: "user_3" } });
    dbRows.value = [
      { id: "user_3", email: null, username: null, stripeCustomerId: "cus_x" },
    ];
    createSessionMock.mockRejectedValue(new Error("bad request"));
    const res = await POST(req({ amountCents: 500 }));
    expect(res.status).toBe(502);
  });

  test("502 when Stripe returns no redirect url", async () => {
    authMock.mockResolvedValue({ user: { id: "user_4" } });
    dbRows.value = [
      { id: "user_4", email: null, username: null, stripeCustomerId: "cus_y" },
    ];
    createSessionMock.mockResolvedValue({ url: null });
    const res = await POST(req({ amountCents: 500 }));
    expect(res.status).toBe(502);
  });
});
