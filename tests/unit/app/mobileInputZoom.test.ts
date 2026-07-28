import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * F1 — form controls must compute >=16px at mobile widths so iOS Safari never
 * auto-zooms on focus, AND the viewport must not lock zoom (WCAG 1.4.4).
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("mobile input zoom (F1)", () => {
  test("globals.css floors form controls at 16px under a mobile media query", () => {
    const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
    // Normalise whitespace so formatting changes don't break the assertion.
    const flat = css.replace(/\s+/g, " ");
    expect(flat).toMatch(
      /@media \(max-width: 640px\), \(max-height: 500px\) \{ input, select, textarea \{ font-size: 16px;/,
    );
  });

  test("the 16px floor also covers landscape phones (short viewports)", () => {
    // Gated on width alone, the F1 protection switched off the moment a phone
    // was rotated — fields dropped back to 13px and re-armed the exact Safari
    // zoom trap this rule exists to prevent, in the orientation where an
    // unrecoverable zoom costs most. The height clause is the fix; assert it
    // explicitly so a future tidy-up can't quietly drop it again.
    const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
    expect(css.replace(/\s+/g, " ")).toMatch(/\(max-height: 500px\)/);
  });

  test("viewport does not lock maximum-scale / user-scalable (keeps pinch-zoom)", () => {
    const layout = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/maximumScale/);
    expect(layout).not.toMatch(/userScalable/);
  });

  test("kit Input renders 16px on mobile via the responsive utility", () => {
    const input = readFileSync(root + "/src/components/kit/Input.tsx", "utf8");
    expect(input).toContain("text-[16px]");
    expect(input).toContain("sm:text-body");
  });
});
