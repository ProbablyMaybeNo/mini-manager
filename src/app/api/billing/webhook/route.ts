import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db/client";
import { processedStripeEvents, sponsorships, users } from "@/db/schema";
import {
  isStripePriceKey,
  isOneTimePriceKey,
  planTierForPriceKey,
} from "@/lib/billing/checkout";
import { stripeSecretKey, stripeWebhookSecret } from "@/lib/billing/env";
import { trackServer } from "@/lib/analytics/track.server";
import { AnalyticsEvent } from "@/lib/analytics/events";

/**
 * P10.5 — Stripe webhook receiver.
 *
 * POST /api/billing/webhook
 *
 * Verifies the Stripe signature against the raw body, then promotes /
 * demotes the user's plan in response to the events we care about:
 *
 *   - checkout.session.completed       → set the bought plan tier — OR,
 *     when `metadata.kind === "sponsor"`, record a one-off sponsorship
 *     instead (fix 7 — the Settings-page pay-what-you-want tip). The two
 *     session kinds are mutually exclusive by construction: the plan
 *     checkout (/api/billing/checkout) sets `metadata.priceKey`; the
 *     sponsor checkout (/api/billing/sponsor-checkout) sets
 *     `metadata.kind` and no `priceKey`. A sponsor session never touches
 *     `plan`/`freeForeverGrantedAt` — it's pure support, not an unlock.
 *   - customer.subscription.deleted    → drop a monthly sub back to free.
 *   - customer.subscription.updated    → if no longer active, drop to free.
 *
 * The route is matcher-excluded from the auth gate (see src/proxy.ts) —
 * Stripe calls it with no session, and gating it would 302 every webhook.
 *
 * IMPORTANT: the raw body must reach `constructEvent` un-parsed, so we read
 * `await req.text()` and never `req.json()` before verification.
 *
 * IDEMPOTENCY (subscription paywall, revised on review) — Stripe redelivers
 * events it doesn't get a fast 200 for, and the dashboard's "resend" can
 * replay an old event on demand. Two failure modes to avoid, and they pull
 * in opposite directions:
 *
 *   1. A genuine REPLAY (the handler already succeeded once) must be a
 *      no-op — never re-run, never risk re-granting a plan a later,
 *      legitimate event already revoked.
 *   2. A handler that THROWS must NOT be marked processed — if it were,
 *      Stripe's retry (the only recovery path — there is no other way to
 *      re-trigger a failed webhook) would be silently swallowed by the
 *      dedup check, and the paid subscriber never gets access. Recorded
 *      only on failure is strictly worse than not recording at all.
 *
 * So the record happens AFTER the handler returns successfully, not
 * before: `wasAlreadyProcessed` is a plain SELECT run first (skip a known
 * duplicate without re-running anything); the handler runs inside a
 * try/catch that returns a non-200 on failure (Stripe retries — the plan
 * UPDATE is idempotent, so re-running on retry is safe); only on success
 * does `recordProcessedEvent` INSERT the event id into
 * `processed_stripe_event` (unique PK) — a UNIQUE violation there just
 * means a concurrent delivery already recorded it, which is harmless and
 * swallowed (the write it recorded already happened too).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ~31 days in ms — the expiry stamp for a fresh monthly sub before the
 *  first `customer.subscription.updated` ping refines it. */
const MONTHLY_PERIOD_MS = 31 * 24 * 60 * 60 * 1000;

