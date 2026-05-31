/**
 * P11.8 — Tools page palette + microcopy contract.
 *
 * Each of the four colour tools gets a unique slot in the locked
 * 5-color palette so the launcher index reads as a colour-coded grid
 * rather than a uniform one. Per-tool blurbs are tightened to one
 * plain-prose line each.
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

describe("ToolCard — palette tone contract (P11.8)", () => {
  const src = read("src/components/tools/ToolCard.tsx");

  test("exports a ToolTone union type covering the 5 palette slots", () => {
    expect(src).toContain(
      'export type ToolTone = "cyan" | "yellow" | "green" | "purple" | "red"',
    );
  });

  test("each tone has an explicit group-hover variant class", () => {
    // Tailwind 4 JIT only picks up literal class strings — concat
    // wouldn't fly. Verify every tone has its own spelled-out class.
    expect(src).toContain("group-hover:text-[var(--color-cyan)]");
    expect(src).toContain("group-hover:text-[var(--color-yellow)]");
    expect(src).toContain("group-hover:text-[var(--color-green)]");
    expect(src).toContain("group-hover:text-[var(--color-purple-pastel)]");
    expect(src).toContain("group-hover:text-[var(--color-red)]");
  });

  test("each tone has a matching hover-border class so the frame picks up the tone", () => {
    expect(src).toContain("hover:border-[var(--color-cyan)]");
    expect(src).toContain("hover:border-[var(--color-yellow)]");
    expect(src).toContain("hover:border-[var(--color-green)]");
    expect(src).toContain("hover:border-[var(--color-purple-pastel)]");
  });

  test("default tone is cyan (the primary-action slot)", () => {
    expect(src).toMatch(/tone\s*=\s*"cyan"/);
  });
});

describe("Tools page — per-tool tone assignments (P11.8)", () => {
  const src = read("src/app/tools/page.tsx");

  test("wheel claims pastel-purple (the 'special / unusual' slot)", () => {
    expect(src).toMatch(/\/tools\/wheel[\s\S]*?tone:\s*"purple"/);
  });

  test("match claims cyan (the primary-action slot)", () => {
    expect(src).toMatch(/\/tools\/match[\s\S]*?tone:\s*"cyan"/);
  });

  test("eyedropper claims neon green (the capture / complete slot)", () => {
    expect(src).toMatch(/\/tools\/eyedropper[\s\S]*?tone:\s*"green"/);
  });

  test("gradient claims pastel yellow (the planning slot)", () => {
    expect(src).toMatch(/\/tools\/gradient[\s\S]*?tone:\s*"yellow"/);
  });

  test("every tool blurb is ≤ 80 chars (plain-prose tightening)", () => {
    // Grab the four blurb strings out of the source via a tolerant regex.
    const blurbs = [...src.matchAll(/blurb:\s*"([^"]+)"/g)].map((m) => m[1]!);
    expect(blurbs).toHaveLength(4);
    for (const blurb of blurbs) {
      expect(blurb.length).toBeLessThanOrEqual(80);
    }
  });
});
