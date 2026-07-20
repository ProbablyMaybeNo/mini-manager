import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { processedStripeEvents, users } from "@/db/schema";

/**
 * POST /api/billing/webhook — the money-handling route. Two things under
 * test against a REAL in-memory DB (not a hand-mocked query chain — this is
 * the one place a mocking mistake could hide a double-grant bug):
 *
 *   1. checkout.session.completed sets plan = pro_monthly (+ drops to free
 *      on subscription cancel/inactive).
 *   2. IDEMPOTENCY — replaying the exact same Stripe event id is a no-op.
 *      Stripe redelivers events it doesn't get a fast 200 for, and the
 *      dashboard's "resend" can replay an old event on demand; neither may
 *      double-grant or resurrect a plan a later, real event already revoked.
 *
 * `stripe.webhooks.constructEvent` (signature verification) is mocked to
 * return a canned event object — this suite is about the handler + the
 * idempotency table, not Stripe's signature crypto.
 */

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: "" as string,
}));

const constructEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/db/client", () => ({
  get db() {
    if (!state.db) throw new Error("Test DB not initialised in beforeEach");
    return state.db;
  },
}));
vi.mock("@/lib/billing/env", () => ({
  stripeSecretKey: () => "sk_test_123",
  stripeWebhookSecret: () => "whsec_test_123",
}));
vi.mock("stripe", () => ({
  default: class FakeStripe {
    webhooks = { constructEvent: constructEventMock };
  },
}));
vi.mock("@/lib/analytics/track.server", () => ({ trackServer: vi.fn() }));

const { POST } = await import("@/app/api/billing/webhook/route");

function req(): Request {
  return new Request("https://app.test/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: "{}",
  });
}

interface FakeSession {
  id: string;
  client_reference_id: string | null;
  customer: string;
  subscription: string;
  metadata: { userId: string; priceKey: string };
}

function checkoutCompletedEvent(eventId: string, userId: string) {
  return {
    id: eventId,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test",
        client_reference_id: userId,
        customer: "cus_test",
        subscription: "sub_test",
        metadata: { userId, priceKey: "pro_monthly" },
      } satisfies FakeSession,
    },
  };
}

function subscriptionDeletedEvent(eventId: string, customerId: string) {
  return {
    id: eventId,
    type: "customer.subscription.deleted",
    data: {
      object: { customer: customerId, status: "canceled" },
    },
  };
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  constructEventMock.mockReset();
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("checkout.session.completed", () => {
  test("sets plan = pro_monthly and stamps stripe ids", async () => {
    constructEventMock.mockReturnValue(checkoutCompletedEvent("evt_1", state.userId));
    const res = await POST(req());
    expect(res.status).toBe(200);

    const [row] = await state.db!.select().from(users).where(eq(users.id, state.userId));
    expect(row?.plan).toBe("pro_monthly");
    expect(row?.stripeCustomerId).toBe("cus_test");
    expect(row?.stripeSubscriptionId).toBe("sub_test");
    expect(row?.planExpiresAt).not.toBeNull();
  });

  test("records the event id in processed_stripe_event", async () => {
    constructEventMock.mockReturnValue(checkoutCompletedEvent("evt_2", state.userId));
    await POST(req());
    const rows = await state.db!.select().from(processedStripeEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("evt_2");
    expect(rows[0]?.eventType).toBe("checkout.session.completed");
  });
});

describe("webhook idempotency — replayed event ids are a no-op", () => {
  test("replaying the SAME event id does not re-run the handler", async () => {
    const event = checkoutCompletedEvent("evt_dup", state.userId);
    constructEventMock.mockReturnValue(event);

    const first = await POST(req());
    expect(first.status).toBe(200);

    // A real cancellation lands between the two deliveries — the correct
    // state afterwards is "free". A naive re-processed replay of the OLD
    // completed event would incorrectly re-grant pro_monthly.
    await state.db!.update(users).set({ plan: "free", planExpiresAt: null }).where(eq(users.id, state.userId));

    const second = await POST(req());
    expect(second.status).toBe(200);

    const [row] = await state.db!.select().from(users).where(eq(users.id, state.userId));
    expect(row?.plan).toBe("free");

    // Only one processed-event row for this id — the insert-based guard
    // caught the duplicate rather than silently re-running.
    const processed = await state.db!.select().from(processedStripeEvents);
    expect(processed).toHaveLength(1);
  });

  test("two DIFFERENT event ids both process independently", async () => {
    constructEventMock.mockReturnValueOnce(checkoutCompletedEvent("evt_a", state.userId));
    await POST(req());
    constructEventMock.mockReturnValueOnce(checkoutCompletedEvent("evt_b", state.userId));
    await POST(req());

    const processed = await state.db!.select().from(processedStripeEvents);
    expect(processed.map((p) => p.id).sort()).toEqual(["evt_a", "evt_b"]);
  });

  test("a replayed cancellation does not double-touch an already-free user", async () => {
    // Grant, then cancel.
    constructEventMock.mockReturnValueOnce(checkoutCompletedEvent("evt_grant", state.userId));
    await POST(req());
    const [{ stripeCustomerId }] = await state.db!
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, state.userId));

    constructEventMock.mockReturnValueOnce(
      subscriptionDeletedEvent("evt_cancel", stripeCustomerId!),
    );
    await POST(req());
    const [afterCancel] = await state.db!.select().from(users).where(eq(users.id, state.userId));
    expect(afterCancel?.plan).toBe("free");

    // Replay of the exact same cancel event — idempotency guard skips the
    // handler entirely (harmless either way here, but proves no double work).
    constructEventMock.mockReturnValueOnce(
      subscriptionDeletedEvent("evt_cancel", stripeCustomerId!),
    );
    const replay = await POST(req());
    expect(replay.status).toBe(200);

    const processed = await state.db!.select().from(processedStripeEvents);
    expect(processed.filter((p) => p.id === "evt_cancel")).toHaveLength(1);
  });
});
