import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  isStripePriceKey,
  isOneTimePriceKey,
  planTierForPriceKey,
} from "@/lib/billing/checkout";
import { stripeSecretKey, stripeWebhookSecret } from "@/lib/billing/env";

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
