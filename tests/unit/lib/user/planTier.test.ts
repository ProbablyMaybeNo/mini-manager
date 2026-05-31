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

describe("User page — plan-tier pill (P11.9)", () => {
  const src = read("src/app/user/page.tsx");

  test("PLAN_PILL maps FREE → neutral, PRO → info (cyan), FOUNDER → purple", () => {
    expect(src).toMatch(/FREE:\s*"neutral"/);
    expect(src).toMatch(/PRO:\s*"info"/);
    expect(src).toMatch(/FOUNDER:\s*"purple"/);
  });

  test("PlanTier type covers all three tiers", () => {
    expect(src).toContain('type PlanTier = "FREE" | "PRO" | "FOUNDER"');
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
