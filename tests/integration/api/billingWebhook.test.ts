import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { processedStripeEvents, sponsorships, users } from "@/db/schema";

/**
 * POST /api/billing/webhook — the money-handling route. Three things under
 * test against a REAL in-memory DB (not a hand-mocked query chain — this is
 * the one place a mocking mistake could hide a double-grant bug):
 *
 *   1. checkout.session.completed sets plan = pro_monthly (+ drops to free
 *      on subscription cancel/inactive).
 *   2. IDEMPOTENCY — replaying the exact same Stripe event id (AFTER the
 *      handler already succeeded) is a no-op. Stripe redelivers events it
 *      doesn't get a fast 200 for, and the dashboard's "resend" can replay
 *      an old event on demand; neither may double-grant or resurrect a plan
 *      a later, real event already revoked.
 *   3. RETRY SAFETY — a handler that throws must NOT be marked processed,
 *      so Stripe's retry (the only recovery path for a failed webhook) can
 *      re-run it and actually grant access. Recording on failure would
 *      silently strand a paying subscriber with no access and no way to
 *      self-recover (see webhookRoute.ts's module docstring).
 *
 * `stripe.webhooks.constructEvent` (signature verification) is mocked to
 * return a canned event object — this suite is about the handler + the
 * idempotency table, not Stripe's signature crypto. `trackServer` is a
 * controllable mock (not just a no-op) so the retry-safety test can inject
 * a failure inside `handleCheckoutCompleted` without reaching into the
 * route's internals.
 */

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: "" as string,
}));

const constructEventMock = vi.hoisted(() => vi.fn());
const trackServerMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

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
vi.mock("@/lib/analytics/track.server", () => ({ trackServer: trackServerMock }));

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

/** The one-off "Feed the Mainframe" tip session (fix 7) — `metadata.kind`
 *  is the ONLY thing that tells this apart from a plan-checkout session;
 *  no `priceKey` in metadata. `amount_total` is the field the handler
 *  reads as the authoritative charged amount (never a client-supplied
 *  figure). */
function sponsorCompletedEvent(
  eventId: string,
  userId: string,
  amountTotalCents: number,
) {
  return {
    id: eventId,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_sponsor_test",
        client_reference_id: userId,
        customer: "cus_sponsor_test",
        amount_total: amountTotalCents,
        metadata: { userId, kind: "sponsor" },
      },
    },
  };
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  constructEventMock.mockReset();
  trackServerMock.mockReset();
  trackServerMock.mockResolvedValue(undefined);
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

describe("retry safety — a failed handler is NOT marked processed", () => {
  test("handler throws → non-200 → event NOT recorded → retry re-runs and succeeds", async () => {
    const event = checkoutCompletedEvent("evt_retry", state.userId);

    // First delivery: the handler's write happens, but the call it makes
    // AFTER the write (trackServer) throws — simulating any failure late in
    // the handler. The route must treat this as a failed delivery.
    constructEventMock.mockReturnValueOnce(event);
    trackServerMock.mockRejectedValueOnce(new Error("boom"));
    const first = await POST(req());
    expect(first.status).not.toBe(200);

    const notRecorded = await state.db!
      .select()
      .from(processedStripeEvents)
      .where(eq(processedStripeEvents.id, "evt_retry"));
    expect(notRecorded).toHaveLength(0);

    // Stripe retries the SAME event id. This time the handler completes
    // cleanly (trackServer's default mock resolves) — the pre-check saw no
    // recorded row, so it re-runs the (idempotent) handler rather than
    // silently skipping it.
    constructEventMock.mockReturnValueOnce(event);
    const second = await POST(req());
    expect(second.status).toBe(200);

    const recorded = await state.db!
      .select()
      .from(processedStripeEvents)
      .where(eq(processedStripeEvents.id, "evt_retry"));
    expect(recorded).toHaveLength(1);

    const [row] = await state.db!.select().from(users).where(eq(users.id, state.userId));
    expect(row?.plan).toBe("pro_monthly");
  });

  test("after a successful retry, a THIRD delivery of the same event is a true no-op", async () => {
    const event = checkoutCompletedEvent("evt_retry2", state.userId);
    trackServerMock.mockRejectedValueOnce(new Error("boom"));
    constructEventMock.mockReturnValueOnce(event);
    await POST(req()); // fails, not recorded

    constructEventMock.mockReturnValueOnce(event);
    await POST(req()); // succeeds, recorded

    // Manually flip the plan to prove a third delivery does NOT re-run.
    await state.db!.update(users).set({ plan: "free" }).where(eq(users.id, state.userId));
    constructEventMock.mockReturnValueOnce(event);
    const third = await POST(req());
    expect(third.status).toBe(200);

    const [row] = await state.db!.select().from(users).where(eq(users.id, state.userId));
    expect(row?.plan).toBe("free"); // untouched — the dedup pre-check skipped the handler
  });
});

