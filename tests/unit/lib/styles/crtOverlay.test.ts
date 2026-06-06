/**
 * Phase-0 — CRT overlay (scanlines + vignette) contract.
 *
 * DESIGN_LANGUAGE §6: a MEDIUM scanline overlay on a viewport-anchored
 * layout wrapper (the body pseudo-elements), with readability as a hard
 * floor and EVERYTHING stripped under prefers-reduced-motion. The overlay
 * is decorative ambience — it must never intercept input and must be
 * globally disable-able via `.crt-off` on <html>.
 *
 * These source-sentinel assertions pin the contract so a future refactor
 * can't silently drop the reduced-motion strip (an a11y regression) or
 * let the scanlines wash out text.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const css = fs.readFileSync(
  path.resolve(__dirname, "../../../../src/app/globals.css"),
  "utf-8",
);

function ruleBody(selector: string): string {
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  );
  return css.match(re)?.[1] ?? "";
}

describe("CRT overlay — scanlines on a viewport-anchored wrapper", () => {
  test("body::before draws the scanline grid via repeating-linear-gradient", () => {
    const body = ruleBody("body::before");
    expect(body).toMatch(/repeating-linear-gradient/);
    expect(body).toMatch(/position:\s*fixed/);
  });

  test("the overlay never intercepts input (pointer-events: none)", () => {
    expect(ruleBody("body::before")).toMatch(/pointer-events:\s*none/);
    expect(ruleBody("body::after")).toMatch(/pointer-events:\s*none/);
  });

  test("body::after carries the CRT tube-edge vignette", () => {
    expect(ruleBody("body::after")).toMatch(/radial-gradient/);
  });
});

describe("CRT overlay — readability + reduced-motion floor", () => {
  test("a prefers-reduced-motion block strips both overlay layers", () => {
    const rmBlocks =
      css.match(
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/g,
      ) ?? [];
    const joined = rmBlocks.join("\n");
    // The block that removes the overlay must name both pseudo-elements
    // and set display:none.
    expect(joined).toMatch(
      /body::before[\s\S]*?body::after[\s\S]*?display:\s*none/,
    );
  });

  test(".crt-off opt-out hides the overlay app-wide", () => {
    expect(css).toMatch(
      /html\.crt-off\s+body::before[\s\S]*?display:\s*none/,
    );
  });
});
