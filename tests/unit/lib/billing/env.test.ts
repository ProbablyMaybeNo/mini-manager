import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  isStripeConfigured,
  stripePriceId,
  stripeSecretKey,
  stripeWebhookSecret,
} from "@/lib/billing/env";

/**
 * Stripe env reads. The whole point is these helpers MUST NOT throw at
 * import time when the env vars are missing — the scaffold ships before
 * Ross creates the Stripe account, so /pricing has to render against an
 * empty env. Each helper resolves to `null` instead.
 */

const STRIPE_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_LIFETIME",
  "STRIPE_PRICE_FOUNDER",
] as const;

let saved: Partial<Record<(typeof STRIPE_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  saved = {};
  for (const k of STRIPE_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of STRIPE_KEYS) {
    if (saved[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = saved[k];
    }
  }
});

describe("missing env vars (default for the P10.1 scaffold)", () => {
  test("stripeSecretKey returns null", () => {
    expect(stripeSecretKey()).toBeNull();
  });

  test("stripeWebhookSecret returns null", () => {
    expect(stripeWebhookSecret()).toBeNull();
  });

  test("stripePriceId returns null for every tier", () => {
    expect(stripePriceId("pro_monthly")).toBeNull();
    expect(stripePriceId("pro_lifetime")).toBeNull();
    expect(stripePriceId("founder")).toBeNull();
  });

  test("isStripeConfigured returns false", () => {
    expect(isStripeConfigured()).toBe(false);
  });
});

describe("populated env vars", () => {
  test("stripeSecretKey returns the trimmed value", () => {
    process.env.STRIPE_SECRET_KEY = "  sk_test_abc  ";
    expect(stripeSecretKey()).toBe("sk_test_abc");
  });

  test("stripeWebhookSecret returns the trimmed value", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_xyz";
    expect(stripeWebhookSecret()).toBe("whsec_xyz");
  });

  test("stripePriceId maps each key to its own env var", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_mo";
    process.env.STRIPE_PRICE_PRO_LIFETIME = "price_lt";
    process.env.STRIPE_PRICE_FOUNDER = "price_fnd";
    expect(stripePriceId("pro_monthly")).toBe("price_mo");
    expect(stripePriceId("pro_lifetime")).toBe("price_lt");
    expect(stripePriceId("founder")).toBe("price_fnd");
  });

  test("isStripeConfigured requires all five vars", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    expect(isStripeConfigured()).toBe(false);
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_mo";
    expect(isStripeConfigured()).toBe(false);
    process.env.STRIPE_PRICE_PRO_LIFETIME = "price_lt";
    expect(isStripeConfigured()).toBe(false);
    process.env.STRIPE_PRICE_FOUNDER = "price_fnd";
    // Webhook secret isn't required for isStripeConfigured — it gates
    // only the webhook route, not Checkout creation. So at this point
    // we should be fully configured for the live Checkout path.
    expect(isStripeConfigured()).toBe(true);
  });

  test("empty string env var is treated as unset", () => {
    process.env.STRIPE_SECRET_KEY = "";
    expect(stripeSecretKey()).toBeNull();
    process.env.STRIPE_SECRET_KEY = "   ";
    expect(stripeSecretKey()).toBeNull();
  });
});
