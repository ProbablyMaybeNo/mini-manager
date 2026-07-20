import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db/client";
import { processedStripeEvents, users } from "@/db/schema";
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
 *   - checkout.session.completed       → set the bought plan tier.
 *   - customer.subscription.deleted    → drop a monthly sub back to free.
 *   - customer.subscription.updated    → if no longer active, drop to free.
 *
 * The route is matcher-excluded from the auth gate (see src/proxy.ts) —
 * Stripe calls it with no session, and gating it would 302 every webhook.
 *
 * IMPORTANT: the raw body must reach `constructEvent` un-parsed, so we read
 * `await req.text()` and never `req.json()` before verification.
 *
 * IDEMPOTENCY (subscription paywall) — Stripe redelivers events it doesn't
 * get a fast 200 for, and the dashboard's "resend" can replay an old event
 * on demand. Without a guard, a replayed `checkout.session.completed` would
 * re-run `handleCheckoutCompleted` — harmless for the plan fields (an
 * idempotent `UPDATE ... SET plan = ...`), but this is the one place a bug
 * would mean a subscriber gets billed without ever landing here, or a
 * replay races a legitimate cancellation. `isDuplicateEvent` inserts the
 * Stripe event id into `processed_stripe_event` (unique PK) BEFORE any
 * handler runs; a UNIQUE violation means this exact event already ran, so
 * the handler is skipped and we still return 200 (Stripe stops retrying).
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

  // Idempotency gate — see module docstring. Runs for every event type
  // (not just the ones we handle) so a replay never double-fires anything,
  // present or future.
  if (await isDuplicateEvent(event.id, event.type)) {
    return new Response(null, { status: 200 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
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

/**
 * Record `eventId` as processed. Returns `true` when it was ALREADY
 * recorded (a duplicate delivery the caller should skip), `false` the
 * first time an id is seen (caller proceeds to dispatch the handler).
 *
 * The insert racing a concurrent delivery of the same event is exactly
 * the case this guards — the loser hits the unique-index violation and
 * is correctly told "duplicate, skip", same as a later replay.
 */
async function isDuplicateEvent(
  eventId: string,
  eventType: string,
): Promise<boolean> {
  try {
    await db.insert(processedStripeEvents).values({ id: eventId, eventType });
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toUpperCase().includes("UNIQUE")) return true;
    // Not a duplicate-key failure — a real DB error should surface (Stripe
    // will retry on a non-200, which is the correct behaviour here).
    throw err;
  }
}
