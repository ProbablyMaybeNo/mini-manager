import { describe, expect, test } from "vitest";
import {
  BILLING_ENFORCED,
  FREE_TIER_LIMIT_ERROR,
  PLAN_LIMITS,
  getPlanForUser,
  isWithinLimit,
  isWithinPlanLimit,
  type PlanRelevantUser,
} from "@/lib/billing/plans";

/** Helper — minimal user row for getPlanForUser tests. */
function user(over: Partial<PlanRelevantUser>): PlanRelevantUser {
  return {
    plan: "free",
    planExpiresAt: null,
    founderClaimedAt: null,
    freeForeverGrantedAt: null,
    ...over,
  };
}

describe("PLAN_LIMITS", () => {
  test("free tier: every resource is unlimited", () => {
    // Gating-layer model (fix 3, docs/SUBSCRIPTION_PAYWALL.md) — the
    // free/paid boundary is entirely about which FEATURES a user can reach
    // (isProUser), not resource counts. Recipes lost their per-project-node
    // cap here; projects/wishlist were already unlimited.
    expect(PLAN_LIMITS.free.projects).toBe(Infinity);
    expect(PLAN_LIMITS.free.recipes).toBe(Infinity);
    expect(PLAN_LIMITS.free.wishlist).toBe(Infinity);
  });

  test("paid tiers are unlimited for every resource", () => {
    for (const tier of ["pro_monthly", "pro_lifetime", "founder"] as const) {
      expect(PLAN_LIMITS[tier].projects).toBe(Infinity);
      expect(PLAN_LIMITS[tier].recipes).toBe(Infinity);
      expect(PLAN_LIMITS[tier].wishlist).toBe(Infinity);
    }
  });
});

describe("isWithinPlanLimit — free tier cap math", () => {
  test("every resource is unlimited on free (no per-account or per-node cap)", () => {
    expect(isWithinPlanLimit("free", "projects", 0)).toBe(true);
    expect(isWithinPlanLimit("free", "projects", 99)).toBe(true);
    expect(isWithinPlanLimit("free", "wishlist", 0)).toBe(true);
    expect(isWithinPlanLimit("free", "wishlist", 99)).toBe(true);
    expect(isWithinPlanLimit("free", "recipes", 0)).toBe(true);
    expect(isWithinPlanLimit("free", "recipes", 1)).toBe(true);
    expect(isWithinPlanLimit("free", "recipes", 99)).toBe(true);
  });

  test("negative currentCount is treated as 0", () => {
    expect(isWithinPlanLimit("free", "recipes", -5)).toBe(true);
  });
});

// Stripe is live (subscription-paywall build) — BILLING_ENFORCED is true, so
// isWithinLimit defers to the real isWithinPlanLimit cap math. There is no
// longer a real resource cap on any plan, so this just re-confirms nothing
// blocks now that enforcement is live.
describe("isWithinLimit — enforcement gate (BILLING_ENFORCED)", () => {
  test("no resource cap bites now that billing is live", () => {
    expect(BILLING_ENFORCED).toBe(true);
    expect(isWithinLimit("free", "projects", 99)).toBe(true);
    expect(isWithinLimit("free", "wishlist", 99)).toBe(true);
    expect(isWithinLimit("free", "recipes", 99)).toBe(true);
  });
});

describe("isWithinLimit — paid tiers", () => {
  test("pro_monthly allows arbitrary counts", () => {
    expect(isWithinLimit("pro_monthly", "projects", 0)).toBe(true);
    expect(isWithinLimit("pro_monthly", "projects", 50)).toBe(true);
    expect(isWithinLimit("pro_monthly", "wishlist", 9999)).toBe(true);
  });

  test("pro_lifetime allows arbitrary counts", () => {
    expect(isWithinLimit("pro_lifetime", "projects", 1000)).toBe(true);
    expect(isWithinLimit("pro_lifetime", "recipes", 1000)).toBe(true);
  });

  test("founder allows arbitrary counts", () => {
    expect(isWithinLimit("founder", "projects", 1000)).toBe(true);
    expect(isWithinLimit("founder", "wishlist", 1000)).toBe(true);
  });
});

