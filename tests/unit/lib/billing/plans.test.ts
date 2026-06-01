import { describe, expect, test } from "vitest";
import {
  FREE_TIER_LIMIT_ERROR,
  PLAN_LIMITS,
  getPlanForUser,
  isWithinLimit,
  type PlanRelevantUser,
} from "@/lib/billing/plans";

/** Helper — minimal user row for getPlanForUser tests. */
function user(over: Partial<PlanRelevantUser>): PlanRelevantUser {
  return {
    plan: "free",
    planExpiresAt: null,
    founderClaimedAt: null,
    ...over,
  };
}

describe("PLAN_LIMITS", () => {
  test("free tier caps match the locked pricing table", () => {
    expect(PLAN_LIMITS.free.projects).toBe(1);
    expect(PLAN_LIMITS.free.recipes).toBe(1);
    expect(PLAN_LIMITS.free.wishlist).toBe(3);
  });

  test("paid tiers are unlimited for every resource", () => {
    for (const tier of ["pro_monthly", "pro_lifetime", "founder"] as const) {
      expect(PLAN_LIMITS[tier].projects).toBe(Infinity);
      expect(PLAN_LIMITS[tier].recipes).toBe(Infinity);
      expect(PLAN_LIMITS[tier].wishlist).toBe(Infinity);
    }
  });
});

describe("isWithinLimit — free tier", () => {
  test("allows the first project on a fresh account", () => {
    expect(isWithinLimit("free", "projects", 0)).toBe(true);
  });

  test("blocks the second project (exactly at the cap)", () => {
    expect(isWithinLimit("free", "projects", 1)).toBe(false);
  });

  test("blocks past-cap counts (defensive)", () => {
    expect(isWithinLimit("free", "projects", 99)).toBe(false);
  });

  test("recipes cap is 1 — first allowed, second blocked", () => {
    expect(isWithinLimit("free", "recipes", 0)).toBe(true);
    expect(isWithinLimit("free", "recipes", 1)).toBe(false);
  });

  test("wishlist cap is 3 — first three allowed, fourth blocked", () => {
    expect(isWithinLimit("free", "wishlist", 0)).toBe(true);
    expect(isWithinLimit("free", "wishlist", 1)).toBe(true);
    expect(isWithinLimit("free", "wishlist", 2)).toBe(true);
    expect(isWithinLimit("free", "wishlist", 3)).toBe(false);
  });

  test("negative currentCount is treated as 0", () => {
    expect(isWithinLimit("free", "projects", -5)).toBe(true);
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
  test("resolves a free user from a user row", () => {
    const u = user({ plan: "free" });
    expect(isWithinLimit(u, "projects", 0)).toBe(true);
    expect(isWithinLimit(u, "projects", 1)).toBe(false);
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
    // to test the cap behaviour without mocking the system clock.
    expect(PLAN_LIMITS[getPlanForUser(expired, now)].projects).toBe(1);
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
