import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { stripeSecretKey } from "@/lib/billing/env";

/**
 * Stripe Billing Portal session creation.
 *
 * POST /api/billing/portal  (no body)
 *
 * Resolves the signed-in user, looks up the Stripe customer the webhook
 * persisted on their row, and opens a Billing Portal session so they can
 * manage their subscription (cancel, update payment method, view invoices).
 * Hands the redirect URL back to the client, which does
 * `window.location.href = url`.
 *
 * Mirrors `/api/billing/checkout`'s Stripe init + graceful-failure contract:
 *   401 — no session. The client treats this as an auth bounce, not a crash;
 *         a server-side redirect here would be followed opaquely by fetch.
 *   503 — Stripe isn't configured yet (no secret key). Same fallback as
 *         checkout pre-wire-up.
 *   409 — authenticated, but the user has no `stripeCustomerId` (never
 *         purchased / webhook hasn't run). There's no portal to open, so we
 *         return a clear JSON error instead of throwing on an empty customer.
 *   502 — Stripe rejected the request (bad key / customer / live↔test mix).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Derive the request origin (scheme + host) from forwarding headers,
 *  falling back to the standard Host header. Used for the return URL. */
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
  // Auth first. An unauthenticated fetch must receive a JSON 401 it can react
  // to — a server-side redirect here would be followed opaquely by fetch (it
  // gets the sign-in HTML), and the client couldn't tell auth from failure.
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
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const customerId = user.stripeCustomerId;
  if (!customerId) {
    // No Stripe customer means there's nothing to manage — the user never
    // checked out (or the webhook hasn't synced). Surface a clear JSON error
    // the client can show rather than calling Stripe with an empty customer.
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 409 },
    );
  }

  const stripe = new Stripe(secret);

  try {
    const origin = originFromHeaders(req);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/user/account`,
    });

    if (!portal.url) {
      return NextResponse.json(
        { error: "Portal session had no redirect URL" },
        { status: 502 },
      );
    }
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    // A Stripe rejection (invalid/revoked key, a customer id that doesn't
    // exist in this account, or a live/test mismatch). Log the full error for
    // runtime logs and return the Stripe message so it's diagnosable client-side.
    const message =
      err instanceof Error ? err.message : "Unknown Stripe error";
    console.error("[billing/portal] Stripe error:", err);
    return NextResponse.json(
      { error: "Could not open billing portal", detail: message },
      { status: 502 },
    );
  }
}
