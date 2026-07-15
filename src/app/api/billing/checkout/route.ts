import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  isOneTimePriceKey,
  STRIPE_PRICE_KEYS,
} from "@/lib/billing/checkout";
import { stripePriceId, stripeSecretKey } from "@/lib/billing/env";
import { trackServer } from "@/lib/analytics/track.server";
import { AnalyticsEvent } from "@/lib/analytics/events";

/**
 * P10.4 — Stripe Checkout session creation.
 *
 * POST /api/billing/checkout  { priceKey: StripePriceKey }
 *
 * Resolves the signed-in user, ensures a Stripe customer exists for them
 * (creating + persisting one on first checkout), then opens a Checkout
 * Session for the requested price and hands the redirect URL back to the
 * client. The client does `window.location.href = url`.
 *
 * Status contract (all JSON the /pricing client can act on):
 *   401 — no session. The client bounces to sign-in carrying the upgrade
 *         intent, then returns here. We must NOT server-redirect a fetch.
 *   503 — Stripe isn't configured yet (no secret key / no price id); the
 *         page falls back to /sign-up pre-wire-up.
 *   502 — Stripe rejected the request (bad key / price / live↔test mismatch).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  priceKey: z.enum(STRIPE_PRICE_KEYS as unknown as [string, ...string[]]),
});

/** Derive the request origin (scheme + host) from forwarding headers,
 *  falling back to the standard Host header. Used for success/cancel URLs. */
function originFromHeaders(req: Request): string {
  const headers = req.headers;
  const forwardedHost = headers.get("x-forwarded-host");
  const host = forwardedHost ?? headers.get("host");
  const proto =
    headers.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") || host?.startsWith("127.0.0.1")
      ? "http"
      : "https");
  if (host) return `${proto}://${host}`;
  // Last resort — let Stripe reject a bad URL rather than crash here.
  return new URL(req.url).origin;
}

export async function POST(req: Request): Promise<Response> {
  // Parse + validate the body first so a malformed request fails fast.
  let priceKey: (typeof STRIPE_PRICE_KEYS)[number];
  try {
    const json = await req.json();
    const parsed = BodySchema.parse(json);
    priceKey = parsed.priceKey as (typeof STRIPE_PRICE_KEYS)[number];
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Auth first. An unauthenticated fetch must receive a JSON 401 it can react
  // to — a server-side redirect here would be followed opaquely by fetch (it
  // gets the sign-in HTML), the client couldn't tell auth from failure, and
  // the upgrade intent would be silently lost.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const secret = stripeSecretKey();
  const priceId = stripePriceId(priceKey);
  if (!secret || !priceId) {
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 503 },
    );
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const stripe = new Stripe(secret);

  try {
    // Ensure the user has a Stripe customer, creating + persisting on first
    // checkout. Email is nullable on the free tier — pass what we have so the
    // Stripe dashboard has something human-readable.
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.username ?? undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, userId));
    }

    const origin = originFromHeaders(req);
    const mode: Stripe.Checkout.SessionCreateParams.Mode = isOneTimePriceKey(
      priceKey,
    )
      ? "payment"
      : "subscription";

    const session = await stripe.checkout.sessions.create({
      mode,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/user?upgraded=1`,
      cancel_url: `${origin}/pricing`,
      client_reference_id: userId,
      metadata: { userId, priceKey },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout session had no redirect URL" },
        { status: 502 },
      );
    }
    await trackServer(AnalyticsEvent.BillingCheckoutStarted, { priceKey });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // A Stripe rejection (invalid/revoked key, a price id that doesn't exist
    // in this account, or a live/test mismatch) used to surface as an opaque
    // 500 with an empty body. Log the full error for Vercel runtime logs and
    // return the Stripe message so the failure is diagnosable from the client.
    const message =
      err instanceof Error ? err.message : "Unknown Stripe error";
    console.error("[billing/checkout] Stripe error:", err);
    return NextResponse.json(
      { error: "Could not start checkout", detail: message },
      { status: 502 },
    );
  }
}