describe("checkout.session.completed — sponsor sessions (fix 7)", () => {
  test("records a sponsorship row and does NOT touch plan/freeForeverGrantedAt", async () => {
    constructEventMock.mockReturnValue(sponsorCompletedEvent("evt_sponsor_1", state.userId, 500));
    const res = await POST(req());
    expect(res.status).toBe(200);

    const rows = await state.db!
      .select()
      .from(sponsorships)
      .where(eq(sponsorships.userId, state.userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountCents).toBe(500);
    expect(rows[0]?.stripeSessionId).toBe("cs_sponsor_test");
    expect(rows[0]?.stripeCustomerId).toBe("cus_sponsor_test");

    // No plan grant — a sponsorship is pure support, not an unlock.
    const [userRow] = await state.db!.select().from(users).where(eq(users.id, state.userId));
    expect(userRow?.plan).toBe("pro_lifetime"); // untouched (makeTestDb's default seed)
    expect(userRow?.freeForeverGrantedAt).toBeNull();
  });

  test("uses session.amount_total, not a value the request could have supplied", async () => {
    // amount_total is what the webhook trusts — this test just documents
    // that the recorded amount tracks whatever Stripe reports, proving
    // there's no separate client-trusted amount path in the handler.
    constructEventMock.mockReturnValue(sponsorCompletedEvent("evt_sponsor_2", state.userId, 12_345));
    await POST(req());
    const [row] = await state.db!
      .select()
      .from(sponsorships)
      .where(eq(sponsorships.userId, state.userId));
    expect(row?.amountCents).toBe(12_345);
  });

  test("idempotency applies to sponsor events too — a replay does not double-record", async () => {
    const event = sponsorCompletedEvent("evt_sponsor_dup", state.userId, 700);
    constructEventMock.mockReturnValueOnce(event);
    await POST(req());
    constructEventMock.mockReturnValueOnce(event);
    await POST(req());

    const rows = await state.db!
      .select()
      .from(sponsorships)
      .where(eq(sponsorships.userId, state.userId));
    expect(rows).toHaveLength(1);
  });

  test("a zero/negative amount_total is not recorded (defensive, shouldn't happen)", async () => {
    constructEventMock.mockReturnValue(sponsorCompletedEvent("evt_sponsor_zero", state.userId, 0));
    const res = await POST(req());
    expect(res.status).toBe(200);
    const rows = await state.db!.select().from(sponsorships);
    expect(rows).toHaveLength(0);
  });

  test("plan-checkout and sponsor sessions never cross wires", async () => {
    // A plan purchase followed by a sponsorship — each must land in its own
    // table, and the plan grant must be unaffected by the sponsorship.
    constructEventMock.mockReturnValueOnce(checkoutCompletedEvent("evt_plan", state.userId));
    await POST(req());
    constructEventMock.mockReturnValueOnce(
      sponsorCompletedEvent("evt_sponsor_3", state.userId, 300),
    );
    await POST(req());

    const [userRow] = await state.db!.select().from(users).where(eq(users.id, state.userId));
    expect(userRow?.plan).toBe("pro_monthly");

    const sponsorRows = await state.db!
      .select()
      .from(sponsorships)
      .where(eq(sponsorships.userId, state.userId));
    expect(sponsorRows).toHaveLength(1);
    expect(sponsorRows[0]?.amountCents).toBe(300);
  });
});