describe("isWithinLimit — user-row input", () => {
  test("resolves a free user from a user row — every resource unlimited", () => {
    const u = user({ plan: "free" });
    expect(isWithinPlanLimit(u, "recipes", 99)).toBe(true);
    expect(isWithinLimit(u, "recipes", 99)).toBe(true);
    expect(isWithinPlanLimit(u, "projects", 99)).toBe(true);
    expect(isWithinPlanLimit(u, "wishlist", 99)).toBe(true);
  });

  test("resolves a founder from founderClaimedAt", () => {
    const u = user({ founderClaimedAt: new Date("2026-06-01") });
    expect(isWithinLimit(u, "projects", 9999)).toBe(true);
  });

  test("resolves a pro_lifetime user from the plan column", () => {
    const u = user({ plan: "pro_lifetime" });
    expect(isWithinLimit(u, "recipes", 100)).toBe(true);
  });

  test("an EXPIRED pro_monthly user falls back to free limits", () => {
    const expired = user({
      plan: "pro_monthly",
      planExpiresAt: new Date("2025-01-01"),
    });
    const now = new Date("2026-06-01");
    expect(getPlanForUser(expired, now)).toBe("free");
    // isWithinLimit uses now=new Date() so call getPlanForUser directly
    // to test the cap behaviour without mocking the system clock. No
    // resource is actually capped on free anymore — this just confirms the
    // resolved tier is "free" and its limits object still reads Infinity.
    expect(PLAN_LIMITS[getPlanForUser(expired, now)].recipes).toBe(Infinity);
  });
});

describe("getPlanForUser", () => {
  const NOW = new Date("2026-06-01T12:00:00Z");

  test("default 'free' row resolves to free", () => {
    expect(getPlanForUser(user({ plan: "free" }), NOW)).toBe("free");
  });

  test("founderClaimedAt wins over everything else", () => {
    expect(
      getPlanForUser(
        user({
          plan: "free",
          founderClaimedAt: new Date("2026-05-01"),
        }),
        NOW,
      ),
    ).toBe("founder");
    // Even if plan column says monthly, founder stamp takes priority.
    expect(
      getPlanForUser(
        user({
          plan: "pro_monthly",
          founderClaimedAt: new Date("2026-05-01"),
        }),
        NOW,
      ),
    ).toBe("founder");
  });

  test("plan='pro_lifetime' resolves regardless of planExpiresAt", () => {
    expect(
      getPlanForUser(
        user({ plan: "pro_lifetime", planExpiresAt: null }),
        NOW,
      ),
    ).toBe("pro_lifetime");
    // Even if a stray expiry got stamped, lifetime can't lapse.
    expect(
      getPlanForUser(
        user({
          plan: "pro_lifetime",
          planExpiresAt: new Date("2025-01-01"),
        }),
        NOW,
      ),
    ).toBe("pro_lifetime");
  });

  test("pro_monthly with future expiry → pro_monthly", () => {
    expect(
      getPlanForUser(
        user({
          plan: "pro_monthly",
          planExpiresAt: new Date("2026-07-01"),
        }),
        NOW,
      ),
    ).toBe("pro_monthly");
  });

  test("pro_monthly with null expiry → pro_monthly (active, no ping yet)", () => {
    expect(
      getPlanForUser(
        user({ plan: "pro_monthly", planExpiresAt: null }),
        NOW,
      ),
    ).toBe("pro_monthly");
  });

  test("pro_monthly with past expiry → falls back to free", () => {
    expect(
      getPlanForUser(
        user({
          plan: "pro_monthly",
          planExpiresAt: new Date("2025-12-01"),
        }),
        NOW,
      ),
    ).toBe("free");
  });
});

describe("FREE_TIER_LIMIT_ERROR", () => {
  test("has a stable user-facing string", () => {
    expect(FREE_TIER_LIMIT_ERROR).toMatch(/Free tier limit reached/);
    expect(FREE_TIER_LIMIT_ERROR).toMatch(/Upgrade for unlimited/);
  });
});