export async function POST(req: Request): Promise<Response> {
  const secret = stripeSecretKey();
  const webhookSecret = stripeWebhookSecret();
  if (!secret || !webhookSecret) {
    return new Response("Billing is not configured", { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing signature", { status: 400 });
  }

  // Raw body — do NOT parse before verifying.
  const body = await req.text();

  const stripe = new Stripe(secret);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Idempotency pre-check — see module docstring. A cheap read; skips a
  // known-duplicate delivery without re-running anything. Runs for every
  // event type (not just the ones we handle) so a replay never double-fires
  // anything, present or future.
  if (await wasAlreadyProcessed(event.id)) {
    return new Response(null, { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        if (checkoutSession.metadata?.kind === "sponsor") {
          await handleSponsorCompleted(checkoutSession);
        } else {
          await handleCheckoutCompleted(checkoutSession);
        }
        break;
      }
      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        await handleSubscriptionChange(
          event.data.object as Stripe.Subscription,
          event.type,
        );
        break;
      }
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    // Do NOT record — a non-200 tells Stripe to retry, and the retry re-runs
    // this same handler (safe: the plan UPDATE is idempotent).
    console.error("[billing/webhook] handler failed:", err);
    return new Response("Webhook handler failed", { status: 500 });
  }

  // Only mark processed once the handler has actually succeeded.
  await recordProcessedEvent(event.id, event.type);
  return new Response(null, { status: 200 });
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const metadata = session.metadata ?? {};
  const userId = metadata.userId ?? session.client_reference_id ?? null;
  const priceKey = metadata.priceKey;
  if (!userId || !isStripePriceKey(priceKey)) {
    // Nothing we can map this to — ack and move on.
    return;
  }

  const plan = planTierForPriceKey(priceKey);

  // Lifetime / Founder are one-time → no expiry. Monthly gets a provisional
  // ~31-day expiry that subscription events later refine.
  const planExpiresAt = isOneTimePriceKey(priceKey)
    ? null
    : new Date(Date.now() + MONTHLY_PERIOD_MS);

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);

  const update: Partial<typeof users.$inferInsert> = {
    plan,
    planExpiresAt,
  };
  if (customerId) update.stripeCustomerId = customerId;
  if (subscriptionId) update.stripeSubscriptionId = subscriptionId;
  // Founder is a distinct identity — stamp the claim so the badge persists.
  if (priceKey === "founder") update.founderClaimedAt = new Date();

  await db.update(users).set(update).where(eq(users.id, userId));
  await trackServer(AnalyticsEvent.BillingCheckoutCompleted, { priceKey, plan });
}

/**
 * The one-off "Sponsor the Mini-Mainframe" tip (fix 7) — record it and stop.
 * Deliberately does NOT touch `plan`/`planExpiresAt`/`freeForeverGrantedAt`;
 * a sponsorship is pure support, not an unlock. `amountCents` is read from
 * Stripe's own `session.amount_total` (the authoritative charged amount),
 * never trusted from the checkout-creation request body.
 */
async function handleSponsorCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
  const amountCents = session.amount_total;
  if (!userId || !amountCents || amountCents <= 0) {
    // Nothing we can map this to, or Stripe reports a non-positive charge
    // (shouldn't happen given the $1 minimum enforced at checkout creation)
    // — ack and move on rather than record a bogus row.
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  await db.insert(sponsorships).values({
    userId,
    amountCents,
    stripeSessionId: session.id,
    stripeCustomerId: customerId,
  });
}

async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  eventType: "customer.subscription.deleted" | "customer.subscription.updated",
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  if (!customerId) return;

  // Cancel outright, or an update that left the sub in a non-active state →
  // demote to free. Active / trialing updates leave the plan untouched.
  const inactive =
    eventType === "customer.subscription.deleted" ||
    !["active", "trialing", "past_due"].includes(subscription.status);
  if (!inactive) return;

  await db
    .update(users)
    .set({ plan: "free", planExpiresAt: null, stripeSubscriptionId: null })
    .where(eq(users.stripeCustomerId, customerId));
}

/** Cheap pre-check — true when this event id is already recorded as
 *  processed (a genuine replay; the caller should skip the handler
 *  entirely). A plain SELECT, not the source of truth for dedup (that's
 *  the unique constraint `recordProcessedEvent` relies on) — just an
 *  early-out so a replay doesn't re-run a handler for no reason. */
async function wasAlreadyProcessed(eventId: string): Promise<boolean> {
  const rows = await db
    .select({ id: processedStripeEvents.id })
    .from(processedStripeEvents)
    .where(eq(processedStripeEvents.id, eventId))
    .limit(1);
  return rows.length > 0;
}

/**
 * Record `eventId` as processed — called ONLY after its handler has
 * already returned successfully (see module docstring for why the order
 * matters). A UNIQUE violation here means a concurrent delivery of the
 * SAME event already recorded it first; that delivery's handler run
 * already did the (idempotent) work too, so this is a harmless no-op, not
 * an error.
 */
async function recordProcessedEvent(
  eventId: string,
  eventType: string,
): Promise<void> {
  try {
    await db.insert(processedStripeEvents).values({ id: eventId, eventType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toUpperCase().includes("UNIQUE")) return;
    // Not a duplicate-key failure — let it surface. Stripe will retry on
    // the resulting non-200; the retry's pre-check will see the handler's
    // write already landed (if it did) and just re-attempt the record.
    throw err;
  }
}
