/**
 * P11.9 — User page plan-tier pill contract.
 *
 * Free / Pro / Founder map to neutral / info / purple StatusPill kinds.
 * Locks the mapping so the cyan-primary + pastel-purple-special slots
 * stay correctly assigned the day the paid-tier flag actually ships.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("User page — plan-tier pill (P11.9 + P12.17)", () => {
  const src = read("src/app/user/page.tsx");

  test("PLAN_PILL maps FREE → neutral, PRO_* → info (cyan), FOUNDER → purple", () => {
    // P12.17 split PRO into PRO_MONTHLY + PRO_LIFETIME; both keep the
    // cyan info pill (they're the same product, different billing).
    expect(src).toMatch(/FREE:\s*"neutral"/);
    expect(src).toMatch(/PRO_MONTHLY:\s*"info"/);
    expect(src).toMatch(/PRO_LIFETIME:\s*"info"/);
    expect(src).toMatch(/FOUNDER:\s*"purple"/);
  });

  test("PlanTier type covers all four tiers (P12.17 split Pro into monthly + lifetime)", () => {
    expect(src).toContain(
      'type PlanTier = "FREE" | "PRO_MONTHLY" | "PRO_LIFETIME" | "FOUNDER"',
    );
  });

  test("Plan card surfaces the locked pricing", () => {
    expect(src).toContain("$0");
    expect(src).toContain("$4 / month");
    expect(src).toContain("$36 one-time");
    expect(src).toContain("$26 one-time");
  });

  test("Founder tier renders in pastel-purple (locked special slot)", () => {
    expect(src).toContain("text-[var(--color-purple-pastel)]");
  });

  test("page renders a Plan card section above Recovery email", () => {
    const planIdx = src.indexOf('title="Plan"');
    const recoveryIdx = src.indexOf("<RecoveryEmailCard");
    expect(planIdx).toBeGreaterThan(0);
    expect(planIdx).toBeLessThan(recoveryIdx);
  });

  test("header microcopy uses plain prose and mentions the three sections", () => {
    expect(src).toMatch(/account, plan, and data tools/);
  });

  test("export-card copy references 'colour slots' (P11.3 vocabulary)", () => {
    expect(src).toContain("colour slots");
    expect(src).not.toContain("with zones and steps");
  });
});
