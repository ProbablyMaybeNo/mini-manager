import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { stripeSecretKey } from "@/lib/billing/env";

/**
 * One-off "Sponsor the Mini-Mainframe" checkout (Settings page, fix 7 —
 * Ross's review pass). Deliberately separate from `/api/billing/checkout`
 * (the monthly-sponsorship / tool-unlock flow) — this is a pay-what-you-want
 * tip that does NOT unlock anything and needs its own `mode: "payment"`
 * session with a DYNAMIC `price_data` line item (no Stripe product/price to
 * pre-create, unlike the monthly `pro_monthly` price).
 *
 * POST /api/billing/sponsor-checkout  { amountCents: number }
 *
 * `amountCents` must be at least $1 (100). The webhook
 * (`checkout.session.completed` where `metadata.kind === "sponsor"`) reads
 * the AUTHORITATIVE charged amount back off Stripe's own
 * `session.amount_total` when it records the sponsorship — never this
 * request body — so a malformed/tampered client value here can, at worst,
 * fail the Checkout session creation; it can never mis-record what was
 * actually charged.
 *
 * Status contract mirrors `/api/billing/checkout`:
 *   400 — invalid/missing amount (below the $1 minimum).
 *   401 — no session (client should bounce to sign-in and retry).
 *   503 — Stripe isn't configured yet.
 *   502 — Stripe rejected the request.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** $1.00 minimum, in cents. */
const MIN_AMOUNT_CENTS = 100;
/** Sanity ceiling — $10,000. Guards against a fat-fingered/malicious huge
 *  Checkout session; Stripe itself also caps per-currency max amounts. */
const MAX_AMOUNT_CENTS = 1_000_000;

const BodySchema = z.object({
  amountCents: z.number().int().min(MIN_AMOUNT_CENTS).max(MAX_AMOUNT_CENTS),
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
  return new URL(req.url).origin;
}

export async function POST(req: Request): Promise<Response> {
  let amountCents: number;
  try {
    const json = await req.json();
    amountCents = BodySchema.parse(json).amountCents;
  } catch {
    return NextResponse.json(
      { error: `Enter an amount of at least $${MIN_AMOUNT_CENTS / 100}.` },
      { status: 400 },
    );
  }

  // Auth first — same JSON-401 contract as /api/billing/checkout so the
  // client can react (not a server redirect a fetch would follow opaquely).
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const secret = stripeSecretKey();
  if (!secret) {
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
    // checkout — same customer record the monthly-sponsorship flow uses.
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

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: { name: "Mini Mainframe Sponsorship" },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/user?sponsored=1`,
      cancel_url: `${origin}/user`,
      client_reference_id: userId,
      // kind: "sponsor" is how the webhook tells this apart from the plan
      // checkout — no priceKey here means handleCheckoutCompleted's own
      // isStripePriceKey guard would no-op it anyway (defence in depth).
      metadata: { userId, kind: "sponsor" },
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Checkout session had no redirect URL" },
        { status: 502 },
      );
    }
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown Stripe error";
    console.error("[billing/sponsor-checkout] Stripe error:", err);
    return NextResponse.json(
      { error: "Could not start checkout", detail: message },
      { status: 502 },
    );
  }
}
