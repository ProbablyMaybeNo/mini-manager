/**
 * R7-005 — form input border contrast.
 *
 * The round-7 auditor flagged form inputs at 1.4:1 contrast because
 * many components reach for `.frame` (1px @ --color-border = #262626)
 * for their border treatment. WCAG 2.2 §1.4.11 (Non-text Contrast)
 * requires ≥3:1 for borders that demarcate focused or active
 * components — which inputs are by definition.
 *
 * The R7-005 fix routes every <input>, <textarea>, <select> through a
 * dedicated `--color-border-input` token. GOLD-STANDARD pass: Ross's
 * "all grey → bright white" rule repointed every border token (including
 * this one) to #FFFFFF — white on #0a0a0a is 19.8:1, far past WCAG 2.2
 * §1.4.11's 3:1 floor. The CSS rule still uses a tag.class selector so it
 * wins specificity over `.frame` without `!important`.
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

const css = read("src/app/globals.css");

describe("globals.css — R7-005 form input border tokens", () => {
  test("--color-border-input is declared in @theme at #ffffff (gold-standard: all grey → white)", () => {
    // 19.8:1 on #0a0a0a — clears WCAG 1.4.11 (3:1) for non-text
    // component boundaries with enormous headroom. The gold-standard
    // pass collapsed every border token to bright white, so inputs share
    // the same #ffffff edge as every other surface.
    expect(css).toMatch(/--color-border-input:\s*#ffffff/i);
  });

  test("the docblock references R7-005 + WCAG 1.4.11", () => {
    expect(css).toMatch(/R7-005[\s\S]*?--color-border-input/);
    expect(css).toContain("WCAG 2.2 §1.4.11");
  });

  test("input.frame / textarea.frame / select.frame override .frame's border", () => {
    expect(css).toMatch(/input\.frame[^{]*\{\s*border-color:\s*var\(--color-border-input\)/);
    expect(css).toContain("textarea.frame");
    expect(css).toContain("select.frame");
  });

  test("frame-strong is also lifted to the input token", () => {
    expect(css).toContain("input.frame-strong");
    expect(css).toContain("textarea.frame-strong");
    expect(css).toContain("select.frame-strong");
  });

  test("the new selectors do not introduce !important", () => {
    // !important is a hack; specificity is enough because tag.class
    // beats .class on every browser.
    const r7Block = css.split("R7-005")[1] ?? "";
    expect(r7Block).not.toContain("!important");
  });
});

describe("Contrast budget — R7-005 token value", () => {
  /**
   * Compute the WCAG 2.x relative luminance of a #rrggbb colour.
   * Used to confirm the input-border token clears the 3:1 floor.
   */
  function relLuminance(hex: string): number {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const channel = (v: number): number =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return (
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    );
  }
  function contrast(a: string, b: string): number {
    const la = relLuminance(a);
    const lb = relLuminance(b);
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
  }

  test("#ffffff (the gold-standard input-border token) passes WCAG 1.4.11 (≥3:1)", () => {
    // White on near-black is 19.8:1 — vastly past the 3:1 floor.
    expect(contrast("#ffffff", "#0a0a0a")).toBeGreaterThanOrEqual(3);
    expect(contrast("#ffffff", "#0a0a0a")).toBeGreaterThan(19);
  });

  test("the retired grey border greys (#5a5a5a / #262626) sat at/under the floor", () => {
    // Documents WHY the gold-standard pass went all the way to white: the
    // old grey border tokens hovered at or below the 3:1 boundary.
    expect(contrast("#5a5a5a", "#0a0a0a")).toBeLessThan(3);
    expect(contrast("#262626", "#0a0a0a")).toBeLessThan(3);
  });
});
